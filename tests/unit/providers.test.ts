import { describe, expect, it } from 'vitest'
import {
  canGenerateImages,
  addressForProfile,
  shouldPrefillAddress,
  shouldResetAuthMode,
  classifyModels,
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

describe('classifyModels (settings-profile.md §2.1)', () => {
  it('trusts declared output modalities (OpenRouter)', () => {
    const models = [
      { id: 'openai/gpt-4o-mini', outputModalities: ['text'] },
      { id: 'openai/gpt-4o-mini-tts', outputModalities: ['text', 'audio'] },
      { id: 'openai/gpt-image-1', outputModalities: ['text', 'image'] },
      { id: 'openai/whisper-1', outputModalities: ['text'] },
    ]
    const c = classifyModels('openrouter', models)
    expect(c.speech).toEqual(['openai/gpt-4o-mini-tts'])
    expect(c.image).toEqual(['openai/gpt-image-1'])
    // image-capable models also chat; whisper stays a chat model here
    expect(c.chat).toContain('openai/gpt-image-1')
    expect(c.chat).toContain('openai/whisper-1')
    expect(c.chat).not.toContain('openai/gpt-4o-mini-tts')
  })

  it('classifies by name when no modalities are declared (OpenAI, Ollama)', () => {
    const models = [
      { id: 'gpt-4o-mini', outputModalities: [] },
      { id: 'gpt-4o-mini-tts', outputModalities: [] },
      { id: 'gpt-image-1', outputModalities: [] },
      { id: 'dall-e-3', outputModalities: [] },
      { id: 'whisper-1', outputModalities: [] },
      { id: 'llama3.2-tts', outputModalities: [] },
    ]
    const c = classifyModels('ollama', models)
    expect(c.speech).toEqual(['gpt-4o-mini-tts', 'llama3.2-tts'])
    expect(c.image).toEqual(['gpt-image-1', 'dall-e-3'])
    // Image-capable models also chat; only speech models leave the chat list.
    expect(c.chat).toEqual(['gpt-4o-mini', 'gpt-image-1', 'dall-e-3', 'whisper-1'])
  })

  it('local chat-only servers never offer speech or images', () => {
    for (const profile of ['llamacpp', 'vllm', 'lmstudio']) {
      const c = classifyModels(profile, [
        { id: 'model-a', outputModalities: ['text', 'audio'] },
        { id: 'model-b', outputModalities: [] },
      ])
      expect(c.chat).toEqual(['model-a', 'model-b'])
      expect(c.speech).toEqual([])
      expect(c.image).toEqual([])
    }
  })
})
