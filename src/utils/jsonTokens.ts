/**
 * Tokenisation of pretty-printed JSON for syntax highlighting (debug panel). The JSON shown here is
 * the app's own capture — valid JSON emitted from `JSON.stringify`, already truncated by the store —
 * but the tokenizer is defensive: malformed fragments degrade to a plain "text" token instead of
 * failing.
 *
 * Tokens are rendered as isolated `<span>`s in JsonCode.vue — no `v-html`, so no interaction with
 * the DOMPurify path and no XSS surface (constitution Principle III).
 */

export type JsonTokenType =
  'key' | 'string' | 'number' | 'literal' | 'punct' | 'whitespace' | 'text'

export interface JsonToken {
  type: JsonTokenType
  text: string
}

const LITERALS = new Set(['true', 'false', 'null'])

/** Classify a string literal: it is an object key when the next non-space char is `:`. */
function isKeyPosition(code: string, end: number): boolean {
  let j = end
  while (j < code.length && (code[j] === ' ' || code[j] === '\n')) j++
  return j < code.length && code[j] === ':'
}

/**
 * Split a JSON string into tokens. Only string literals and braces, brackets, colons and commas
 * are recognised structurally; numbers and literals are matched opportunistically. Everything else
 * (including malformed text) is emitted as one "text" token.
 */
export function tokenizeJson(code: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let i = 0
  const push = (type: JsonTokenType, text: string) => {
    if (!text) return
    const prev = tokens[tokens.length - 1]
    if (prev && prev.type === type && (type === 'whitespace' || type === 'text')) {
      prev.text += text
    } else {
      tokens.push({ type, text })
    }
  }

  while (i < code.length) {
    const ch = code[i]

    if (ch === '"') {
      // Read a full JSON string literal honouring backslash escapes.
      let j = i + 1
      let escaped = false
      while (j < code.length) {
        const c = code[j]
        if (escaped) {
          escaped = false
        } else if (c === '\\') {
          escaped = true
        } else if (c === '"') {
          break
        }
        j++
      }
      const end = j < code.length ? j + 1 : code.length // include the closing quote if present
      push(isKeyPosition(code, end) ? 'key' : 'string', code.slice(i, end))
      i = end
      continue
    }

    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ':' || ch === ',') {
      push('punct', ch)
      i++
      continue
    }

    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      let j = i
      while (j < code.length && /\s/.test(code[j])) j++
      push('whitespace', code.slice(i, j))
      i = j
      continue
    }

    // Number or literal, opportunistically until a delimiter.
    if (ch === '-' || ch === '+' || /\d/.test(ch)) {
      let j = i
      while (j < code.length && /[0-9eE+\-.]/.test(code[j])) j++
      const text = code.slice(i, j)
      if (text && !/[a-zA-Z]/.test(text)) {
        push('number', text)
        i = j
        continue
      }
    }

    // Literals and anything else — a raw coalescing token.
    let j = i
    while (j < code.length && code[j] !== '"' && !'{}[],:'.includes(code[j]) && !/\s/.test(code[j]))
      j++
    const text = code.slice(i, j)
    if (LITERALS.has(text)) push('literal', text)
    else push('text', text)
    i = j
  }

  return tokens
}

/** Tokenise for display. Values were truncated at capture time by the debug store. */
export function tokenizeJsonForDisplay(code: string): JsonToken[] {
  return tokenizeJson(code)
}
