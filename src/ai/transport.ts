import { AiError } from '@/domain/types'
import { mapThrownError, normalizeResponseError } from '@/ai/errors'

/**
 * The single `fetch` seam — every request the app makes leaves through `request()` (T021).
 * Also owns the defensive SSE parser (ai-service.md §5): the accumulated text is never parsed as
 * JSON while the stream runs, comment/keepalive frames are tolerated, and a partial buffer is
 * never parsed.
 */

function unexpectedFormat(status: number): AiError {
  return new AiError('provider', 'The service answered in an unexpected format.', status)
}

/** The one place that calls `fetch`. Resolves with the (checked) Response. */
export async function request(url: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    throw mapThrownError(err instanceof Error ? err : new Error(String(err)))
  }
  if (!response.ok) throw await normalizeResponseError(response)
  return response
}

/** Post JSON and return the parsed JSON body. */
export async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  })
  try {
    return (await response.json()) as T
  } catch {
    throw unexpectedFormat(response.status)
  }
}

export interface StreamResult {
  /** Every `data:` payload parsed as JSON, in order. */
  frames: unknown[]
  /** True when `data: [DONE]` (or the stream) terminated the response. */
  done: boolean
  /** True when the endpoint answered with a plain JSON body instead of SSE. */
  unstreamed: boolean
}

/** Post JSON and stream the SSE response; calls `onDelta` per `data:` payload line. */
export async function postStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  onDelta: (data: string) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    // The endpoint answered with a normal JSON body — the non-streamed fallback (FR-035).
    try {
      const parsed = await response.json()
      return { frames: [parsed], done: true, unstreamed: true }
    } catch {
      throw unexpectedFormat(response.status)
    }
  }

  return parseSSE(response, onDelta)
}

/**
 * Parse an SSE body defensively:
 *  - `:` comment frames (incl. keepalives) are ignored;
 *  - frames missing `choices` are tolerated (usage/keepalive frames);
 *  - only complete `data:` lines are parsed — a partial buffer is never JSON.parsed.
 */
export async function parseSSE(
  response: Response,
  onDelta: (data: string) => void,
): Promise<StreamResult> {
  if (!response.body) {
    return { frames: [], done: true, unstreamed: false }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const frames: unknown[] = []
  let buffer = ''
  let sawDone = false

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (;;) {
        const sep = buffer.indexOf('\n\n')
        if (sep === -1) break // wait for the rest of the frame
        const rawFrame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const dataLines = rawFrame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
        if (dataLines.length === 0) continue // comment / keepalive frame
        const payload = dataLines.join('\n')
        if (payload === '[DONE]') {
          sawDone = true
          continue
        }
        onDelta(payload)
        try {
          frames.push(JSON.parse(payload))
        } catch {
          // a non-JSON frame is tolerated and simply not recorded
        }
      }
    }
    // Flush a trailing frame that did not end with a blank line.
    if (buffer.includes('data:')) {
      const tail = buffer
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (tail && tail !== '[DONE]') {
        onDelta(tail)
        try {
          frames.push(JSON.parse(tail))
        } catch {
          /* tolerated */
        }
      } else if (tail === '[DONE]') {
        sawDone = true
      }
    }
  } finally {
    reader.releaseLock()
  }
  return { frames, done: sawDone, unstreamed: false }
}

/** Extract the assistant-text delta from a parsed SSE chunk (defensive). */
export function chunkText(chunk: unknown): string {
  const c = chunk as {
    choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>
  }
  const choice = c?.choices?.[0]
  if (!choice) return ''
  return choice.delta?.content ?? choice.message?.content ?? ''
}
