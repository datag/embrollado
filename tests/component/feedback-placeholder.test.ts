import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import FeedbackPlaceholder from '@/components/FeedbackPlaceholder.vue'
import ThinkingIndicator from '@/components/ThinkingIndicator.vue'

/**
 * The feedback block's position is held by a loading card while the model still produces the
 * turn (FR-035, T128). The card is the app's own status message — the partner does not know the
 * rating, so the wording must never come from the partner's perspective (FR-061).
 */
describe('feedback placeholder (FR-035, T128)', () => {
  it('renders the label as a status message', () => {
    const wrapper = mount(FeedbackPlaceholder, {
      props: { label: 'Your answer is being assessed…' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('Your answer is being assessed…')
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('data-testid')).toBe('feedback-placeholder')
  })

  it('uses the quiet, recessed styling of the completed feedback block', () => {
    const wrapper = mount(FeedbackPlaceholder, {
      props: { label: 'x' },
      global: { plugins: [i18n] },
    })
    const classes = wrapper.attributes('class') ?? ''
    expect(classes).toContain('bg-surface-muted')
    expect(classes).toContain('border-border')
  })

  it('shows the animated dots of the thinking indicator', () => {
    const wrapper = mount(FeedbackPlaceholder, {
      props: { label: 'x' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.findAll('.thinking-dot')).toHaveLength(3)
  })

  it('keeps the thinking indicator working with the shared dots', () => {
    const wrapper = mount(ThinkingIndicator, {
      props: { label: 'The partner is thinking…' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('The partner is thinking…')
    expect(wrapper.findAll('.thinking-dot')).toHaveLength(3)
  })
})
