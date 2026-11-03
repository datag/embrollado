/**
 * In-memory debug log for the current page lifetime (constitution "current session" reading of the
 * development TODO). Every network call leaves through the single `fetch` seam (`ai/transport.ts`),
 * which reports each request and its response here — no persistence, no export, nothing leaves the
 * device. The store is plain (no Vue): components subscribe through `composables/useDebugLog.ts`.
 *
 * Redaction happens here (headers, the bearer key anywhere it appears), truncation of oversized
 * string values happens here too, and the payload shown is always already shortened — so a multi-MB
 * base64 image never sits in memory and never reaches the DOM.
 */

export type DebugDirection = 'request' | 'response'
export type DebugRequestKind = 'chat' | 'tts' | 'image' | 'other'

export interface DebugLogEntry {
  id: string
  direction: DebugDirection
  /** Epoch ms of when the request was sent / the response completed. */
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
const TRUNCATE_LEN = 2000
const TRUNCATE_MARKER = '<TRUNCATED>'
/** A raw, non-JSON text value is hard-capped so an unbounded body can never bloat the log. */
const MAX_RAW_CHARS = 50_000
const MAX_ENTRIES = 200

/** Serialise a parsed value to pretty JSON after truncating long strings. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

/** Recursively shorten every string longer than the threshold (5 + marker + 5). */
export function truncateLongStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length > TRUNCATE_LEN)
      return `${value.slice(0, 5)}${TRUNCATE_MARKER}${value.slice(-5)}`
    return value
  }
  if (Array.isArray(value)) return value.map(truncateLongStrings)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) out[key] = truncateLongStrings(child)
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
    } else if (key === 'x-api-key' || key === 'api-key') {
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

function notify() {
  for (const listener of listeners) listener()
}

function pushEntry(entry: DebugLogEntry) {
  entries = [entry, ...entries].slice(0, MAX_ENTRIES)
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

/** Clear the current page's log (manual action; the log is never persisted anyway). */
export function clearDebugLog(): void {
  entries = []
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
  const durationMs = Date.now() - startedAt
  const contentType = response.headers.get('content-type') ?? ''
  const headerMap = normalizeHeaders(init.headers)
  const { headers, secret } = redactHeaders(headerMap)
  const status = response.status

  const base = {
    id: nextId(),
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
