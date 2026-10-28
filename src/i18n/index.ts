import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import de from '@/i18n/locales/de'
import type { InterfaceLanguage } from '@/domain/types'

/**
 * Internationalisation (T027, D5). The interface ships English and German; the feedback language
 * (a third, "native" language) is delivered by the model and falls back to the interface language
 * in the prompt builder. UI chrome always renders in the interface language, with English as the
 * final fallback.
 */
export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, de },
  missingWarn: false,
  fallbackWarn: false,
})

export function setInterfaceLanguage(lang: InterfaceLanguage): void {
  i18n.global.locale.value = lang
}

/** Resolve the effective feedback language that is sent to the model (FR-034). */
export function resolveFeedbackLanguage(
  nativeLanguage: string | null,
  interfaceLanguage: InterfaceLanguage,
): string {
  if (nativeLanguage) return nativeLanguage
  return interfaceLanguage
}