import { describe, expect, it } from 'vitest'
import { chatCompletion, growingStringValue } from '@/ai/aiService'
import type { ServiceConfig } from '@/domain/types'

/**
 * The progressive partner line (FR-035, SC-012, T127).
 *
 * The turn is one JSON document; only its `partnerText` string may be rendered while the stream
 * runs. Two things must hold:
 *  1. the adapter hands the CALLER the model's text — not the raw SSE frame — otherwise the
 *     accumulated text is a JSON-of-JSON and the field can never be found;
 *  2. the partial value of `partnerText` must match the final, parsed value character by
 *     character (SC-012), so JSON escapes decode as soon as they complete.
 */

const SERVICE: ServiceConfig = {
  baseUrl: 'http://localhost:8787/v1',
  apiKey: 'test',
  authMode: 'bearer',
  chatModel: 'mock-chat',
  speechModel: null,
  speechVoice: null,
  imageModel: null,
  providerProfile: 'openai',
}

const TURN = {
  partnerText: 'Hello! Nice to meet you. Where do you come from?',
  translation: 'Hallo! Schön, dich zu treffen. Woher kommst du?',
  explanation: 'Deine Antwort ist verständlich.',
  correctedText: null,
  interpretation: 'Woher kommst du?',
  assumptions: [],
  badge: { tier: 'good', labelKey: 'good.1' },
  issues: [],
}

/** A fake OpenAI-compatible SSE endpoint that streams `text` in `pieces`. */
function sseEndpoint(text: string, pieces: number): Response {
  const slice = Math.max(1, Math.ceil(text.length / pieces))
  const body: string[] = []
  for (let offset = 0; offset < text.length; offset += slice) {
    const piece = text.slice(offset, offset + slice)
    body.push(
      `data: ${JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
      })}\n\n`,
    )
  }
  body.push('data: [DONE]\n\n')
  return new Response(body.join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function stubFetch(handler: () => Response | Promise<Response>) {
  const original = globalThis.fetch
  globalThis.fetch = (async () => handler()) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

describe('progressive partner line (FR-035, SC-012, T127)', () => {
  it('hands the caller the model text, not the raw SSE frame', async () => {
    const restore = stubFetch(() => sseEndpoint(JSON.stringify(TURN), 8))
    try {
      const deltas: string[] = []
      const result = await chatCompletion({
        service: SERVICE,
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
        onDelta: (text) => deltas.push(text),
      })
      // The deltas are the model's text — the accumulated result is the JSON document itself.
      expect(deltas.join('')).toBe(JSON.stringify(TURN))
      expect(deltas.join('')).toContain('"partnerText"')
      expect(result.content).toBe(JSON.stringify(TURN))
    } finally {
      restore()
    }
  })

  it('grows the partner line step by step and ends at the final value', async () => {
    const restore = stubFetch(() => sseEndpoint(JSON.stringify(TURN), 8))
    try {
      const seen: string[] = []
      let acc = ''
      await chatCompletion({
        service: SERVICE,
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
        onDelta: (text) => {
          acc += text
          seen.push(growingStringValue(acc, 'partnerText'))
        },
      })
      // The line only grows, and the last step equals the final, parsed value (SC-012).
      expect(seen.length).toBeGreaterThan(1)
      expect(seen[0].length).toBeGreaterThan(0)
      expect(seen[seen.length - 1]).toBe(TURN.partnerText)
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i].length).toBeGreaterThanOrEqual(seen[i - 1].length)
        expect(TURN.partnerText.startsWith(seen[i])).toBe(true)
      }
    } finally {
      restore()
    }
  })

  it('finds nothing before the key has arrived', () => {
    expect(growingStringValue('', 'partnerText')).toBe('')
    expect(growingStringValue('{"partnerT', 'partnerText')).toBe('')
    expect(growingStringValue('{"partnerText":', 'partnerText')).toBe('')
    // A key without a string value (null) is not a line.
    expect(growingStringValue('{"partnerText":null}', 'partnerText')).toBe('')
  })

  it('tolerates whitespace after the colon', () => {
    expect(growingStringValue('{"partnerText": "Hello"}', 'partnerText')).toBe('Hello')
    expect(growingStringValue('{"partnerText"  :  "Hello"}', 'partnerText')).toBe('Hello')
  })

  it('decodes JSON escapes so the partial matches the parsed value', () => {
    expect(growingStringValue('{"partnerText":"a\\nb"}', 'partnerText')).toBe('a\nb')
    expect(growingStringValue('{"partnerText":"say \\"hi\\""}', 'partnerText')).toBe('say "hi"')
    expect(growingStringValue('{"partnerText":"a\\\\b"}', 'partnerText')).toBe('a\\b')
    expect(growingStringValue('{"partnerText":"\\u00e4"}', 'partnerText')).toBe('ä')
    // An escape cut by a chunk boundary stays raw until the next chunk completes it.
    expect(growingStringValue('{"partnerText":"\\u00', 'partnerText')).toBe('\\u00')
    expect(growingStringValue('{"partnerText":"\\u00e', 'partnerText')).toBe('\\u00e')
    // Four hex digits complete the escape — it decodes at once.
    expect(growingStringValue('{"partnerText":"\\u00e4', 'partnerText')).toBe('ä')
  })

  it('stops at the closing quote of the value', () => {
    expect(growingStringValue('{"partnerText":"Hi","translation":"Hallo"}', 'partnerText')).toBe(
      'Hi',
    )
  })
})
