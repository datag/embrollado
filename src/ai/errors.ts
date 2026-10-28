import { AiError, type AiErrorKind } from '@/domain/types'

/**
 * Error normaliser (T022). Maps the OpenAI body shape, the OpenRouter body shape, error bodies
 * returned with HTTP 200, non-OK statuses, and `fetch` `TypeError`s into one internal `AiError`.
 * The API key is replaced with `***` in every message before it can reach the UI or a log.
 */

const REDACT_PATTERN = /sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}/gi

/** Replace anything that looks like a credential with `***`. */
export function redact(value: string): string {
  return value.replace(REDACT_PATTERN, (m) => (m.startsWith('Bearer') ? 'Bearer ***' : '***'))
}

/** Strip credentials from a URL so diagnostics never carry the key. */
export function redactUrl(value: string): string {
  try {
    const u = new URL(value)
    u.search = ''
    return u.toString()
  } catch {
    return redact(value)
  }
}

export interface RawErrorBody {
  error?: {
    message?: unknown
    type?: unknown
    param?: unknown
    code?: unknown
    metadata?: { error_type?: unknown }
  }
}

function bodyToKind(e: NonNullable<RawErrorBody['error']>): AiErrorKind {
  const code = e.code
  const type = e.type
  const errorType = (e.metadata as { error_type?: string } | undefined)?.error_type

  // OpenRouter: numeric code + metadata.error_type.
  if (typeof code === 'number' && typeof errorType === 'string') {
    switch (errorType) {
      case 'authentication_error':
      case 'invalid_credentials':
      case 'invalid_api_key':
        return 'auth'
      case 'permission_error':
        return 'permission'
      case 'insufficient_quota':
        return 'quota'
      case 'rate_limit_exceeded':
        return 'rate_limit'
      case 'invalid_request_error':
        return 'bad_request'
      case 'provider_error':
        return 'provider'
      case 'not_found':
        return 'not_found'
      default:
        return code >= 500 ? 'overloaded' : 'provider'
    }
  }

  // OpenAI: error.type.
  switch (type) {
    case 'invalid_request_error':
      return 'bad_request'
    case 'authentication_error':
      return 'auth'
    case 'permission_error':
      return 'permission'
    case 'insufficient_quota':
      return 'quota'
    case 'rate_limit_error':
    case 'tokens_exceeded':
      return 'rate_limit'
    case 'server_error':
      return 'overloaded'
    case 'content_policy_violation':
      return 'content_filter'
    case 'not_found_error':
      return 'not_found'
    default:
      if (code === 'invalid_api_key') return 'auth'
      if (code === 'insufficient_quota') return 'quota'
      return 'unknown'
  }
}

function messageFromBody(e: { message?: unknown }): string {
  if (typeof e?.message === 'string') return redact(e.message)
  if (e?.message && typeof e.message === 'object') {
    try {
      return redact(JSON.stringify(e.message))
    } catch {
      return 'The service returned an error.'
    }
  }
  return 'The service returned an error.'
}

/** Map a non-OK HTTP status to a kind. */
function statusToKind(status: number): AiErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 402) return 'quota'
  if (status === 429) return 'rate_limit'
  if (status === 400) return 'bad_request'
  if (status === 404 || status === 405) return 'not_found'
  if (status >= 500) return 'overloaded'
  if (status >= 400) return 'provider'
  return 'unknown'
}

/** Sync mapping for a thrown fetch error (no Response available). */
export function mapThrownError(err: Error): AiError {
  if (err instanceof TypeError) {
    // A TypeError means fetch rejected without a response: a cross-origin policy block or no
    // network. Offline is reported when the browser believes it is offline (D12).
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return new AiError(
      offline ? 'network' : 'cors',
      'The request from the browser was not allowed (cross-origin) or the service is unreachable.',
      null,
    )
  }
  if (err.name === 'TimeoutError' || /timed? ?out/i.test(err.message)) {
    return new AiError('timeout', redact(err.message), null)
  }
  return new AiError('unknown', redact(err.message), null)
}

/** Async mapping for a non-OK Response. */
export async function normalizeResponseError(response: Response): Promise<AiError> {
  const status = response.status
  let bodyText: string | null = null
  try {
    bodyText = await response.text()
  } catch {
    bodyText = null
  }
  let body: RawErrorBody | null = null
  try {
    body = bodyText ? (JSON.parse(bodyText) as RawErrorBody) : null
  } catch {
    body = null
  }
  if (body?.error) {
    return new AiError(bodyToKind(body.error), messageFromBody(body.error), status)
  }
  const kind = statusToKind(status)
  const hint =
    status === 401 || status === 403
      ? 'The service rejected the key.'
      : status === 429
        ? 'The service is rate limiting, try again in a moment.'
        : ''
  const message = bodyText ? redact(bodyText.slice(0, 200)) : hint || `The service answered with HTTP ${status}.`
  return new AiError(kind, message || hint, status)
}

/** Sync mapping for a parsed error body (incl. an HTTP 200 response carrying `error`). */
export function normalizeBodyError(body: unknown, status: number): AiError {
  const raw = body as RawErrorBody | null
  if (raw?.error) {
    return new AiError(bodyToKind(raw.error), messageFromBody(raw.error), status)
  }
  return new AiError('provider', 'The service answered in an unexpected format.', status)
}