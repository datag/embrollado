import { describe, expect, it } from 'vitest'
import { tokenizeJsonForDisplay } from '@/utils/jsonTokens'

describe('json tokenizer (debug panel highlighting)', () => {
  it('tokenises keys, strings, punctuation and whitespace separately', () => {
    const tokens = tokenizeJsonForDisplay('{\n  "msg": "hi"\n}')
    const types = tokens.map((t) => t.type)
    expect(types).toContain('key')
    expect(types).toContain('string')
    expect(types).toContain('punct')
    expect(types).toContain('whitespace')
    // The object-key quote is a key, the value quote a string.
    const key = tokens.find((t) => t.type === 'key')!
    const value = tokens.find((t) => t.type === 'string')!
    expect(key.text).toBe('"msg"')
    expect(value.text).toBe('"hi"')
  })

  it('recognises numbers and literals', () => {
    const tokens = tokenizeJsonForDisplay('{"a": 1.5, "b": true, "c": null}')
    const joined = tokens.map((t) => t.text).join('')
    expect(joined).toContain('1.5')
    expect(tokens.some((t) => t.type === 'number')).toBe(true)
    expect(tokens.some((t) => t.type === 'literal')).toBe(true)
  })

  it('handles escaped quotes inside strings without leaking tokens', () => {
    const tokens = tokenizeJsonForDisplay('{"a": "say \\"hi\\""}')
    const values = tokens.filter((t) => t.type === 'string').map((t) => t.text)
    expect(values).toEqual(['"say \\"hi\\""'])
  })

  it('degrades a malformed fragment to text tokens instead of throwing', () => {
    const tokens = tokenizeJsonForDisplay('not json { broken')
    expect(Array.isArray(tokens)).toBe(true)
    expect(tokens.some((t) => t.type === 'text')).toBe(true)
  })

  it('reconstructs the original source when concatenated', () => {
    const src = '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}],"stream":true}'
    const pretty = JSON.stringify(JSON.parse(src), null, 2)
    expect(
      tokenizeJsonForDisplay(pretty)
        .map((t) => t.text)
        .join(''),
    ).toBe(pretty)
  })
})
