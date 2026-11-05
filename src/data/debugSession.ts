import type { DebugLogEntry } from '@/ai/debugLog'

/**
 * Debug-log persistence in `sessionStorage` (mirrors the one-shot pattern in `data/oneShots.ts`).
 * The log survives a reload in the same tab but dies when the tab closes — matching the "current
 * session" reading of the development TODO. It is a schema envelope with defensive reads; a missing,
 * malformed or newer-schema document is treated as empty. Written best-effort: sessionStorage can
 * be blocked (e.g. Safari private mode), in which case the store keeps working in memory only.
 *
 * The log is capped by serialised byte size (oldest entries are dropped first), so multi-MB base64
 * payloads can never blow the budget. The byte budget protects the STORAGE only — the live log in
 * `ai/debugLog.ts` keeps every entry of the session (it is capped by entry count instead). How many
 * entries did not fit is stored next to the list, so the panel can say so instead of silently
 * showing a shortened log.
 */

export const DEBUG_KEY = 'embrollado.debug.v1'
export const DEBUG_SCHEMA = 1
/** Soft floor: how many raw bytes the serialised log may occupy at most. */
export const DEBUG_MAX_BYTES = 256 * 1024

interface DebugPersistDocument {
  schema: number
  data: {
    entries: DebugLogEntry[]
    /** Entries the live log dropped because it hit its entry-count cap (gone for good). */
    dropped?: number
    /** Session entries that are NOT in the persisted list (count-cap + byte-budget drops). */
    trimmed?: number
  }
}

/** The persisted document: the entries plus the counters that explain a shortened list. */
export interface DebugDocument {
  entries: DebugLogEntry[]
  /** Entries dropped from the live log by the entry-count cap. */
  dropped: number
  /** Session entries missing from the persisted list (count-cap + byte-budget drops). */
  trimmed: number
}

function byteSize(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    try {
      return new TextEncoder().encode(text).length
    } catch {
      /* fall through to a length approximation */
    }
  }
  return text.length
}

/** Drop oldest entries until the serialised document fits the byte cap. */
function pruneToByteCap(entries: DebugLogEntry[]): DebugLogEntry[] {
  let list = entries
  for (;;) {
    if (list.length === 0) return list
    const size = byteSize(JSON.stringify({ schema: DEBUG_SCHEMA, data: { entries: list } }))
    if (size <= DEBUG_MAX_BYTES) return list
    list = list.slice(0, -1) // drop the oldest (the list is newest-first)
  }
}

/** Read the persisted log; returns newest-first entries, or an empty list. */
export function readDebugEntries(): DebugLogEntry[] {
  return readDebugDocument().entries
}

/**
 * Read the persisted log together with the counters that explain why it may be shorter than the
 * session it belongs to. A missing, malformed or newer-schema document is treated as empty.
 */
export function readDebugDocument(): DebugDocument {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(DEBUG_KEY)
  } catch {
    return { entries: [], dropped: 0, trimmed: 0 }
  }
  if (!raw) return { entries: [], dropped: 0, trimmed: 0 }
  try {
    const doc = JSON.parse(raw) as Partial<DebugPersistDocument>
    const schema = Number(doc?.schema ?? 0)
    if (!Number.isInteger(schema) || schema > DEBUG_SCHEMA)
      return { entries: [], dropped: 0, trimmed: 0 }
    const list = doc?.data?.entries
    const entries = Array.isArray(list) ? list : []
    const dropped = Number(doc?.data?.dropped ?? 0)
    const trimmed = Number(doc?.data?.trimmed ?? 0)
    return {
      entries,
      dropped: Number.isFinite(dropped) && dropped > 0 ? dropped : 0,
      trimmed: Number.isFinite(trimmed) && trimmed > 0 ? trimmed : 0,
    }
  } catch {
    return { entries: [], dropped: 0, trimmed: 0 }
  }
}

/**
 * Persist {@link entries}. Prunes to the byte cap (returning the pruned list). On a storage failure
 * it retries once after dropping an entry; if that still fails it falls back to memory-only and
 * reports the failure so the panel can show a hint.
 *
 * {@link dropped} is the number of entries the live log already lost to its entry-count cap;
 * {@link trimmed} is the number of session entries that are not in the stored list. Both are stored
 * alongside the list so a reload can still explain the shortened log. The byte-budget drops are
 * counted here, because only this layer knows how many entries did not fit.
 */
export function writeDebugEntries(
  entries: DebugLogEntry[],
  dropped = 0,
  trimmed = 0,
): {
  entries: DebugLogEntry[]
  trimmed: number
  ok: boolean
  error: string | null
} {
  const pruned = pruneToByteCap(entries)
  // The counter never goes back down: an entry that was dropped by an earlier reload stays lost.
  const nextTrimmed = Math.max(trimmed, dropped + (entries.length - pruned.length))
  try {
    const doc: DebugPersistDocument = {
      schema: DEBUG_SCHEMA,
      data: { entries: pruned, dropped, trimmed: nextTrimmed },
    }
    sessionStorage.setItem(DEBUG_KEY, JSON.stringify(doc))
    return { entries: pruned, trimmed: nextTrimmed, ok: true, error: null }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // Quota/blocked — drop one older entry and try once more.
    const retry = pruned.length > 0 ? pruned.slice(0, -1) : pruned
    try {
      const doc: DebugPersistDocument = {
        schema: DEBUG_SCHEMA,
        data: {
          entries: retry,
          dropped,
          trimmed: nextTrimmed + (pruned.length - retry.length),
        },
      }
      sessionStorage.setItem(DEBUG_KEY, JSON.stringify(doc))
      return { entries: retry, trimmed: nextTrimmed, ok: true, error: null }
    } catch {
      return { entries: pruned, trimmed: nextTrimmed, ok: false, error: reason }
    }
  }
}

/** Clear the persisted log. */
export function clearDebugEntries(): void {
  try {
    sessionStorage.removeItem(DEBUG_KEY)
  } catch {
    /* best-effort */
  }
}
