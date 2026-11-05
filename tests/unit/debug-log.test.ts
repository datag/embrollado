import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  classifyKind,
  clearDebugLog,
  debugLogEntries,
  debugLogStatus,
  debugPersistenceFailed,
  formatJsonText,
  formatSseText,
  logRequest,
  logResponse,
  truncateLongStrings,
} from '@/ai/debugLog'
import { readDebugDocument, readDebugEntries, writeDebugEntries } from '@/data/debugSession'
import type { DebugLogEntry } from '@/ai/debugLog'

const SECRET = 'sk-testsecret-123'

/** A stored log entry of a given payload size (for the storage-budget tests). */
function makeEntry(i: number, payloadSize: number): DebugLogEntry {
  return {
    id: `entry-${i}`,
    seq: i + 1,
    direction: 'request',
    timestamp: 1_700_000_000_000 + i,
    kind: 'chat',
    method: 'POST',
    path: '/v1/chat/completions',
    status: null,
    durationMs: null,
    headers: {},
    payload: 'x'.repeat(payloadSize),
  }
}

beforeEach(() => clearDebugLog())

describe('debug log helpers', () => {
  it('classifies a URL into chat / tts / image / other', () => {
    expect(classifyKind('https://x/v1/chat/completions')).toBe('chat')
    expect(classifyKind('https://x/v1/audio/speech')).toBe('tts')
    expect(classifyKind('https://x/v1/images/generations')).toBe('image')
    expect(classifyKind('https://x/v1/images')).toBe('image')
    expect(classifyKind('https://x/v1/models')).toBe('other')
  })

  it('truncates a value under a base64 field as 5 + <TRUNCATED> + 5', () => {
    const b64 = 'A'.repeat(3000)
    const out = (truncateLongStrings({ b64_json: b64 }) as Record<string, unknown>)[
      'b64_json'
    ] as string
    expect(out).toBe('AAAAA<TRUNCATED>AAAAA')
  })

  it('keeps a long prose string intact when it is not under a binary field (regression)', () => {
    const text = 'Das ist ein langer Text '.repeat(100) // ~2400 chars
    const out = (truncateLongStrings({ content: text }) as Record<string, unknown>)[
      'content'
    ] as string
    expect(out).toBe(text)
    expect(out).not.toContain('<TRUNCATED>')
  })

  it('truncates a value over the safety net under any field name', () => {
    const out = (truncateLongStrings({ content: 'x'.repeat(60_000) }) as Record<string, unknown>)
      .content as string
    expect(out).toBe('xxxxx<TRUNCATED>xxxxx')
  })

  it('truncates array items under a base64-like field', () => {
    const out = (truncateLongStrings({ b64: ['Y'.repeat(200), 'z'] }) as Record<string, unknown>)
      .b64 as unknown[]
    expect(out[0]).toBe('YYYYY<TRUNCATED>YYYYY')
    expect(out[1]).toBe('z') // short value untouched
  })

  it('formatJsonText keeps long text fields intact and pretty-prints', () => {
    const long = 'Antwort '.repeat(400) // ~2880 chars
    const text = formatJsonText(JSON.stringify({ content: long, nested: { ok: true } }))
    expect(text).toContain(long)
    expect(text).toContain('"nested"')
    expect(text).not.toContain('<TRUNCATED>')
  })

  it('formats an SSE body into a JSON array of frames', () => {
    const body = 'data: {"a":1}\n\ndata: {"a":2}\n\ndata: [DONE]\n\n'
    const out = formatSseText(body)
    expect(out).toContain('"a": 1')
    expect(out).toContain('"a": 2')
    expect(out).not.toContain('[DONE]')
  })
})

describe('request logging', () => {
  it('logs a request with redacted credential headers and a formatted payload', () => {
    logRequest('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ model: 'gpt', messages: [] }),
    })
    const entry = debugLogEntries()[0]
    expect(entry).toBeDefined()
    expect(entry.direction).toBe('request')
    expect(entry.kind).toBe('chat')
    expect(entry.method).toBe('POST')
    expect(entry.path).toBe('/v1/chat/completions')
    expect(entry.status).toBeNull()
    expect(entry.headers.authorization).toBe('Bearer <REDACTED>')
    expect(entry.payload).toContain('"model"')
  })

  it('reports the actual bearer token as <REDACTED>, not as raw text', () => {
    logRequest('https://api.example.com/v1/chat/completions', {
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(JSON.stringify(debugLogEntries()[0].headers)).not.toContain(SECRET)
  })
})

describe('response logging', () => {
  it('formats a JSON response and scrubs the bearer key from the body', async () => {
    const res = new Response(
      JSON.stringify({ choices: [{ message: { content: `hi ${SECRET} done` } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
    await logResponse(
      'https://api.example.com/v1/chat/completions',
      { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } },
      res,
      performance.now(),
    )
    const entry = debugLogEntries()[0]
    expect(entry.direction).toBe('response')
    expect(entry.status).toBe(200)
    expect(entry.kind).toBe('chat')
    expect(entry.payload).toContain('hi')
    expect(entry.payload).not.toContain(SECRET)
    // REGRESSION (bug): a response entry shows the RESPONSE headers, not the request's.
    expect(entry.headers['content-type']).toBe('application/json')
    expect(entry.headers['authorization']).toBeUndefined()
  })

  it('formats an SSE response into its parsed frames', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: [DONE]\n\n'
    const res = new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    await logResponse(
      'https://api.example.com/v1/chat/completions',
      { headers: {} },
      res,
      performance.now(),
    )
    const entry = debugLogEntries()[0]
    expect(entry.payload).toContain('"content": "A"')
    expect(entry.payload).not.toContain('[DONE]')
  })

  it('never buffers a binary body — reports it as a <binary> placeholder', async () => {
    const res = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    })
    await logResponse(
      'https://api.example.com/v1/audio/speech',
      { method: 'POST', headers: {} },
      res,
      performance.now(),
    )
    const entry = debugLogEntries()[0]
    expect(entry.kind).toBe('tts')
    expect(entry.payload.startsWith('<binary audio/mpeg')).toBe(true)
  })
})

describe('debug log chronology', () => {
  beforeEach(() => clearDebugLog())

  it('orders by event time, not by when the response body finished reading', async () => {
    vi.useFakeTimers()
    try {
      // Request A is sent first.
      vi.setSystemTime(1000)
      logRequest('https://api.example.com/v1/chat/completions', { method: 'POST', headers: {} })

      // Request B is sent later.
      vi.setSystemTime(2000)
      logRequest('https://api.example.com/v1/images', { method: 'POST', headers: {} })

      // The response to A arrives at t=1500 (before B), but its body is read/flushed LAST — only
      // now, after B is already in the log. It must still be sorted between A and B by its time.
      vi.setSystemTime(1500)
      const res = new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
      await logResponse(
        'https://api.example.com/v1/chat/completions',
        { method: 'POST', headers: {} },
        res,
        performance.now(),
      )

      // Newest first, strictly by timestamp — the response (1500) sits between B (2000) and A (1000),
      // even though it was pushed last.
      expect(debugLogEntries().map((e) => e.timestamp)).toEqual([2000, 1500, 1000])
    } finally {
      vi.useRealTimers()
      clearDebugLog()
    }
  })

  it('uses the seq counter to break timestamp ties (later event wins)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(5000)
      logRequest('https://api.example.com/v1/chat/completions', { method: 'POST', headers: {} })
      const res = new Response(JSON.stringify({ n: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
      await logResponse(
        'https://api.example.com/v1/chat/completions',
        { method: 'POST', headers: {} },
        res,
        performance.now(),
      )

      // Two entries share the same timestamp; the response (seq 2) is newer than the request (seq 1).
      const entries = debugLogEntries()
      expect(entries[0].direction).toBe('response')
      expect(entries[0].seq).toBeGreaterThan(entries[1].seq)
    } finally {
      vi.useRealTimers()
      clearDebugLog()
    }
  })
})

describe('debug log persistence (sessionStorage)', () => {
  beforeEach(() => clearDebugLog())

  it('persists entries so they can be read back after a reload', () => {
    logRequest('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ model: 'gpt' }),
    })
    const persisted = readDebugEntries()
    expect(persisted).toHaveLength(1)
    expect(persisted[0].direction).toBe('request')
    expect(persisted[0].path).toBe('/v1/chat/completions')
  })

  it('keeps working in memory and flags persistence failure when storage is blocked', () => {
    const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      logRequest('https://api.example.com/v1/chat/completions', {
        method: 'POST',
        headers: {},
      })
      expect(debugLogEntries()).toHaveLength(1) // still in memory
      expect(debugPersistenceFailed()).toBe(true)
    } finally {
      spy.mockRestore()
      clearDebugLog()
    }
  })

  it('caps the live log by entry count and keeps the persisted copy within the byte budget', () => {
    for (let i = 0; i < 200; i++) {
      logRequest('https://api.example.com/v1/chat/completions', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ big: 'x'.repeat(1000), i }),
      })
    }
    expect(debugLogEntries()).toHaveLength(100) // the live log keeps 100 entries …
    expect(debugLogStatus().dropped).toBe(100) // … and says how many it had to drop
    const bytes = JSON.stringify(readDebugEntries()).length
    expect(bytes).toBeLessThan(256 * 1024)
  })

  it('keeps every entry in memory when the persisted copy hits the byte budget (regression)', () => {
    // A real dialogue fills the budget quickly: every chat request carries the whole system prompt
    // plus the history. The byte budget protects the STORAGE — it must NOT shorten the live log,
    // or the session's earlier requests silently vanish from the panel mid-dialogue.
    for (let i = 0; i < 40; i++) {
      logRequest('https://api.example.com/v1/chat/completions', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ big: 'x'.repeat(20_000), i }),
      })
    }

    // The live log still holds the whole session …
    expect(debugLogEntries()).toHaveLength(40)
    // … while the persisted copy is trimmed to the byte budget (oldest first).
    const persisted = readDebugEntries()
    expect(persisted.length).toBeLessThan(40)
    expect(JSON.stringify(persisted).length).toBeLessThanOrEqual(256 * 1024)
    // The panel can explain the difference.
    const status = debugLogStatus()
    expect(status.notPersisted).toBe(40 - persisted.length)
    expect(status.persistedCount).toBe(persisted.length)
    // The counters survive a reload, so the panel still explains the shortened log afterwards.
    const doc = readDebugDocument()
    expect(doc.trimmed).toBe(status.notPersisted)
    expect(doc.dropped).toBe(0)
  })

  it('stores the entry-count drops so a reload can still explain the shortened log', () => {
    for (let i = 0; i < 120; i++) {
      logRequest('https://api.example.com/v1/chat/completions', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ i }),
      })
    }
    expect(debugLogEntries()).toHaveLength(100)
    expect(debugLogStatus().dropped).toBe(20)
    expect(readDebugDocument().dropped).toBe(20)
  })

  it('never lowers the count of lost entries, even when the stored list shrinks afterwards', () => {
    const many = Array.from({ length: 40 }, (_, i) => makeEntry(i, 20_000))
    const first = writeDebugEntries(many, 0, 0)
    expect(first.trimmed).toBeGreaterThan(0)

    // A reload restores only what fit — the next write must not pretend that nothing was lost.
    const second = writeDebugEntries(first.entries, 0, first.trimmed)
    expect(second.trimmed).toBe(first.trimmed)
    expect(readDebugDocument().trimmed).toBe(first.trimmed)
  })
})
