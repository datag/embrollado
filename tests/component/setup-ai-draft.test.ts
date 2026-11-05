import { expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import SetupView from '@/views/SetupView.vue'

/**
 * The AI-generated draft button in the Setup screen (FR-064). The button sits in the custom-entry
 * form; a successful generation fills the fields (overwriting whatever was there), a new press
 * overwrites again, a failed generation leaves the existing values untouched and shows an error,
 * and while a request is in flight the whole form is locked. The composable is mocked so the tests
 * stay deterministic and network-free.
 */

interface MockRef<T> {
  __v_isRef: true
  value: T
}

const gen = vi.hoisted(() => ({
  busy: { __v_isRef: true, value: false } as MockRef<boolean>,
  errorKind: { __v_isRef: true, value: null } as MockRef<string | null>,
  clearError: vi.fn(),
  generateSituation: vi.fn(),
  generatePartner: vi.fn(),
}))
vi.mock('@/composables/useDraftGenerator', () => {
  return {
    useDraftGenerator: () => ({
      busy: gen.busy,
      errorKind: gen.errorKind,
      clearError: gen.clearError,
      generateSituation: gen.generateSituation,
      generatePartner: gen.generatePartner,
    }),
  }
})

async function settle() {
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
  }
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/new', component: SetupView },
      { path: '/settings', component: { template: '<div />' } },
    ],
  })
}

async function mountSetup() {
  const router = makeRouter()
  await router.push('/new')
  await router.isReady()
  const wrapper = mount(SetupView, { global: { plugins: [i18n, router] } })
  await settle()
  return wrapper
}

beforeEach(() => {
  gen.busy.value = false
  gen.errorKind.value = null
  gen.clearError.mockClear()
  gen.generateSituation.mockReset()
  gen.generatePartner.mockReset()
})

it('fills the situation form from a generated draft and shows the seed hint', async () => {
  gen.generateSituation.mockResolvedValue({
    draft: { name: 'At the laundry', setting: 'The learner needs the last dryer free.' },
    seed: {
      genre: 'a routine errand',
      place: 'a laundromat in Vienna',
      aim: 'to dry one load',
      extras: ['a wool blanket', 'apricot jam'],
    },
  })
  const wrapper = await mountSetup()
  // Open "Write my own" for a situation → the custom form replaces the picker.
  await wrapper.find('[data-testid="situation-picker"]').findAll('button').at(-1)?.trigger('click')
  await settle()

  await wrapper.find('[data-testid="ai-generate"]').trigger('click')
  await settle()

  const name = wrapper.find('form input[type="text"]').element as HTMLInputElement
  expect(name.value).toBe('At the laundry')
  expect((wrapper.find('form textarea').element as HTMLTextAreaElement).value).toContain(
    'The learner needs the last dryer free.',
  )
  expect(wrapper.find('[data-testid="ai-seed-hint"]').exists()).toBe(true)
})

it('fills the partner form from a generated draft (age, gender, occupation, description)', async () => {
  gen.generatePartner.mockResolvedValue({
    draft: {
      name: 'Idris',
      age: 46,
      gender: 'male',
      occupation: 'a ferry captain',
      description: 'A calm, patient captain who knows every tide.',
    },
    seed: {
      genre: 'a first meeting',
      place: 'a ferry terminal ticket window',
      role: 'a ferry captain',
      extras: ['Marisol', 'a wool blanket'],
    },
  })
  const wrapper = await mountSetup()
  await wrapper.find('[data-testid="partner-picker"]').findAll('button').at(-1)?.trigger('click')
  await settle()

  await wrapper.find('[data-testid="ai-generate"]').trigger('click')
  await settle()

  const inputs = wrapper
    .findAll('form input[type="text"]')
    .map((i) => i.element as HTMLInputElement)
  // partner form: Name (text), Occupation (text) — age is number, gender is a select.
  expect(inputs[0].value).toBe('Idris')
  expect(inputs[1].value).toBe('a ferry captain')
  expect((wrapper.find('[data-testid="custom-gender"]').element as HTMLSelectElement).value).toBe(
    'male',
  )
  expect((wrapper.find('form textarea').element as HTMLTextAreaElement).value).toContain(
    'A calm, patient captain',
  )
})

it('keeps the existing values and shows an error when generation fails', async () => {
  gen.generateSituation.mockResolvedValue(null) // error path → returns null, sets errorKind
  gen.errorKind.value = 'provider'
  const wrapper = await mountSetup()
  await wrapper.find('[data-testid="situation-picker"]').findAll('button').at(-1)?.trigger('click')
  await settle()

  // Type something first — it must survive a failed generation.
  await wrapper.find('form input[type="text"]').setValue('My draft')
  await wrapper.find('[data-testid="ai-generate"]').trigger('click')
  await settle()

  expect((wrapper.find('form input[type="text"]').element as HTMLInputElement).value).toBe(
    'My draft',
  )
  expect(wrapper.find('[data-testid="ai-draft-error"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="ai-seed-hint"]').exists()).toBe(false)
})

it('locks the form while a generation is in flight', async () => {
  gen.busy.value = true
  const wrapper = await mountSetup()
  await wrapper.find('[data-testid="situation-picker"]').findAll('button').at(-1)?.trigger('click')
  await settle()

  expect(wrapper.find('[data-testid="ai-generate"]').attributes('disabled')).toBeDefined()
  expect(wrapper.find('form input[type="text"]').attributes('disabled')).toBeDefined()
  expect(wrapper.find('form button[type="submit"]').attributes('disabled')).toBeDefined()
})

it('shows the set-up-first hint when no draft generated', async () => {
  gen.errorKind.value = 'serviceNotConfigured'
  gen.generateSituation.mockResolvedValue(null)
  const wrapper = await mountSetup()
  await wrapper.find('[data-testid="situation-picker"]').findAll('button').at(-1)?.trigger('click')
  await settle()

  await wrapper.find('[data-testid="ai-generate"]').trigger('click')
  await settle()

  expect(wrapper.find('[data-testid="ai-draft-error"]').text()).toContain('Set up your AI service')
  expect(wrapper.find('[data-testid="ai-draft-error"] a').exists()).toBe(true)
})
