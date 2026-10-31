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
  it('trusts declared modalities: TTS declares "speech", not "audio"', () => {
    const models = [
      { id: 'openai/gpt-4o-mini', outputModalities: ['text'] },
      { id: 'google/gemini-3.8-flash-lite-tts', outputModalities: ['speech'] },
      { id: 'openai/gpt-image-1', outputModalities: ['image'] },
      { id: 'google/gemini-3.1-flash-image', outputModalities: ['image', 'text'] },
      { id: 'openai/gpt-audio', outputModalities: ['text', 'audio'] },
      { id: 'openai/whisper-1', outputModalities: ['text'] },
    ]
    const c = classifyModels('openrouter', models)
    expect(c.speech).toEqual(['google/gemini-3.8-flash-lite-tts'])
    expect(c.image).toEqual(['google/gemini-3.1-flash-image', 'openai/gpt-image-1'])
    expect(c.chat).toContain('openai/gpt-4o-mini')
    // `audio` is chat-with-audio-output, not our /audio/speech endpoint.
    expect(c.chat).toContain('openai/gpt-audio')
    expect(c.chat).toContain('openai/whisper-1')
    // A multimodal model with text output also chats…
    expect(c.chat).toContain('google/gemini-3.1-flash-image')
    // …but a pure-image model (text-less) and a TTS model do not.
    expect(c.chat).not.toContain('openai/gpt-image-1')
    expect(c.chat).not.toContain('google/gemini-3.8-flash-lite-tts')
  })

  it('drops modalities that fit none of the three fields', () => {
    const c = classifyModels('openrouter', [
      { id: 'embed-model', outputModalities: ['embeddings'] },
      { id: 'transcribe-model', outputModalities: ['transcription'] },
      { id: 'video-model', outputModalities: ['video'] },
      { id: 'decision-model', outputModalities: ['decisions'] },
      { id: 'rerank-model', outputModalities: ['rerank'] },
    ])
    expect(c.chat).toEqual([])
    expect(c.speech).toEqual([])
    expect(c.image).toEqual([])
  })

  it('classifies by name when no modalities are declared (OpenAI, Ollama)', () => {
    const models = [
      { id: 'gpt-4o-mini', outputModalities: [] },
      { id: 'gpt-4o-mini-tts', outputModalities: [] },
      { id: 'gpt-image-1', outputModalities: [] },
      { id: 'dall-e-3', outputModalities: [] },
      { id: 'whisper-1', outputModalities: [] },
      { id: 'llama3.2-tts', outputModalities: [] },
      { id: 'maia-voice-2', outputModalities: [] },
    ]
    const c = classifyModels('ollama', models)
    expect(c.speech).toEqual(['gpt-4o-mini-tts', 'llama3.2-tts', 'maia-voice-2'])
    expect(c.image).toEqual(['dall-e-3', 'gpt-image-1'])
    // whisper is ASR, not TTS — it stays a (harmless) chat suggestion.
    expect(c.chat).toEqual(['gpt-4o-mini', 'whisper-1'])
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

  it('sorts naturally so versions order correctly', () => {
    const c = classifyModels('custom', [
      { id: 'google/gemini-3.10-flash', outputModalities: [] },
      { id: 'google/gemini-3.8-flash', outputModalities: [] },
      { id: 'google/gemini-3.8-flash-lite-tts', outputModalities: [] },
      { id: 'openai/gpt-4', outputModalities: [] },
      { id: 'openai/gpt-10', outputModalities: [] },
      { id: 'openai/gpt-4o', outputModalities: [] },
    ])
    // 3.8 before 3.10, gpt-4 before gpt-10; the tts-named model leaves the chat list.
    expect(c.chat).toEqual([
      'google/gemini-3.8-flash',
      'google/gemini-3.10-flash',
      'openai/gpt-4',
      'openai/gpt-4o',
      'openai/gpt-10',
    ])
    expect(c.speech).toEqual(['google/gemini-3.8-flash-lite-tts'])
  })
})
