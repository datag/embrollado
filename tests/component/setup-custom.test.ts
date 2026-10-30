import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import { readTemplates } from '@/data/profile'
import SetupView from '@/views/SetupView.vue'

/**
 * Learner-defined entries in the Setup screen (FR-045/046/047, SC-017): a custom entry is listed
 * and visibly selected, may be promoted to a template from the selected row, and can be removed.
 * The "save as template" flow also guards the race that used to leave the entry invisible.
 * fake-indexeddb resolves on macrotasks, so interactions that hit the template store settle
 * through a few macrotask cycles rather than a single flushPromises().
 */
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
      { path: '/conversation/:id', component: { template: '<div />' } },
    ],
  })
}

async function mountSetup() {
  const router = makeRouter()
  await router.push('/new')
  await router.isReady()
  const wrapper = mount(SetupView, { global: { plugins: [i18n, router] } })
  await settle()
  return { wrapper, router }
}

type W = Awaited<ReturnType<typeof mountSetup>>['wrapper']

function list(wrapper: W) {
  return wrapper.find('[data-testid="situation-picker"]')
}

async function createCustomSituation(wrapper: W, opts: { template?: boolean } = {}) {
  await list(wrapper).findAll('button').at(-1)?.trigger('click')
  await settle()
  await wrapper.find('form input[type="text"]').setValue('My custom situation')
  await wrapper.find('form textarea').setValue('A one-off situation for this test.')
  if (opts.template) {
    await wrapper.find('#save-template').setValue(true)
  }
  await wrapper.find('form').trigger('submit')
  await settle()
}

const entryButton = (wrapper: W, name: string) =>
  list(wrapper)
    .findAll('button')
    .find((b) => b.text().includes(name))
const startButton = (wrapper: W) =>
  wrapper.findAll('button').find((b) => b.text() === 'Start the conversation')

describe('custom situation in the Setup screen', () => {
  it('lists a session-only entry, marked ONE-TIME, selected, with promote/remove actions', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper)

    const entry = entryButton(wrapper, 'My custom situation')
    expect(entry).toBeTruthy()
    expect(entry!.classes()).toContain('border-accent')
    expect(entry!.text()).toContain('ONE-TIME')
    expect(list(wrapper).find('[data-testid="promote-entry"]').exists()).toBe(true)
    expect(list(wrapper).find('[data-testid="remove-entry"]').exists()).toBe(true)
    // A one-off entry is never stored as a template (FR-046 / SC-017).
    const t = await readTemplates()
    expect(t.situations.some((s) => s.name === 'My custom situation')).toBe(false)
  })

  it('shows an entry saved as a template immediately (no reload) with the CUSTOM badge', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper, { template: true })

    const entry = entryButton(wrapper, 'My custom situation')
    expect(entry).toBeTruthy()
    expect(entry!.text()).toContain('CUSTOM')
    // It is a template now: no promote action, only remove.
    expect(list(wrapper).find('[data-testid="promote-entry"]').exists()).toBe(false)
    expect(list(wrapper).find('[data-testid="remove-entry"]').exists()).toBe(true)
    const t = await readTemplates()
    expect(
      t.situations.some((s) => s.name === 'My custom situation' && s.visibility === 'template'),
    ).toBe(true)
  })

  it('promotes a session-only entry to a template while keeping the selection', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper)

    await list(wrapper).find('[data-testid="promote-entry"]').trigger('click')
    await settle()

    const entry = entryButton(wrapper, 'My custom situation')
    expect(entry?.text()).toContain('CUSTOM')
    expect(entry?.classes()).toContain('border-accent')
    expect(list(wrapper).find('[data-testid="promote-entry"]').exists()).toBe(false)
    expect(list(wrapper).find('[data-testid="remove-entry"]').exists()).toBe(true)
  })

  it('removing a session-only entry clears the selection and disables the start button', async () => {
    const { wrapper } = await mountSetup()
    await wrapper
      .find('[data-testid="partner-picker"]')
      .findAll('button')
      .find((b) => b.text().includes('Nicole'))
      ?.trigger('click')
    await createCustomSituation(wrapper)

    expect(startButton(wrapper)?.attributes('disabled')).toBeUndefined()

    await list(wrapper).find('[data-testid="remove-entry"]').trigger('click')
    await settle()

    expect(entryButton(wrapper, 'My custom situation')).toBeUndefined()
    // Nothing selected in the situation picker anymore → the start button locks again.
    expect(list(wrapper).find('[data-testid="remove-entry"]').exists()).toBe(false)
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
  })

  it('confirms before removing a stored template and keeps it when declined', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper, { template: true })

    const decline = vi.fn(() => false)
    vi.stubGlobal('confirm', decline)
    await list(wrapper).find('[data-testid="remove-entry"]').trigger('click')
    await settle()
    expect(decline).toHaveBeenCalled()
    expect(entryButton(wrapper, 'My custom situation')).toBeTruthy()

    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    await list(wrapper).find('[data-testid="remove-entry"]').trigger('click')
    await settle()
    expect(entryButton(wrapper, 'My custom situation')).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
