import { describe, expect, it } from 'vitest'
import { canGenerateImages } from '@/ai/providers'
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
