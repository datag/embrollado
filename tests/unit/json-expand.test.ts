import { describe, expect, it } from 'vitest'
import { expandEmbeddedJson } from '@/utils/jsonExpand'

describe('expandEmbeddedJson (debug panel)', () => {
  it('unfolds an embedded JSON object string into a nested block', () => {
    const payload = JSON.stringify({
      content: JSON.stringify({ partnerText: 'Hi', n: 1, ok: true }),
      id: 'x',
    })
    const out = expandEmbeddedJson(payload)
    // the content value is now an unescaped, indented object
    expect(out).toContain('"content": {')
    expect(out).toContain('"partnerText": "Hi"')
    expect(out).toContain('"n": 1')
    // no escaped quotes remain for the embedded object
    expect(out).not.toContain('\\"partnerText\\"')
  })

  it('unfolds an embedded array', () => {
    const payload = JSON.stringify({ list: JSON.stringify(['a', 'b']) })
    const out = expandEmbeddedJson(payload)
    expect(out).toContain('"list": [')
    expect(out).toContain('"a"')
    expect(out).toContain('"b"')
  })

  it('leaves ordinary strings and scalars untouched', () => {
    const payload = JSON.stringify({ a: 'hello', b: 1, c: '123' })
    const out = expandEmbeddedJson(payload)
    expect(out).toContain('"hello"')
    expect(out).toContain('"123"')
    expect(out).toContain('1')
  })

  it('returns the payload unchanged when it is not parseable JSON', () => {
    const s = 'not json at all'
    expect(expandEmbeddedJson(s)).toBe(s)
  })
})
