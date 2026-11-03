import { describe, expect, it, beforeEach } from 'vitest'
import {
  classifyKind,
  clearDebugLog,
  debugLogEntries,
  formatJsonText,
  formatSseText,
  logRequest,
  logResponse,
  truncateLongStrings,
} from '@/ai/debugLog'

const SECRET = 'sk-testsecret-123'

beforeEach(() => clearDebugLog())

describe('debug log helpers', () => {
  it('classifies a URL into chat / tts / image / other', () => {
    expect(classifyKind('https://x/v1/chat/completions')).toBe('chat')
    expect(classifyKind('https://x/v1/audio/speech')).toBe('tts')
    expect(classifyKind('https://x/v1/images/generations')).toBe('image')
    expect(classifyKind('https://x/v1/images')).toBe('image')
    expect(classifyKind('https://x/v1/models')).toBe('other')
  })

  it('truncates a long string as 5 + <TRUNCATED> + 5', () => {
    const long = 'a'.repeat(3000)
    const out = truncateLongStrings(long) as string
    expect(out).toBe('aaaaa<TRUNCATED>aaaaa')
  })

  it('truncates long strings recursively and serialises prettily', () => {
    const text = formatJsonText(
      JSON.stringify({ msg: 'x'.repeat(3000), nested: { ok: true, n: 1 } }),
    )
    expect(text).toContain('<TRUNCATED>')
    expect(text).toContain('"nested"')
    expect(text).toContain('    "ok": true')
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
      Date.now(),
    )
    const entry = debugLogEntries()[0]
    expect(entry.direction).toBe('response')
    expect(entry.status).toBe(200)
    expect(entry.kind).toBe('chat')
    expect(entry.payload).toContain('hi')
    expect(entry.payload).not.toContain(SECRET)
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
      Date.now(),
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
      Date.now(),
    )
    const entry = debugLogEntries()[0]
    expect(entry.kind).toBe('tts')
    expect(entry.payload.startsWith('<binary audio/mpeg')).toBe(true)
  })
})
