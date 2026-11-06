import { describe, expect, it } from 'vitest'
import { attributionHeaders, APP_CATEGORIES, APP_REFERER_URL, APP_TITLE } from '@/ai/attribution'
import { profileById } from '@/ai/providers'
import { authHeaders } from '@/ai/aiService'
import { DEFAULT_SERVICE } from '@/data/profile'

describe('attributionHeaders (FR-066)', () => {
  it('identifies the app at OpenRouter with the documented headers', () => {
    const headers = attributionHeaders(profileById('openrouter'))
    expect(headers['HTTP-Referer']).toBe(APP_REFERER_URL)
    expect(headers['X-OpenRouter-Title']).toBe(APP_TITLE)
    expect(headers['X-OpenRouter-Categories']).toBe(APP_CATEGORIES)
  })

  it('keeps the app out of the public rankings', () => {
    const headers = attributionHeaders(profileById('openrouter'))
    expect(headers['X-OpenRouter-App-Visibility']).toBe('hidden')
  })

  it('sends no attribution to a profile that does not allow the headers', () => {
    // A server that does not list them in its CORS preflight rejects the request outright —
    // Ollama, for example, allows only Authorization, Content-Type, User-Agent, Accept,
    // X-Requested-With, OpenAI-Beta and the x-stainless-* headers.
    for (const profile of ['openai', 'ollama', 'llamacpp', 'vllm', 'lmstudio', 'custom']) {
      expect(attributionHeaders(profileById(profile))).toEqual({})
    }
  })

  it('sends no attribution for an unknown profile', () => {
    expect(attributionHeaders(profileById('nope'))).toEqual({})
  })

  it('carries app constants only — nothing about the learner or the key', () => {
    const headers = attributionHeaders(profileById('openrouter'))
    const values = Object.values(headers).join(' ')
    expect(values).not.toContain('sk-or-v1-learner-secret')
    expect(values).not.toContain('localhost')
  })

  it('uses a stable canonical URL, not the origin of the learner’s installation', () => {
    // The origin would create one app entry per self-hosted copy and leak the local address.
    expect(APP_REFERER_URL).toMatch(/^https:\/\/[^/]+\//)
    expect(APP_REFERER_URL).not.toContain('127.0.0.1')
  })
})

describe('authHeaders with the attribution (FR-066)', () => {
  const service = { ...DEFAULT_SERVICE, apiKey: 'sk-test-key', providerProfile: 'openrouter' }

  it('keeps the auth header and adds the attribution', () => {
    const headers = authHeaders(service, profileById('openrouter'))
    expect(headers.authorization).toBe('Bearer sk-test-key')
    expect(headers['HTTP-Referer']).toBe(APP_REFERER_URL)
  })

  it('sends only the auth header for a profile without attribution', () => {
    const headers = authHeaders({ ...service, providerProfile: 'ollama' }, profileById('ollama'))
    expect(Object.keys(headers)).toEqual(['authorization'])
  })

  it('never overwrites the auth header with an attribution header', () => {
    for (const mode of ['bearer', 'x-api-key', 'api-key'] as const) {
      const headers = authHeaders({ ...service, authMode: mode }, profileById('openrouter'))
      const key =
        mode === 'bearer' ? 'authorization' : mode === 'x-api-key' ? 'x-api-key' : 'api-key'
      expect(headers[key]).toContain('sk-test-key')
      expect(headers['HTTP-Referer']).toBe(APP_REFERER_URL)
    }
  })
})
