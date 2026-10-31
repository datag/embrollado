import { describe, expect, it } from 'vitest'
import {
  canGenerateImages,
  addressForProfile,
  shouldPrefillAddress,
  shouldResetAuthMode,
} from '@/ai/providers'
import { DEFAULT_SERVICE } from '@/data/profile'

describe('canGenerateImages (FR-028 as amended)', () => {
  const base = { ...DEFAULT_SERVICE, imageModel: 'gpt-image-1', providerProfile: 'openai' }

  it('is false without an image model, so the input keeps the full width', () => {
    expect(canGenerateImages({ ...base, imageModel: null }, true)).toBe(false)
    expect(canGenerateImages({ ...base, imageModel: '  ' }, true)).toBe(false)
  })

  it('is false when the provider profile exposes no images path', () => {
    for (const profile of ['ollama', 'llamacpp', 'vllm', 'lmstudio']) {
      expect(canGenerateImages({ ...base, providerProfile: profile }, true)).toBe(false)
    }
  })

  it('is false when the service has declined the images endpoint', () => {
    expect(canGenerateImages(base, false)).toBe(false)
  })

  it('is true only when a model and an images path are available', () => {
    expect(canGenerateImages(base, true)).toBe(true)
  })
})

describe('addressForProfile', () => {
  it('returns the known defaults', () => {
    expect(addressForProfile('openai')).toBe('https://api.openai.com/v1')
    expect(addressForProfile('openrouter')).toBe('https://openrouter.ai/api/v1')
    expect(addressForProfile('ollama')).toBe('http://localhost:11434/v1')
    expect(addressForProfile('llamacpp')).toBe('http://localhost:9931/v1')
  })

  it('custom has no default address', () => {
    expect(addressForProfile('custom')).toBe('')
  })

  it('unknown profiles fall back to custom (no default)', () => {
    expect(addressForProfile('nope')).toBe('')
  })
})

describe('shouldPrefillAddress (settings-profile.md §2.1)', () => {
  it('prefills when the address is empty', () => {
    expect(shouldPrefillAddress('', 'openai')).toBe(true)
    expect(shouldPrefillAddress('   ', 'openai')).toBe(true)
  })

  it('prefills when the address still equals the previous profile default', () => {
    expect(shouldPrefillAddress('https://api.openai.com/v1', 'openai')).toBe(true)
    expect(shouldPrefillAddress('https://api.openai.com/v1/', 'openai')).toBe(true)
  })

  it('keeps a manually entered address', () => {
    // An EU-bounded OpenRouter host is a manual address — a profile switch must not replace it.
    expect(shouldPrefillAddress('https://eu.openrouter.ai/api/v1', 'openai')).toBe(false)
    expect(shouldPrefillAddress('https://api.openai.com/v1', 'openrouter')).toBe(false)
    expect(shouldPrefillAddress('http://localhost:8787/v1', 'openai')).toBe(false)
  })
})

describe('shouldResetAuthMode', () => {
  it('replaces only a default auth style', () => {
    expect(shouldResetAuthMode('bearer', 'openai')).toBe(true)
    expect(shouldResetAuthMode('x-api-key', 'openai')).toBe(false)
    expect(shouldResetAuthMode('api-key', 'openai')).toBe(false)
  })
})
