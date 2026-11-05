import { describe, expect, it, vi } from 'vitest'
import { useDraftGenerator } from '@/composables/useDraftGenerator'
import { reloadService } from '@/composables/useSettings'

/**
 * The setup-screen draft generator (FR-064) must never send a request to a service the learner has
 * not configured. The default service document carries an OpenAI address and a model but no key —
 * so the key check is what keeps a stray draft request from leaving the device.
 */

const gen = vi.hoisted(() => ({
  generateSituationDraft: vi.fn(),
  generatePartnerDraft: vi.fn(),
}))
vi.mock('@/ai/aiService', () => ({
  generateSituationDraft: gen.generateSituationDraft,
  generatePartnerDraft: gen.generatePartnerDraft,
}))

const CTX = { level: 'intermediate' as const, targetLanguage: 'en' }

/**
 * The service document as it is stored in localStorage. The reactive service singleton is filled
 * once at module load, so it has to be reloaded explicitly after a write.
 */
function writeService(data: Record<string, unknown>) {
  localStorage.setItem('embrollado.service.v1', JSON.stringify({ schema: 1, data }))
  reloadService()
}

describe('draft generator service guard (T134 / FR-064)', () => {
  it('does not send a request when the service has no key', async () => {
    writeService({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      authMode: 'bearer',
      chatModel: 'gpt-6-luna',
      speechModel: null,
      speechVoice: null,
      imageModel: null,
      providerProfile: 'openai',
    })
    const { generateSituation, errorKind } = useDraftGenerator()
    const result = await generateSituation(CTX)
    expect(result).toBeNull()
    expect(errorKind.value).toBe('serviceNotConfigured')
    expect(gen.generateSituationDraft).not.toHaveBeenCalled()
  })

  it('does not send a request without a chat model', async () => {
    writeService({
      baseUrl: 'http://localhost:8787/v1',
      apiKey: 'test',
      authMode: 'bearer',
      chatModel: '',
      speechModel: null,
      speechVoice: null,
      imageModel: null,
      providerProfile: 'openai',
    })
    const { generatePartner, errorKind } = useDraftGenerator()
    const result = await generatePartner(CTX)
    expect(result).toBeNull()
    expect(errorKind.value).toBe('serviceNotConfigured')
    expect(gen.generatePartnerDraft).not.toHaveBeenCalled()
  })

  it('sends the request when the service is fully configured', async () => {
    writeService({
      baseUrl: 'http://localhost:8787/v1',
      apiKey: 'test',
      authMode: 'bearer',
      chatModel: 'mock-chat',
      speechModel: null,
      speechVoice: null,
      imageModel: null,
      providerProfile: 'openai',
    })
    gen.generateSituationDraft.mockResolvedValue({ name: 'A', setting: 'B' })
    const { generateSituation, errorKind } = useDraftGenerator()
    const result = await generateSituation(CTX)
    expect(result).not.toBeNull()
    expect(errorKind.value).toBeNull()
    expect(gen.generateSituationDraft).toHaveBeenCalledTimes(1)
  })
})
