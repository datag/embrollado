import type { AudioEntry, Illustration } from '@/domain/types'
import { getDB, STORE, INDEX, isQuotaError } from '@/data/db'
import { readSettings } from '@/data/settings'

/**
 * Media store (T082): illustrations (never pruned automatically) and the bounded speech cache.
 * On `QuotaExceededError` the app prunes ONLY the newest cached speech lines — never a transcript
 * or a picture (FR-051).
 */

/** Wrap a binary write with one retry after pruning the speech cache on quota errors. */
async function withQuotaRetry(put: () => Promise<unknown>): Promise<{ ok: boolean; message: string | null }> {
  try {
    await put()
    return { ok: true, message: null }
  } catch (err) {
    if (!isQuotaError(err)) throw err
    try {
      await pruneSpeechCache()
    } catch {
      return { ok: false, message: 'storageFull' }
    }
    try {
      await put()
      return { ok: true, message: null }
    } catch (again) {
      if (isQuotaError(again)) return { ok: false, message: 'storageFull' }
      throw again
    }
  }
}

/** Save or update an illustration (with one prune-retry on quota). */
export async function saveIllustration(
  illustration: Illustration,
): Promise<{ ok: boolean; message: string | null }> {
  const db = await getDB()
  return withQuotaRetry(() => db.put(STORE.illustrations, illustration))
}

export async function getIllustration(id: string): Promise<Illustration | undefined> {
  const db = await getDB()
  return db.get(STORE.illustrations, id)
}

export async function getIllustrationsBySession(sessionId: string): Promise<Illustration[]> {
  const db = await getDB()
  return db.getAllFromIndex(STORE.illustrations, INDEX.illustrationsBySession, sessionId)
}

/** Save an audio cache entry (with one prune-retry on quota). */
export async function saveAudio(entry: AudioEntry): Promise<{ ok: boolean; message: string | null }> {
  const db = await getDB()
  return withQuotaRetry(() => db.put(STORE.audio, entry))
}

export async function getAudioEntry(id: string): Promise<AudioEntry | undefined> {
  const db = await getDB()
  return db.get(STORE.audio, id)
}

export async function getAudioForTurn(turnId: string): Promise<AudioEntry | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex(STORE.audio, INDEX.audioByTurn, turnId)
  return all[0]
}

/** Reuse an identical line from the cache before requesting a new generation (FR-050). */
export async function findAudioByText(text: string): Promise<AudioEntry | undefined> {
  const db = await getDB()
  const all = await db.getAll(STORE.audio)
  return all.find((a) => a.text === text)
}

/** All cached audio, oldest first (the pruning order). */
export async function listAudio(): Promise<AudioEntry[]> {
  const db = await getDB()
  const all = await db.getAll(STORE.audio)
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Prune the speech cache: keep only the newest `cachedSpeechLines` entries per session,
 * dropping the oldest first (data-model §6, FR-050).
 */
export async function pruneSpeechCache(keepPerSession = readSettings().cachedSpeechLines): Promise<void> {
  const db = await getDB()
  const all = await listAudio()
  const bySession = new Map<string, AudioEntry[]>()
  for (const a of all) {
    const list = bySession.get(a.sessionId) ?? []
    list.push(a)
    bySession.set(a.sessionId, list)
  }
  const tx = db.transaction(STORE.audio, 'readwrite')
  const store = tx.objectStore(STORE.audio)
  for (const entries of bySession.values()) {
    const excess = entries.slice(0, Math.max(0, entries.length - keepPerSession))
    for (const a of excess) {
      await store.delete(a.id)
    }
  }
  await tx.done
}

export { isQuotaError }