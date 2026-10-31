import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import { ACCESS_KEY } from '@/data/access'
import AccessGate from '@/components/AccessGate.vue'

/** The expected code is injected via prop here; in a gated production build it comes from the
 * build-time `APP_ACCESS_CODE` variable instead. */
const CODE = 'letmein'

const mountGate = (props: Record<string, unknown> = {}) =>
  mount(AccessGate, { props: { accessCode: CODE, ...props }, global: { plugins: [i18n] } })

describe('access gate (build/dev.commit-5)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rejects a wrong code without unlocking and without a marker', async () => {
    const wrapper = mountGate()
    await wrapper.get('#access-code').setValue('wrong')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toBe('That code is not correct.')
    expect(wrapper.emitted('granted')).toBeUndefined()
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull()
  })

  it('unlocks on the correct code and stores the marker', async () => {
    const wrapper = mountGate()
    await wrapper.get('#access-code').setValue(CODE)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('granted')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(ACCESS_KEY) ?? '{}').granted).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('clears the error while the learner types again', async () => {
    const wrapper = mountGate()
    await wrapper.get('#access-code').setValue('wrong')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await wrapper.get('#access-code').setValue('let')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('compares the trimmed input, ignoring surrounding whitespace', async () => {
    const wrapper = mountGate()
    await wrapper.get('#access-code').setValue(`  ${CODE}  `)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('granted')).toHaveLength(1)
  })

  it('has an accessible form: labelled field and a submit button', () => {
    const wrapper = mountGate()
    expect(wrapper.get('label').text()).toBe('Access code')
    expect(wrapper.get('#access-code').attributes('id')).toBeTruthy()
    expect(wrapper.get('button[type="submit"]').text()).toBe('Continue')
  })
})
