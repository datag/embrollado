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
  | 'key'
  | 'string'
  | 'number'
  | 'literal'
  | 'punct'
  | 'whitespace'
  | 'text'
  /** A decoded string value shown unescaped (its own line, with a distinct box). */
  | 'decoded'

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

/* ------------------------------------------------------------------ */
/* Value-tree renderer (expanded mode)                                */
/* ------------------------------------------------------------------ */

/** A string whose value is itself a parseable JSON object/array (structural heuristic). */
export function embeddedJson(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) return parsed
  } catch {
    /* not JSON — treat as a plain string */
  }
  return null
}

/**
 * Render a parsed JSON value as tokens, staying structurally true (unlike the text tokenizer) so a
 * string value can be shown unescaped and/or on its own line without breaking the surrounding
 * structure. In expanded mode:
 *  - embedded JSON objects/arrays are unfolded into nested blocks;
 *  - string values of at least {@link BOX_MIN_CODE_POINTS} code points — or that contain a real
 *    line break — are emitted unquoted as a `decoded` box on their own line (prompt/response prose);
 *  - other string values are shown quoted with their escapes decoded.
 * In raw mode (`expanded: false`) it behaves like ordinary pretty JSON.
 */

/** Long string values are shown unquoted in a box when they reach this many code points. */
export const BOX_MIN_CODE_POINTS = 50

/** Length in Unicode code points (handles surrogate-pair emoji correctly). */
function codePointLength(s: string): number {
  let n = 0
  for (const _ of s) n++
  return n
}

/** Emit exactly one line break + indentation, so a box starts on its own line with no gap. */
function ensureOwnLine(push: (t: JsonTokenType, s: string) => void, depth: number): void {
  push('whitespace', '\n' + '  '.repeat(Math.max(0, depth + 1)))
}

export function renderJsonValue(value: unknown, expanded: boolean): JsonToken[] {
  const tokens: JsonToken[] = []
  const push = (type: JsonTokenType, text: string) => {
    if (text) tokens.push({ type, text })
  }
  const indent = (depth: number) => '  '.repeat(Math.max(0, depth))

  function emitValue(v: unknown, depth: number): void {
    if (v === null) {
      push('literal', 'null')
      return
    }
    const t = typeof v
    if (t === 'boolean') {
      push('literal', String(v))
      return
    }
    if (t === 'number') {
      push('number', String(v))
      return
    }
    if (t === 'string') {
      emitString(v as string, depth)
      return
    }
    if (Array.isArray(v)) {
      emitArray(v, depth)
      return
    }
    emitObject(v as Record<string, unknown>, depth)
  }

  function emitString(s: string, depth: number): void {
    const embedded = embeddedJson(s)
    if (embedded !== null) {
      emitValue(embedded, depth)
      return
    }
    if (!expanded) {
      push('string', JSON.stringify(s))
      return
    }
    if (codePointLength(s) >= BOX_MIN_CODE_POINTS || /[\n\r]/.test(s)) {
      // A long (or multi-line) string → a decoded box on its own line, unquoted.
      ensureOwnLine(push, depth)
      push('decoded', s)
      return
    }
    // Single-line with escapes → show decoded but keep it quoted so the value stays labelled.
    push('string', '"' + s + '"')
  }

  function emitArray(arr: unknown[], depth: number): void {
    push('punct', '[')
    if (arr.length === 0) {
      push('punct', ']')
      return
    }
    push('whitespace', '\n' + indent(depth + 1))
    arr.forEach((item, i) => {
      emitValue(item, depth + 1)
      // The item line-break goes BETWEEN items only, so no stray blank line precedes the closer.
      if (i < arr.length - 1) {
        push('punct', ',')
        push('whitespace', '\n' + indent(depth + 1))
      }
    })
    push('whitespace', '\n' + indent(depth))
    push('punct', ']')
  }

  function emitObject(obj: Record<string, unknown>, depth: number): void {
    push('punct', '{')
    const keys = Object.keys(obj)
    if (keys.length === 0) {
      push('punct', '}')
      return
    }
    push('whitespace', '\n' + indent(depth + 1))
    keys.forEach((k, i) => {
      push('key', JSON.stringify(k))
      push('punct', ': ')
      emitValue(obj[k], depth + 1)
      // The item line-break goes BETWEEN items only, so no stray blank line precedes the closer.
      if (i < keys.length - 1) {
        push('punct', ',')
        push('whitespace', '\n' + indent(depth + 1))
      }
    })
    push('whitespace', '\n' + indent(depth))
    push('punct', '}')
  }

  emitValue(value, 0)
  return tokens
}
