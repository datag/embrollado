/**
 * Build-time configuration of the app, baked into the bundle by Vite from the `APP_*` environment
 * variables (see `docs/deployment.md` § "Build-time configuration" and `.env.example`).
 *
 *   APP_PRIVACY_POLICY_URL  base URL of the bilingual privacy policy → two footer links (#en / #de)
 *   APP_ACCESS_CODE         optional code asked before the app renders (a small hurdle, not security)
 *
 * All variables are optional. Parts of the UI that depend on them are hidden when they are not
 * set — which is the default for forks and local checkouts without a `.env` file.
 */

/** Languages the privacy policy provides a section for. */
export type PrivacyLang = 'de' | 'en'

function readEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const appConfig = {
  /** Base URL of the privacy policy, or `null` if not configured. */
  privacyPolicyUrl: readEnv(import.meta.env.APP_PRIVACY_POLICY_URL),
  /** The exact code that unlocks the app, or `null` when no gate is configured. */
  accessCode: readEnv(import.meta.env.APP_ACCESS_CODE),
} as const

/** Whether the access-code prompt must be shown before the app renders. */
export function accessGateEnabled(): boolean {
  return appConfig.accessCode !== null
}

/**
 * Append (or replace) the language anchor on the privacy-policy URL, e.g.
 * `https://x.example/privacy` → `https://x.example/privacy#en`.
 */
export function privacyPolicyLink(base: string, lang: PrivacyLang): string {
  return `${base.split('#')[0]}#${lang}`
}

/** The privacy-policy URL for one language, or `null` when no URL is configured. */
export function privacyPolicyUrlFor(lang: PrivacyLang): string | null {
  if (!appConfig.privacyPolicyUrl) return null
  return privacyPolicyLink(appConfig.privacyPolicyUrl, lang)
}
