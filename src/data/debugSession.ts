import type { DebugLogEntry } from '@/ai/debugLog'

/**
 * Debug-log persistence in `sessionStorage` (mirrors the one-shot pattern in `data/oneShots.ts`).
 * The log survives a reload in the same tab but dies when the tab closes — matching the "current
 * session" reading of the development TODO. It is a schema envelope with defensive reads; a missing,
 * malformed or newer-schema document is treated as empty. Written best-effort: sessionStorage can
 * be blocked (e.g. Safari private mode), in which case the store keeps working in memory only.
 *
 * The log is capped by entry count and by serialised byte size (oldest entries are dropped first),
 * so multi-MB base64 payloads can never blow the budget.
 */

export const DEBUG_KEY = 'embrollado.debug.v1'
export const DEBUG_SCHEMA = 1
/** Soft floor: how many raw bytes the serialised log may occupy at most. */
export const DEBUG_MAX_BYTES = 256 * 1024

interface DebugPersistDocument {
  schema: number
  data: { entries: DebugLogEntry[] }
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
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(DEBUG_KEY)
  } catch {
    return []
  }
  if (!raw) return []
  try {
    const doc = JSON.parse(raw) as Partial<DebugPersistDocument>
    const schema = Number(doc?.schema ?? 0)
    if (!Number.isInteger(schema) || schema > DEBUG_SCHEMA) return []
    const list = doc?.data?.entries
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/**
 * Persist {@link entries}. Prunes to the byte cap (returning the pruned list). On a storage failure
 * it retries once after dropping an entry; if that still fails it falls back to memory-only and
 * reports the failure so the panel can show a hint.
 */
export function writeDebugEntries(entries: DebugLogEntry[]): {
  entries: DebugLogEntry[]
  ok: boolean
  error: string | null
} {
  const pruned = pruneToByteCap(entries)
  try {
    const doc: DebugPersistDocument = { schema: DEBUG_SCHEMA, data: { entries: pruned } }
    sessionStorage.setItem(DEBUG_KEY, JSON.stringify(doc))
    return { entries: pruned, ok: true, error: null }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // Quota/blocked — drop one older entry and try once more.
    const retry = pruned.length > 0 ? pruned.slice(0, -1) : pruned
    try {
      const doc: DebugPersistDocument = { schema: DEBUG_SCHEMA, data: { entries: retry } }
      sessionStorage.setItem(DEBUG_KEY, JSON.stringify(doc))
      return { entries: retry, ok: true, error: null }
    } catch {
      return { entries: pruned, ok: false, error: reason }
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
