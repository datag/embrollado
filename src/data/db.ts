import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AudioEntry, Illustration, Session, Turn } from '@/domain/types'

/**
 * IndexedDB layer. Database `embrollado`, prefixed stores (specs/.../data-model.md §1, D6).
 *
 * Store names are immutable in IndexedDB, so they are fixed at day one.
 */

export const DB_NAME = 'embrollado'
export const DB_VERSION = 1

export const STORE = {
  sessions: 'embrollado:sessions',
  turns: 'embrollado:turns',
  illustrations: 'embrollado:illustrations',
  audio: 'embrollado:audio',
  meta: 'embrollado:meta',
} as const

export const INDEX = {
  sessionsByCreatedAt: 'embrollado:by-createdAt',
  sessionsByLanguage: 'embrollado:by-language',
  turnsBySession: 'embrollado:by-session',
  turnsByPosition: 'embrollado:by-position',
  illustrationsBySession: 'embrollado:by-session',
  audioBySession: 'embrollado:by-session',
  audioByTurn: 'embrollado:by-turn',
} as const

interface EmbroDB extends DBSchema {
  [STORE.sessions]: {
    key: string
    value: Session
    indexes: {
      [INDEX.sessionsByCreatedAt]: string
      [INDEX.sessionsByLanguage]: string
    }
  }
  [STORE.turns]: {
    key: string
    value: Turn
    indexes: {
      [INDEX.turnsBySession]: string
      [INDEX.turnsByPosition]: [string, number]
    }
  }
  [STORE.illustrations]: {
    key: string
    value: Illustration
    indexes: {
      [INDEX.illustrationsBySession]: string
    }
  }
  [STORE.audio]: {
    key: string
    value: AudioEntry
    indexes: {
      [INDEX.audioBySession]: string
      [INDEX.audioByTurn]: string
    }
  }
  [STORE.meta]: {
    key: string
    value: { key: string; value: string }
  }
}

let _db: Promise<IDBPDatabase<EmbroDB>> | null = null

export function getDB(): Promise<IDBPDatabase<EmbroDB>> {
  if (!_db) {
    _db = openDB<EmbroDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE.sessions)) {
          const s = db.createObjectStore(STORE.sessions, { keyPath: 'id' })
          s.createIndex(INDEX.sessionsByCreatedAt, 'createdAt')
          s.createIndex(INDEX.sessionsByLanguage, 'language')
        }
        if (!db.objectStoreNames.contains(STORE.turns)) {
          const t = db.createObjectStore(STORE.turns, { keyPath: 'id' })
          t.createIndex(INDEX.turnsBySession, 'sessionId')
          t.createIndex(INDEX.turnsByPosition, ['sessionId', 'position'])
        }
        if (!db.objectStoreNames.contains(STORE.illustrations)) {
          const i = db.createObjectStore(STORE.illustrations, { keyPath: 'id' })
          i.createIndex(INDEX.illustrationsBySession, 'sessionId')
        }
        if (!db.objectStoreNames.contains(STORE.audio)) {
          const a = db.createObjectStore(STORE.audio, { keyPath: 'id' })
          a.createIndex(INDEX.audioBySession, 'sessionId')
          a.createIndex(INDEX.audioByTurn, 'turnId')
        }
        if (!db.objectStoreNames.contains(STORE.meta)) {
          db.createObjectStore(STORE.meta, { keyPath: 'key' })
        }
      },
    })
  }
  return _db
}

/** true when the error is a storage-quota failure (Safari reports `QuotaExceededError`). */
export function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Request persistent storage. MUST be called from a user gesture (see T074).
 * Returns true when the browser guarantees persistence.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') {
    return { usage: 0, quota: 0 }
  }
  try {
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  } catch {
    return { usage: 0, quota: 0 }
  }
}

/** Read a meta value (e.g. "embrollado:schemaVersion"). */
export async function metaGet(key: string): Promise<string | null> {
  const db = await getDB()
  const row = await db.get(STORE.meta, key)
  return row?.value ?? null
}

export async function metaSet(key: string, value: string): Promise<void> {
  const db = await getDB()
  await db.put(STORE.meta, { key, value })
}