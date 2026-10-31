import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import AppFooter from '@/components/AppFooter.vue'

const mountFooter = (props: Record<string, unknown> = {}) =>
  mount(AppFooter, {
    props,
    global: {
      plugins: [i18n],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })

/**
 * Footer (build/dev.commit-4): the app name and the About link always render; the two language
 * links ("Privacy Policy" #en / "Datenschutzerklärung" #de) appear only when a privacy-policy URL
 * is configured — via prop here, via the build variable in production.
 */
describe('app footer', () => {
  it('always shows the app name and the About link', () => {
    const wrapper = mountFooter()
    expect(wrapper.text()).toContain('Embrollado')
    expect(wrapper.text()).toContain('About')
  })

  it('renders no privacy links without a configured URL', () => {
    const wrapper = mountFooter()
    expect(wrapper.findAll('a[href$="#en"], a[href$="#de"]')).toHaveLength(0)
  })

  it('renders both language links when a privacy-policy URL is configured', () => {
    const wrapper = mountFooter({ privacyPolicyUrl: 'https://x.example/privacy' })
    const links = wrapper.findAll('a[href]')
    const privacy = links.filter((a) =>
      a.attributes('href')?.startsWith('https://x.example/privacy'),
    )
    expect(privacy).toHaveLength(2)
    expect(privacy.map((a) => a.attributes('href'))).toEqual([
      'https://x.example/privacy#en',
      'https://x.example/privacy#de',
    ])
    expect(privacy.map((a) => a.text())).toEqual(['Privacy Policy', 'Datenschutzerklärung'])
    for (const a of privacy) {
      expect(a.attributes('target')).toBe('_blank')
      expect(a.attributes('rel')).toContain('noopener')
    }
  })

  it('replaces an existing anchor on the configured URL', () => {
    const wrapper = mountFooter({ privacyPolicyUrl: 'https://x.example/privacy#en' })
    const hrefs = wrapper
      .findAll('a[href^="https://x.example/privacy"]')
      .map((a) => a.attributes('href'))
    expect(hrefs).toEqual(['https://x.example/privacy#en', 'https://x.example/privacy#de'])
  })
})
