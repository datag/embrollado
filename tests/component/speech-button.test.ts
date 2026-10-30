import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import SpeechButton from '@/components/SpeechButton.vue'

const global = { plugins: [i18n] }

/**
 * The playback control has to give instant feedback (T083 extended): a spinner while the speech
 * request is in flight, a Stop icon while the line plays (clicking it stops the playback), and an
 * ordinary play button otherwise. `busy` disables the button so a request is never duplicated.
 */
describe('SpeechButton busy/active states', () => {
  it('emits play on click and shows no spinner/idle icon', () => {
    const wrapper = mount(SpeechButton, {
      props: { label: 'Play', active: false, busy: false },
      global,
    })
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stop-icon"]').exists()).toBe(false)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    wrapper.find('button').trigger('click')
    expect(wrapper.emitted('play')).toHaveLength(1)
    expect(wrapper.emitted('stop')).toBeUndefined()
  })

  it('shows a spinner and locks the button while the speech request runs', async () => {
    const wrapper = mount(SpeechButton, {
      props: { label: 'Play', active: false, busy: true },
      global,
    })
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    wrapper.find('button').trigger('click')
    expect(wrapper.emitted('play')).toBeUndefined()
    expect(wrapper.emitted('stop')).toBeUndefined()
  })

  it('becomes an enabled Stop button while the line plays and emits stop on click', async () => {
    const wrapper = mount(SpeechButton, {
      props: { label: 'Play', active: true, busy: false },
      global,
    })
    const btn = wrapper.find('button')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="stop-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(false)
    await wrapper.find('[data-testid="stop-icon"]').trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)
    expect(wrapper.emitted('play')).toBeUndefined()
  })
})
