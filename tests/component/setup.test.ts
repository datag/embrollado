import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import LanguagePicker from '@/components/LanguagePicker.vue'
import LevelPicker from '@/components/LevelPicker.vue'
import SituationPicker from '@/components/SituationPicker.vue'
import PartnerPicker from '@/components/PartnerPicker.vue'
import ConversationOptions from '@/components/ConversationOptions.vue'

const global = { plugins: [i18n] }

describe('setup pickers (T032)', () => {
  it('language picker offers the catalogue languages and emits on change', async () => {
    const wrapper = mount(LanguagePicker, { props: { modelValue: 'en' }, global })
    const options = wrapper.findAll('option')
    expect(options.length).toBe(12)
    await wrapper.find('select').setValue('de')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['de'])
  })

  it('level picker shows the three levels with descriptions', () => {
    const wrapper = mount(LevelPicker, { props: { modelValue: 'beginner' }, global })
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Beginner')
  })

  it('situation picker lists the 13 built-in situations and can create a custom one', () => {
    const wrapper = mount(SituationPicker, {
      props: { modelValue: null, templates: [], searchLabel: 'Search' },
      global,
    })
    // 13 built-in + 1 custom entry.
    expect(wrapper.findAll('button')).toHaveLength(14)
    const custom = wrapper.findAll('button').at(-1)
    expect(custom?.text()).toContain('Write my own')
  })

  it('situation picker filters by keyword', async () => {
    const wrapper = mount(SituationPicker, {
      props: { modelValue: null, templates: [], searchLabel: 'Search' },
      global,
    })
    await wrapper.find('input[type="search"]').setValue('washroom')
    expect(wrapper.findAll('button').length).toBeGreaterThan(1)
  })

  it('partner picker lists the 5 built-in partners plus the custom entry', () => {
    const wrapper = mount(PartnerPicker, {
      props: { modelValue: null, templates: [], searchLabel: 'Search' },
      global,
    })
    expect(wrapper.findAll('button')).toHaveLength(6)
  })

  it('conversation options offer the "already knows you" toggle, off by default', async () => {
    const wrapper = mount(ConversationOptions, { props: { modelValue: false }, global })
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    await checkbox.setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})
