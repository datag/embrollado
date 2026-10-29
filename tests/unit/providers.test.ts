import { describe, expect, it } from 'vitest'
import { canGenerateImages } from '@/ai/providers'
import { DEFAULT_SERVICE } from '@/data/profile'
import type { LearnerProfile } from '@/domain/types'

const settings: LearnerProfile = {
  name: '',
  details: '',
  nativeLanguage: null,
  interfaceLanguage: 'en',
  theme: 'auto',
  speechEnabled: true,
  illustrationsEnabled: true,
  cachedSpeechLines: 20,
}

describe('canGenerateImages (FR-028 as amended)', () => {
  const base = { ...DEFAULT_SERVICE, imageModel: 'gpt-image-1', providerProfile: 'openai' }

  it('is false without an image model, so the input keeps the full width', () => {
    expect(canGenerateImages({ ...base, imageModel: null }, settings, true)).toBe(false)
    expect(canGenerateImages({ ...base, imageModel: '  ' }, settings, true)).toBe(false)
  })

  it('is false when the provider profile exposes no images path', () => {
    for (const profile of ['ollama', 'llamacpp', 'vllm', 'lmstudio']) {
      expect(canGenerateImages({ ...base, providerProfile: profile }, settings, true)).toBe(false)
    }
  })

  it('is false when the learner disabled illustrations or the service declined', () => {
    expect(canGenerateImages(base, { ...settings, illustrationsEnabled: false }, true)).toBe(false)
    expect(canGenerateImages(base, settings, false)).toBe(false)
  })

  it('is true only when all four conditions hold', () => {
    expect(canGenerateImages(base, settings, true)).toBe(true)
  })
})
