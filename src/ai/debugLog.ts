/**
 * Debug log for the current session: it survives a reload in the same tab (via `sessionStorage`,
 * see `data/debugSession.ts`) but dies when the tab closes — the "current session" reading of the
 * development TODO. Every network call leaves through the single `fetch` seam (`ai/transport.ts`),
 * which reports each request and its response here; nothing is exported and nothing leaves the
 * device. The store is plain (no Vue): components subscribe through `composables/useDebugLog.ts`.
 *
 * Redaction happens here (headers, the bearer key anywhere it appears), and truncation happens
 * here too: only base64/binary values (or strings over the hard safety net) are shortened, so a
 * multi-MB base64 image never sits in memory while ordinary prose stays intact.
 */
import { readDebugEntries, writeDebugEntries, clearDebugEntries } from '@/data/debugSession'

export type DebugDirection = 'request' | 'response'
export type DebugRequestKind = 'chat' | 'tts' | 'image' | 'other'

export interface DebugLogEntry {
  id: string
  /** Monotonic event sequence — served as a tie-breaker when two entries share a timestamp. */
  seq: number
  direction: DebugDirection
  /** Epoch ms of when the request was sent / the response's headers arrived. */
  timestamp: number
  kind: DebugRequestKind
  method: string
  path: string
  status: number | null
  durationMs: number | null
  /** Headers with the credential values already redacted. */
  headers: Record<string, string>
  /** Formatted + truncated payload, or a short non-JSON placeholder. */
  payload: string
}

/** Values longer than this become `abcde<TRUNCATED>vwxyz` when shown (development TODO). */
/** Values under a base64/binary field longer than this become `abcde<TRUNCATED>vwxyz`. */
const BASE64_MIN_LEN = 64
/** Hard safety net: any string longer than this is truncated regardless of its field name. */
const SAFETY_MAX_LEN = 50_000
const TRUNCATE_MARKER = '<TRUNCATED>'
/** A raw, non-JSON text value is hard-capped so an unbounded body can never bloat the log. */
const MAX_RAW_CHARS = 50_000
const MAX_ENTRIES = 50

/** Serialise a parsed value to pretty JSON after truncating long strings. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

/** Field names whose value holds base64/binary data (e.g. `b64_json` from the image API). */
const BASE64_KEY = /b64|base64/i

/** Shorten a string value; returns a new string. */
function abbreviate(text: string): string {
  return `${text.slice(0, 5)}${TRUNCATE_MARKER}${text.slice(-5)}`
}

/**
 * Recursively shorten string values. Only values held under a base64/binary field name (or any
 * string over the hard safety net) are truncated — ordinary prose is preserved intact, so a long
 * answer or prompt no longer collapses to `abcde<TRUNCATED>vwxyz`. The field name travels with the
 * walk: objects pass their key down, arrays inherit the parent's key (so `{"b64": [...]}` works).
 */
export function truncateLongStrings(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    const isBinaryField = key !== undefined && BASE64_KEY.test(key)
    if ((isBinaryField && value.length > BASE64_MIN_LEN) || value.length > SAFETY_MAX_LEN)
      return abbreviate(value)
    return value
  }
  if (Array.isArray(value)) return value.map((child) => truncateLongStrings(child, key))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [childKey, child] of Object.entries(value))
      out[childKey] = truncateLongStrings(child, childKey)
    return out
  }
  return value
}

/** Cap a raw (non-JSON) text fragment. */
function truncateRawText(text: string): string {
  if (text.length <= MAX_RAW_CHARS) return text
  return `${text.slice(0, 5)}${TRUNCATE_MARKER}${text.slice(-5)}`
}

/** Format a JSON string for display: parse → truncate → pretty-print. Falls back to raw text. */
export function formatJsonText(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return truncateRawText(raw)
  }
  return safeStringify(truncateLongStrings(parsed))
}

/** Format a parsed SSE response body into a JSON array of its frames. */
export function formatSseText(raw: string): string {
  const frames: unknown[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      frames.push(JSON.parse(payload))
    } catch {
      frames.push(payload)
    }
  }
  return safeStringify(truncateLongStrings(frames))
}

const REDACTED = '<REDACTED>'

/** Replace a credential substring (the real bearer token) everywhere it appears. */
function scrubSecret(text: string, secret: string | null): string {
  if (!secret || secret.length < 8 || !text.includes(secret)) return text
  return text.split(secret).join(REDACTED)
}

/** Extract the literal credential so it can be scrubbed from bodies/URLs/errors, not just headers. */
function extractSecret(headers: Record<string, string>): string | null {
  const auth = headers['authorization']
  if (auth) {
    const value = auth.replace(/^\S+\s+/, '').trim() // "Bearer sk-…" → "sk-…"
    return value.length >= 8 ? value : null
  }
  const other = headers['x-api-key'] ?? headers['api-key']
  return other && other.trim().length >= 8 ? other.trim() : null
}

/** Normalise a ResponseInit-like headers source to a lower-cased header map. */
function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  try {
    const h = headers instanceof Headers ? headers : new Headers(headers)
    h.forEach((value, key) => {
      out[key.toLowerCase()] = value
    })
  } catch {
    /* a malformed header source is skipped */
  }
  return out
}

/** Redact bearer/credential headers, keeping the scheme ("Bearer <REDACTED>"). */
function redactHeaders(headers: Record<string, string>): {
  headers: Record<string, string>
  secret: string | null
} {
  const secret = extractSecret(headers)
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (key === 'authorization') {
      const scheme = value.includes(' ') ? value.slice(0, value.indexOf(' ')).trim() : value
      out[key] = `${scheme} ${REDACTED}`.trim()
    } else if (key === 'x-api-key' || key === 'api-key' || key === 'set-cookie') {
      out[key] = REDACTED
    } else {
      out[key] = value
    }
  }
  return { headers: out, secret }
}

/** Classify a request by its URL path (development TODO: Chat / TTS / Image / Sonstige). */
export function classifyKind(url: string): DebugRequestKind {
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    /* a relative/opaque URL is judged by its text */
  }
  if (path.includes('/chat/completions')) return 'chat'
  if (path.includes('/audio/speech')) return 'tts'
  if (path.includes('/images')) return 'image'
  return 'other'
}

/** Safely extract the path (or the full URL when unparsable) for the list/detail view. */
export function pathFromUrl(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */

let entries: DebugLogEntry[] = []
const listeners = new Set<() => void>()
/** True once a persist attempt failed and the log only lives for this page. */
let persistenceFailed = false

/** Monotonic counter assigned at each event (request send / response arrival). */
let seqCounter = 0
function nextSeq(): number {
  return ++seqCounter
}

function readPersisted() {
  entries = []
  persistenceFailed = false
  entries = readDebugEntries()
  // Never let a storage-extracted log exceed the in-memory cap.
  entries = entries.slice(0, MAX_ENTRIES)
}

// Hydrate from the previous page load in this tab (sessionStorage).
readPersisted()

function notify() {
  for (const listener of listeners) listener()
}

/** Persist best-effort; on failure the log keeps working in memory only. */
function persist() {
  const result = writeDebugEntries(entries)
  if (result.ok) {
    if (result.entries.length !== entries.length) entries = result.entries
  } else {
    persistenceFailed = true
  }
}

function pushEntry(entry: DebugLogEntry) {
  entries = [entry, ...entries]
  // Strict chronological order (newest first), independent of when a body read finished: sort by
  // event timestamp, then by event sequence for ties. Entries are never re-ordered by insert time.
  entries.sort((a, b) => b.timestamp - a.timestamp || b.seq - a.seq)
  entries = entries.slice(0, MAX_ENTRIES)
  persist()
  notify()
}

/** Subscribe to log changes. Returns an unsubscribe function. */
export function subscribeDebugLog(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** The log, newest first (already in display order, insertion is newest-at-top). */
export function debugLogEntries(): readonly DebugLogEntry[] {
  return entries
}

/** Whether storage is unavailable so the log survives only this page. */
export function debugPersistenceFailed(): boolean {
  return persistenceFailed
}

/** Clear the log (manual action) — memory and the persisted copy. */
export function clearDebugLog(): void {
  entries = []
  persistenceFailed = false
  clearDebugEntries()
  notify()
}

/** Report a request, given the raw URL and RequestInit (the values are redacted/truncated here). */
export function logRequest(url: string, init: RequestInit): void {
  const headerMap = normalizeHeaders(init.headers)
  const { headers, secret } = redactHeaders(headerMap)
  const kind = classifyKind(url)
  const body = typeof init.body === 'string' ? init.body : null
  pushEntry({
    id: nextId(),
    seq: nextSeq(),
    direction: 'request',
    timestamp: Date.now(),
    kind,
    method: (init.method ?? 'GET').toUpperCase(),
    path: pathFromUrl(url),
    status: null,
    durationMs: null,
    headers,
    payload: body ? formatJsonText(scrubSecret(body, secret)) : '',
  })
}

/** Report a completed response. Reads the JSON/SSE body; binary bodies are never buffered whole. */
export async function logResponse(
  url: string,
  init: RequestInit,
  response: Response,
  startedAt: number,
): Promise<void> {
  const durationMs = performance.now() - startedAt
  const contentType = response.headers.get('content-type') ?? ''
  // The secret used to scrub bodies/URLs comes from the REQUEST auth header.
  const secret = extractSecret(normalizeHeaders(init.headers))
  // The headers shown on a response entry are the RESPONSE headers (redacted ids kept out).
  const { headers } = redactHeaders(normalizeHeaders(response.headers))
  const status = response.status

  const base = {
    id: nextId(),
    seq: nextSeq(),
    direction: 'response' as const,
    timestamp: Date.now(),
    kind: classifyKind(url),
    method: (init.method ?? 'GET').toUpperCase(),
    path: pathFromUrl(url),
    status,
    durationMs,
    headers,
    payload: '',
  }

  const scrubbed = (text: string) => scrubSecret(text, secret)

  if (contentType.includes('text/event-stream')) {
    try {
      const text = await response.clone().text()
      base.payload = formatSseText(scrubbed(text))
    } catch {
      base.payload = ''
    }
    pushEntry(base)
    return
  }

  if (!contentType.includes('json')) {
    // Binary body (TTS audio) — report metadata without buffering the bytes.
    base.payload = `<binary ${contentType || 'unknown'}, ${response.headers.get('content-length') ?? '?'} bytes>`
    pushEntry(base)
    return
  }

  try {
    const text = await response.clone().text()
    base.payload = formatJsonText(scrubbed(text))
  } catch {
    base.payload = ''
  }
  pushEntry(base)
}
