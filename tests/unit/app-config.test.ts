import { describe, expect, it } from 'vitest'
import { appConfig, privacyPolicyLink, privacyPolicyUrlFor } from '@/config/app'

/**
 * Build-time configuration (T-new: build/dev.commit-4): the privacy-policy links are driven by the
 * optional `APP_PRIVACY_POLICY_URL` variable. In the test environment the variable is unset, so the
 * pure helpers are exercised directly; `privacyPolicyUrlFor` must yield `null` without a URL.
 */
describe('app config (privacy policy links)', () => {
  it('returns no privacy-policy URL when APP_PRIVACY_POLICY_URL is not set', () => {
    expect(appConfig.privacyPolicyUrl).toBeNull()
    expect(privacyPolicyUrlFor('en')).toBeNull()
    expect(privacyPolicyUrlFor('de')).toBeNull()
  })

  it('appends the requested language anchor to the base URL', () => {
    expect(privacyPolicyLink('https://datag.is-a.dev/privacy', 'en')).toBe(
      'https://datag.is-a.dev/privacy#en',
    )
    expect(privacyPolicyLink('https://datag.is-a.dev/privacy', 'de')).toBe(
      'https://datag.is-a.dev/privacy#de',
    )
  })

  it('replaces an existing anchor instead of stacking a second one', () => {
    expect(privacyPolicyLink('https://datag.is-a.dev/privacy#en', 'de')).toBe(
      'https://datag.is-a.dev/privacy#de',
    )
    expect(privacyPolicyLink('https://datag.is-a.dev/privacy#de', 'en')).toBe(
      'https://datag.is-a.dev/privacy#en',
    )
  })

  it('keeps the URL identical apart from the anchor', () => {
    const url = privacyPolicyLink('https://x.example/a?b=c#old', 'de')
    expect(url).toBe('https://x.example/a?b=c#de')
  })
})
