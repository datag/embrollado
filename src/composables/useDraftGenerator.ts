import { ref } from 'vue'
import type { DraftContext } from '@/ai/prompts'
import {
  generatePartnerDraft,
  generateSituationDraft,
  type PartnerDraft,
  type SituationDraft,
} from '@/ai/aiService'
import { pickSeeds, type PartnerSeeds, type SituationSeeds } from '@/domain/seeds'
import { useServiceConfig } from '@/composables/useSettings'
import { profileById } from '@/ai/providers'
import { AiError } from '@/domain/types'

/**
 * Draft generator for the Setup screen (FR-064). Wraps the AI calls that create a random situation
 * or partner draft into the form with a busy flag, an error kind and the seeds that were rolled
 * (so the form can show the transparency hint). The service must be configured, otherwise the
 * request is skipped and `errors.serviceNotConfigured` is reported. A new generation replaces the
 * previous draft; fields are only ever filled when a drafted entry came back intact.
 */
export function useDraftGenerator() {
  const { service } = useServiceConfig()
  const busy = ref(false)
  const errorKind = ref<string | null>(null)

  function noteError(err: unknown) {
    if (err instanceof AiError) {
      errorKind.value = err.kind
      return
    }
    errorKind.value = err instanceof Error && err.message ? 'provider' : 'unknown'
  }

  /**
   * The service is usable only with an address, a chat model and — for every profile that sends
   * the real key — that key. The default document carries an OpenAI address and model but no key,
   * so the key check matters: without it a draft request would leave the device towards a service
   * the learner never configured.
   */
  function serviceReady(): boolean {
    const profile = profileById(service.providerProfile)
    if (!service.baseUrl || !service.chatModel) return false
    if (profile.sendRealKey && !service.apiKey.trim()) return false
    return true
  }

  async function generateSituation(
    ctx: DraftContext,
  ): Promise<{ draft: SituationDraft; seed: SituationSeeds } | null> {
    if (busy.value) return null
    if (!serviceReady()) {
      errorKind.value = 'serviceNotConfigured'
      return null
    }
    busy.value = true
    errorKind.value = null
    try {
      const seed = pickSeeds('situation')
      const draft = await generateSituationDraft({ ...service }, seed, ctx)
      return { draft, seed }
    } catch (err) {
      noteError(err)
      return null
    } finally {
      busy.value = false
    }
  }

  async function generatePartner(
    ctx: DraftContext,
  ): Promise<{ draft: PartnerDraft; seed: PartnerSeeds } | null> {
    if (busy.value) return null
    if (!serviceReady()) {
      errorKind.value = 'serviceNotConfigured'
      return null
    }
    busy.value = true
    errorKind.value = null
    try {
      const seed = pickSeeds('partner')
      const draft = await generatePartnerDraft({ ...service }, seed, ctx)
      return { draft, seed }
    } catch (err) {
      noteError(err)
      return null
    } finally {
      busy.value = false
    }
  }

  function clearError() {
    errorKind.value = null
  }

  return { busy, errorKind, generateSituation, generatePartner, clearError }
}
