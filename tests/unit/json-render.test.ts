import { describe, expect, it } from 'vitest'
import { renderJsonValue, embeddedJson, type JsonToken } from '@/utils/jsonTokens'

function texts(tokens: JsonToken[]): string {
  return tokens.map((t) => t.text).join('')
}

describe('embeddedJson (structural heuristic)', () => {
  it('recognises an embedded object and array', () => {
    expect(embeddedJson('{"a":1}')).toEqual({ a: 1 })
    expect(embeddedJson('[1,2]')).toEqual([1, 2])
  })

  it('rejects scalars, plain text and malformed JSON', () => {
    expect(embeddedJson('123')).toBeNull()
    expect(embeddedJson('hello')).toBeNull()
    expect(embeddedJson('{"unterminated')).toBeNull()
    expect(embeddedJson('null')).toBeNull()
  })
})

describe('renderJsonValue (expanded)', () => {
  it('unfolds an embedded JSON object string into a nested block', () => {
    const value = {
      content: JSON.stringify({ partnerText: 'Hi', n: 1 }),
      id: 'x',
    }
    const out = texts(renderJsonValue(value, true))
    expect(out).toContain('"content":')
    expect(out).toContain('"partnerText": "Hi"')
    expect(out).toContain('"n": 1')
  })

  it('renders a multi-line decoded string as a decoded token, inline after the key', () => {
    const value = { content: 'line1\nline2\nline3' }
    const tokens = renderJsonValue(value, true)
    const decoded = tokens.find((t) => t.type === 'decoded')!
    expect(decoded).toBeTruthy()
    expect(decoded.text).toBe('line1\nline2\nline3')
    // No leading line-break token is emitted, so the box flows right after ": " (no own-line gap).
    const idx = tokens.indexOf(decoded)
    const prev = tokens[idx - 1]
    expect(prev?.type).toBe('punct')
    expect(prev?.text).toBe(': ')
  })

  it('renders a single-line string with escapes decoded but quoted', () => {
    const value = { content: 'a "b" c' }
    const tokens = renderJsonValue(value, true)
    expect(tokens.some((t) => t.type === 'decoded')).toBe(false)
    const s = tokens.find((t) => t.type === 'string')
    expect(s?.text).toBe('"a "b" c"') // quotes preserved, no backslash-escape
  })

  it('keeps a plain string fully quoted and unchanged', () => {
    const tokens = renderJsonValue({ msg: 'hello' }, true)
    const s = tokens.find((t) => t.type === 'string')
    expect(s?.text).toBe('"hello"')
  })

  it('raw mode renders ordinary pretty JSON without decoding', () => {
    const value = { content: 'a "b"\nnext' }
    const tokens = renderJsonValue(value, false)
    expect(tokens.some((t) => t.type === 'decoded')).toBe(false)
    expect(texts(tokens)).toContain('"a \\"b\\"\\nnext"')
  })

  it('renders primitives and punctuation structurally', () => {
    const out = texts(renderJsonValue({ n: 1.5, ok: true, none: null, arr: [1, 'x'] }, true))
    expect(out).toContain('"n": 1.5')
    expect(out).toContain('"ok": true')
    expect(out).toContain('"none": null')
    expect(out).toContain('"arr": [')
  })

  it('matches JSON.stringify for escape-free payloads (no stray blank lines)', () => {
    const payload = {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'embrollado_scene',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['scene'],
            properties: { scene: { type: 'string' } },
          },
        },
      },
    }
    const pretty = JSON.stringify(payload, null, 2)
    expect(texts(renderJsonValue(payload, true))).toBe(pretty)
  })

  it('round-trips escape-free stored payloads unchanged', () => {
    const stored = JSON.stringify([
      { id: 'a', values: [1, 2, 3], map: { x: 1 } },
      { id: 'b', values: [], map: {} },
    ])
    const parsed = JSON.parse(stored) as unknown
    expect(texts(renderJsonValue(parsed, true))).toBe(JSON.stringify(parsed, null, 2))
  })

  it('boxes a long single-line string by code-point length (>= 50)', () => {
    const value = { content: 'x'.repeat(52) }
    const tokens = renderJsonValue(value, true)
    const decoded = tokens.find((t) => t.type === 'decoded')
    expect(decoded).toBeTruthy()
    expect(decoded!.text).toHaveLength(52)
  })

  it('keeps a short string below the code-point threshold unboxed', () => {
    const value = { content: 'x'.repeat(49) }
    const tokens = renderJsonValue(value, true)
    expect(tokens.some((t) => t.type === 'decoded')).toBe(false)
  })

  it('boxes by code points, not UTF-16 units', () => {
    // 49 emoji = 49 code points but 98 UTF-16 units — below the 50 code-point floor, so no box.
    const short = '😀'.repeat(49)
    expect(short.length).toBe(98) // would pass a unit-based >=50 check
    expect(renderJsonValue({ content: short }, true).some((t) => t.type === 'decoded')).toBe(false)
    // 50 emoji = 50 code points (100 units) → box.
    const long = '😀'.repeat(50)
    expect(renderJsonValue({ content: long }, true).some((t) => t.type === 'decoded')).toBe(true)
  })

  it('boxes a long string nested inside an unfolded structure', () => {
    const value = { outer: { content: 'y'.repeat(60) } }
    const tokens = renderJsonValue(value, true)
    expect(tokens.some((t) => t.type === 'decoded')).toBe(true)
  })

  it('raw mode never boxes long strings', () => {
    const value = { content: 'z'.repeat(80) }
    const tokens = renderJsonValue(value, false)
    expect(tokens.some((t) => t.type === 'decoded')).toBe(false)
  })

  it('never emits a blank structural line before/after a box', () => {
    const value = { messages: [{ role: 'system', content: 'p'.repeat(70) }], ok: true }
    const out = texts(renderJsonValue(value, true))
    // Frames tokens around a box: "content": , newline, decoded, newline, closer — never an empty
    // line (the box text itself here has no embedded blank lines).
    expect(out).not.toContain('\n\n')
  })
})
