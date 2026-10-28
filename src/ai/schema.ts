/**
 * The strict JSON schema of one turn (T048; contracts/turn-payload.md §2). Sent via
 * `response_format.json_schema` with `strict: true`. Every property is required (strict mode
 * forbids optional properties — a missing field is expressed as `null`).
 */

export const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'partnerText',
    'translation',
    'explanation',
    'correctedText',
    'interpretation',
    'assumptions',
    'badge',
    'issues',
  ],
  properties: {
    partnerText: { type: 'string' },
    translation: { type: 'string' },
    explanation: { type: ['string', 'null'] },
    correctedText: { type: ['string', 'null'] },
    interpretation: { type: 'string' },
    assumptions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['original', 'filled', 'reason'],
        properties: {
          original: { type: 'string' },
          filled: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    badge: {
      type: 'object',
      additionalProperties: false,
      required: ['tier', 'labelKey'],
      properties: {
        tier: { type: 'string', enum: ['perfect', 'good', 'acceptable', 'unsatisfactory'] },
        labelKey: { type: 'string' },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'detail', 'suggestion'],
        properties: {
          category: { type: 'string', enum: ['grammar', 'vocabulary', 'usage', 'completeness'] },
          detail: { type: 'string' },
          suggestion: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const

/** The "Explain to me" schema (turn-payload.md §5). */
export const EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'content'],
  properties: {
    kind: { type: 'string', enum: ['semantics', 'error', 'both'] },
    content: { type: 'string' },
  },
} as const

/** The test-connection schema — a one-word completion for "Test the connection" (T073). */
export const CONNECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply'],
  properties: {
    reply: { type: 'string' },
  },
} as const

export type SchemaObject = Record<string, unknown>

/** Build the `response_format` value for a profile (D13: schema placement differs). */
export function buildResponseFormat(
  name: string,
  schema: SchemaObject,
  placement: 'nested' | 'sibling',
): unknown {
  if (placement === 'sibling') {
    // llama.cpp documents the schema as a sibling of type; send both in case it switches.
    return {
      type: 'json_schema',
      json_schema: { name, strict: true, schema },
      schema,
    }
  }
  return {
    type: 'json_schema',
    json_schema: { name, strict: true, schema },
  }
}

/** The `json_object` fallback (ai-service.md §3) — the schema is embedded in the prompt. */
export const FALLBACK_RESPONSE_FORMAT = { type: 'json_object' } as const
