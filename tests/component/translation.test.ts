import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import TurnBubble from '@/components/TurnBubble.vue'
import TranslationToggle from '@/components/TranslationToggle.vue'

/**
 * FR-057: the translation renders muted under the partner line, only when the caller decides it
 * may be shown; the per-line toggle flips that decision and carries a meaningful aria state.
 */
describe('partner-line translation (FR-057)', () => {
  it('renders the translation muted inside the partner bubble when passed', () => {
    const wrapper = mount(TurnBubble, {
      props: { text: '¿Dónde está el lavadero?', side: 'partner', translation: 'Wo ist der Waschraum?' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('Wo ist der Waschraum?')
    const translation = wrapper.findAll('p').find((p) => p.text().includes('Wo ist der Waschraum'))
    expect(translation?.classes()).toContain('text-fg-muted')
    expect(translation?.classes()).toContain('text-sm')
  })

  it('omits the translation when it may not be shown', () => {
    const wrapper = mount(TurnBubble, {
      props: { text: '¿Dónde está el lavadero?', side: 'partner', translation: null },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).not.toContain('Wo ist der Waschraum?')
  })

  it('never shows a translation on a learner bubble', () => {
    const wrapper = mount(TurnBubble, {
      props: {
        text: 'Meine Antwort',
        side: 'learner',
        translation: 'My answer',
      },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).not.toContain('My answer')
  })

  it('toggles the visible state and announces it via aria-pressed', async () => {
    const wrapper = mount(TranslationToggle, {
      props: { visible: false },
      global: { plugins: [i18n] },
    })
    const button = wrapper.find('button')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('Show translation')

    await wrapper.setProps({ visible: true })
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('Hide translation')
  })

  it('emits toggle when pressed', async () => {
    const wrapper = mount(TranslationToggle, {
      props: { visible: false },
      global: { plugins: [i18n] },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})
