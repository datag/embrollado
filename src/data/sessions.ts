import type {
  Level,
  PartnerRef,
  Persona,
  Session,
  SessionOptions,
  SituationRef,
  Turn,
} from '@/domain/types'
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
  options: SessionOptions
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
    options: { ...input.options },
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

export function sessionToRef(s: {
  id: string
  name: string
  setting: string
  origin: string
  keyMoments?: string[]
}): SituationRef {
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
  gender?: Persona['gender']
  occupation: string
  origin: string
  description: string
}): PartnerRef {
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    // Old snapshots / templates without the field keep a gender-less ref (gender stays optional).
    gender: p.gender ?? null,
    occupation: p.occupation,
    custom: p.origin === 'learner',
    description: p.description,
  }
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get(STORE.sessions, id)
}

/**
 * The moment a session was last active: the newest of its last turn, its last update (rename,
 * end) and its creation. The creation date is the fallback for a session without any activity
 * yet — it is always present.
 */
export function sessionActivityAt(session: Session): string {
  const stamps = [session.lastTurnAt, session.updatedAt, session.createdAt].filter(
    (stamp): stamp is string => typeof stamp === 'string' && stamp.length > 0,
  )
  if (stamps.length === 0) return session.createdAt
  return stamps.reduce((newest, stamp) => (stamp > newest ? stamp : newest))
}

/**
 * Sort the session list by the last activity, newest first (the conversation the learner touched
 * last comes first). The store returns the sessions ordered by creation date — the index is
 * ascending — so the order is reversed here.
 */
export function sortSessionsByActivity(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const byActivity = sessionActivityAt(b).localeCompare(sessionActivityAt(a))
    if (byActivity !== 0) return byActivity
    // Same activity (sessions created in the same millisecond) — keep a stable, predictable order.
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export async function listSessions(): Promise<Session[]> {
  const db = await getDB()
  const sessions = await db.getAllFromIndex(STORE.sessions, INDEX.sessionsByCreatedAt)
  return sortSessionsByActivity(sessions)
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

export async function updateSession(
  input: Partial<Pick<Session, 'title' | 'level' | 'state' | 'options'>> & {
    id: string
  },
): Promise<void> {
  const db = await getDB()
  const session = await db.get(STORE.sessions, input.id)
  if (!session) return
  session.updatedAt = new Date().toISOString()
  if (input.title !== undefined) session.title = input.title.slice(0, 80)
  if (input.level !== undefined) session.level = input.level
  if (input.state !== undefined) session.state = input.state
  if (input.options !== undefined) session.options = { ...input.options }
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

/** Delete a session with its turns, illustrations and audio in one transaction. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [STORE.sessions, STORE.turns, STORE.illustrations, STORE.audio],
    'readwrite',
  )
  const range = IDBKeyRange.only(id)
  // Collect every child key via the by-session indexes, then delete them in the same transaction.
  const turnKeys = (await tx
    .objectStore(STORE.turns)
    .index(INDEX.turnsBySession)
    .getAllKeys(range)) as string[]
  const illuKeys = (await tx
    .objectStore(STORE.illustrations)
    .index(INDEX.illustrationsBySession)
    .getAllKeys(range)) as string[]
  const audioKeys = (await tx
    .objectStore(STORE.audio)
    .index(INDEX.audioBySession)
    .getAllKeys(range)) as string[]

  for (const key of turnKeys) await tx.objectStore(STORE.turns).delete(key)
  for (const key of illuKeys) await tx.objectStore(STORE.illustrations).delete(key)
  for (const key of audioKeys) await tx.objectStore(STORE.audio).delete(key)
  await tx.objectStore(STORE.sessions).delete(id)
  await tx.done
}

export { isQuotaError }
