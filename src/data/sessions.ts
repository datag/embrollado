import type { Level, PartnerRef, Session, SituationRef, Turn } from '@/domain/types'
import { getDB, STORE, INDEX } from '@/data/db'
import { isQuotaError } from '@/data/db'

/**
 * Session + turn storage (T038, T062). Consistent with data-model.md §6: a session and its turns
 * are written in one transaction; deleting a session cascades over turns, illustrations and
 * audio in one transaction.
 */

export interface NewSessionInput {
  language: string
  level: Level
  situation: SituationRef
  partner: PartnerRef
  learnerName: string | null
}

export function newSessionId(): string {
  return crypto.randomUUID()
}

export function buildSessionTitle(situationName: string, partnerName: string): string {
  const title = `${situationName} · ${partnerName}`
  return title.slice(0, 80)
}

export async function createSession(input: NewSessionInput): Promise<Session> {
  const now = new Date().toISOString()
  const session: Session = {
    id: newSessionId(),
    title: buildSessionTitle(input.situation.name, input.partner.name),
    language: input.language,
    level: input.level,
    situation: { ...input.situation },
    partner: { ...input.partner },
    learnerName: input.learnerName,
    state: 'active',
    createdAt: now,
    updatedAt: now,
    turnCount: 0,
    lastTurnAt: null,
  }
  const db = await getDB()
  await db.put(STORE.sessions, session)
  return session
}

export function sessionToRef(
  s: { id: string; name: string; setting: string; origin: string; keyMoments?: string[] },
): SituationRef {
  return {
    id: s.id,
    name: s.name,
    setting: s.setting,
    custom: s.origin === 'learner',
    keyMoments: s.keyMoments?.slice(0, 5),
  }
}

export function personaToRef(p: {
  id: string
  name: string
  age: number | null
  occupation: string
  origin: string
  description: string
}): PartnerRef {
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    occupation: p.occupation,
    custom: p.origin === 'learner',
    description: p.description,
  }
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get(STORE.sessions, id)
}

export async function listSessions(): Promise<Session[]> {
  const db = await getDB()
  return db.getAllFromIndex(STORE.sessions, INDEX.sessionsByCreatedAt)
}

export async function searchSessions(query: string): Promise<Session[]> {
  const all = await listSessions()
  const q = query.trim().toLowerCase()
  if (!q) return all
  return all.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.language.toLowerCase().includes(q) ||
      s.situation.name.toLowerCase().includes(q) ||
      s.partner.name.toLowerCase().includes(q),
  )
}

export async function renameSession(id: string, title: string): Promise<void> {
  const db = await getDB()
  const session = await db.get(STORE.sessions, id)
  if (!session) return
  session.title = title.slice(0, 80)
  session.updatedAt = new Date().toISOString()
  await db.put(STORE.sessions, session)
}

export async function updateSession(input: Partial<Pick<Session, 'title' | 'level' | 'state' | 'learnerName'>> & {
  id: string
}): Promise<void> {
  const db = await getDB()
  const session = await db.get(STORE.sessions, input.id)
  if (!session) return
  session.updatedAt = new Date().toISOString()
  if (input.title !== undefined) session.title = input.title.slice(0, 80)
  if (input.level !== undefined) session.level = input.level
  if (input.state !== undefined) session.state = input.state
  if (input.learnerName !== undefined) session.learnerName = input.learnerName
  await db.put(STORE.sessions, session)
}

export async function endSession(id: string): Promise<void> {
  await updateSession({ id, state: 'ended' })
}

/** Save a turn and touch the session's turnCount/lastTurnAt in one transaction (data-model §6). */
export async function saveTurn(turn: Turn): Promise<void> {
  const db = await getDB()
  const tx = db.transaction([STORE.turns, STORE.sessions], 'readwrite')
  await tx.objectStore(STORE.turns).put(turn)
  const session = await tx.objectStore(STORE.sessions).get(turn.sessionId)
  if (session) {
    session.turnCount = Math.max(session.turnCount, turn.position)
    session.lastTurnAt = turn.createdAt
    session.updatedAt = turn.createdAt
    session.state = session.state === 'ended' ? 'active' : session.state
    await tx.objectStore(STORE.sessions).put(session)
  }
  await tx.done
}

export async function getTurns(sessionId: string): Promise<Turn[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex(STORE.turns, INDEX.turnsBySession, sessionId)
  return all.sort((a, b) => a.position - b.position)
}

export async function getTurn(id: string): Promise<Turn | undefined> {
  const db = await getDB()
  return db.get(STORE.turns, id)
}

export async function updateTurn(turn: Turn): Promise<void> {
  const db = await getDB()
  await db.put(STORE.turns, turn)
}

/** One-shot cursor iteration over an index inside an existing transaction. */
async function iterateAndDelete(
  cursorRequestFactory: () => IDBRequest,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = cursorRequestFactory()
    req.onsuccess = () => {
      const cursor = req.result as IDBCursor | null
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
}

/** Delete a session with its turns, illustrations and audio in one transaction. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [STORE.sessions, STORE.turns, STORE.illustrations, STORE.audio],
    'readwrite',
  )
  const range = IDBKeyRange.only(id)
  const turnIndex = tx.objectStore(STORE.turns).index(INDEX.turnsBySession)
  const illuIndex = tx.objectStore(STORE.illustrations).index(INDEX.illustrationsBySession)
  const audioIndex = tx.objectStore(STORE.audio).index(INDEX.audioBySession)
  await Promise.all([
    iterateAndDelete(() => turnIndex.openCursor(range) as unknown as IDBRequest),
    iterateAndDelete(() => illuIndex.openCursor(range) as unknown as IDBRequest),
    iterateAndDelete(() => audioIndex.openCursor(range) as unknown as IDBRequest),
  ])
  await tx.objectStore(STORE.sessions).delete(id)
  await tx.done
}

export { isQuotaError }