import { describe, expect, it } from 'vitest'
import {
  mapThrownError,
  normalizeResponseError,
  normalizeBodyError,
  redact,
  redactUrl,
} from '@/ai/errors'
import { AiError } from '@/domain/types'

describe('error normaliser (T044, T022)', () => {
  it('maps the OpenAI error shape', async () => {
    const res = new Response(
      JSON.stringify({
        error: {
          message: 'Incorrect API key provided',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      }),
      { status: 401 },
    )
    const err = await normalizeResponseError(res)
    expect(err).toBeInstanceOf(AiError)
    expect(err.kind).toBe('auth')
  })

  it('maps the OpenRouter error shape', async () => {
    const res = new Response(
      JSON.stringify({
        error: {
          code: 429,
          message: 'Rate limit',
          metadata: { error_type: 'rate_limit_exceeded' },
        },
      }),
      { status: 429 },
    )
    const err = await normalizeResponseError(res)
    expect(err.kind).toBe('rate_limit')
  })

  it('maps an error body returned with HTTP 200 (OpenRouter)', () => {
    const err = normalizeBodyError(
      {
        error: {
          code: 429,
          message: 'Rate limited',
          metadata: { error_type: 'rate_limit_exceeded' },
        },
      },
      200,
    )
    expect(err.kind).toBe('rate_limit')
  })

  it('maps a TypeError to cors (or network when the browser is offline)', () => {
    const err = mapThrownError(new TypeError('Failed to fetch'))
    expect(err.kind).toBe('cors')
    expect(err.status).toBeNull()
  })

  it('maps HTTP 5xx to overloaded', async () => {
    const err = await normalizeResponseError(new Response('boom', { status: 503 }))
    expect(err.kind).toBe('overloaded')
  })

  it('redacts the API key from messages and URLs', () => {
    const secret = 'sk-' + 'a'.repeat(20)
    expect(redact(`key ${secret} used`)).not.toContain(secret)
    expect(redactUrl(`https://api.example.com/v1?key=${secret}`)).not.toContain(secret)
    expect(redactUrl(`https://api.example.com/v1?key=${secret}`)).not.toContain('?key=')
  })

  it('never emits the raw key in a message', async () => {
    const secret = 'sk-proj-secret-abcdef'
    const res = new Response(
      JSON.stringify({ error: { message: `bad key ${secret}`, type: 'invalid_request_error' } }),
      { status: 401 },
    )
    const err = await normalizeResponseError(res)
    expect(err.message).not.toContain(secret)
  })
})
