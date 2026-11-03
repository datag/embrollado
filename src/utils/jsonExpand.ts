/**
 * Display-only expansion of embedded JSON (the debug panel's "aufklappen" toggle). Model responses
 * put a whole JSON object into a single escaped string (the `content` field), which is nearly
 * unreadable as one long line. When a string value is itself a parseable JSON object/array, this
 * renders it as a nested, indented block in place of the string.
 *
 * The result is NOT byte-equal to the stored payload (an embedded object replaces a quoted string),
 * so it is display-only and never persisted or copied as data — the raw view remains available.
 * The caller tokenises the result through `tokenizeJsonForDisplay` so it highlights as usual.
 */

/** Cheap detection so we never parse scalar/plain text as embedded JSON. */
function parseEmbedded(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Render one value to an indented, JSON-like text block. */
function render(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'boolean' || type === 'number') return String(value)
  if (type === 'string') {
    const inner = parseEmbedded(value as string)
    if (inner !== null && (Array.isArray(inner) || Object.keys(inner as object).length > 0)) {
      return render(inner, indent)
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const body = value.map((v) => `${pad}  ${render(v, indent + 1)}`).join(',\n')
    return `[\n${body}\n${'  '.repeat(indent)}]`
  }
  if (type === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return '{}'
    const body = keys
      .map((k) => `${pad}  ${JSON.stringify(k)}: ${render(obj[k], indent + 1)}`)
      .join(',\n')
    return `{\n${body}\n${'  '.repeat(indent)}}`
  }
  return JSON.stringify(value)
}

/** Expand embedded JSON objects/arrays in a payload for display; unchanged when not parseable. */
export function expandEmbeddedJson(payload: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return payload
  }
  return render(parsed, 0)
}
