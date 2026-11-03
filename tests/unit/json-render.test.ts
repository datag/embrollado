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

  it('renders a multi-line decoded string as a decoded token on its own line', () => {
    const value = { content: 'line1\nline2\nline3' }
    const tokens = renderJsonValue(value, true)
    const decoded = tokens.find((t) => t.type === 'decoded')!
    expect(decoded).toBeTruthy()
    expect(decoded.text).toBe('line1\nline2\nline3')
    // there is leading whitespace so the box starts on its own indented line
    const ws = tokens.find((t) => t.type === 'whitespace')
    expect(ws?.text).toMatch(/\n\s+/)
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
})
