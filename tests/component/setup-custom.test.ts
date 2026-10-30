import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import { readTemplates } from '@/data/profile'
import { readOneShots } from '@/data/oneShots'
import SetupView from '@/views/SetupView.vue'

/**
 * Learner-defined entries in the Setup screen (FR-045/046/047, SC-017): a custom entry is listed
 * and visibly selected, may be promoted to a template or edited from the selected row, and can be
 * removed. One-off entries live in sessionStorage (FR-046), so they survive a remount in the same
 * tab and their selection is restored — but starting a conversation clears the selection.
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
  it('lists a session-only entry, marked ONE-TIME, selected, with promote/edit/remove actions', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper)

    const entry = entryButton(wrapper, 'My custom situation')
    expect(entry).toBeTruthy()
    expect(entry!.classes()).toContain('border-accent')
    expect(entry!.text()).toContain('ONE-TIME')
    expect(list(wrapper).find('[data-testid="promote-entry"]').exists()).toBe(true)
    expect(list(wrapper).find('[data-testid="edit-entry"]').exists()).toBe(true)
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
    // It is a template now: no promote action, only edit and remove.
    expect(list(wrapper).find('[data-testid="promote-entry"]').exists()).toBe(false)
    expect(list(wrapper).find('[data-testid="edit-entry"]').exists()).toBe(true)
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

  it('scrolls the freshly added custom entry into view after saving', async () => {
    const calls: unknown[][] = []
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (...args: unknown[]) {
      calls.push(args)
    }
    try {
      const { wrapper } = await mountSetup()
      await createCustomSituation(wrapper)
      // The picker remounts with the selection already set, so the mount scroll must have run.
      expect(calls.length).toBeGreaterThan(0)
      expect(calls[0][0]).toEqual({ block: 'nearest' })
    } finally {
      HTMLElement.prototype.scrollIntoView = original
    }
  })

  it('shows picker-specific search placeholders, not the session-list one', async () => {
    const { wrapper } = await mountSetup()
    const [situationInput, partnerInput] = wrapper.findAll('input[type="search"]')
    expect(situationInput.attributes('placeholder')).toBe('Situation, keyword…')
    expect(partnerInput.attributes('placeholder')).toBe('Name, occupation, keyword…')
  })

  it('no longer asks for the language of the description', async () => {
    const { wrapper } = await mountSetup()
    await list(wrapper).findAll('button').at(-1)?.trigger('click')
    await settle()
    expect(wrapper.text()).not.toContain('Language of this text')
    // The situation form now has no selects at all (gender/age are partner-only).
    expect(wrapper.find('form select').exists()).toBe(false)
  })

  it('restores a one-off entry and its selection after a remount in the same tab', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper)

    // Simulate a reload: drop the in-memory component state and mount a fresh Setup view —
    // sessionStorage keeps the one-off entries and the selection (FR-046).
    wrapper.unmount()
    const fresh = await mountSetup()

    const entry = entryButton(fresh.wrapper, 'My custom situation')
    expect(entry).toBeTruthy()
    expect(entry!.classes()).toContain('border-accent')
    // The selected row still offers promote — the ★ path stays reachable after a reload.
    expect(list(fresh.wrapper).find('[data-testid="promote-entry"]').exists()).toBe(true)
  })

  it('edits a stored template: same id, no duplicate, no re-prompt for save-as-template', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper, { template: true })
    const original = (await readTemplates()).situations.find(
      (s) => s.name === 'My custom situation',
    )
    expect(original).toBeTruthy()

    await list(wrapper).find('[data-testid="edit-entry"]').trigger('click')
    await settle()

    // The form opens prefilled and without the "save as a template" toggle (it is already one).
    const nameInput = wrapper.find('form input[type="text"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('My custom situation')
    expect(wrapper.find('#save-template').exists()).toBe(false)

    await nameInput.setValue('Renamed situation')
    await wrapper.find('form').trigger('submit')
    await settle()

    const after = (await readTemplates()).situations
    expect(after).toHaveLength(1)
    expect(after[0].id).toBe(original!.id)
    expect(after[0].name).toBe('Renamed situation')
    expect(after[0].createdAt).toBe(original!.createdAt)
    expect(entryButton(wrapper, 'Renamed situation')).toBeTruthy()
    expect(entryButton(wrapper, 'My custom situation')).toBeUndefined()
  })

  it('edits a one-off entry in place without duplicating it', async () => {
    const { wrapper } = await mountSetup()
    await createCustomSituation(wrapper)

    await list(wrapper).find('[data-testid="edit-entry"]').trigger('click')
    await settle()
    await wrapper.find('form input[type="text"]').setValue('Improved one-off')
    await wrapper.find('form').trigger('submit')
    await settle()

    expect(entryButton(wrapper, 'Improved one-off')).toBeTruthy()
    expect(entryButton(wrapper, 'My custom situation')).toBeUndefined()
    const stored = readOneShots()
    expect(stored.situations).toHaveLength(1)
    expect(stored.situations[0].name).toBe('Improved one-off')
    expect(stored.situations[0].visibility).toBe('session-only')
  })

  it('clears the restored selection when a conversation starts', async () => {
    const { wrapper } = await mountSetup()
    await wrapper
      .find('[data-testid="partner-picker"]')
      .findAll('button')
      .find((b) => b.text().includes('Nicole'))
      ?.trigger('click')
    await createCustomSituation(wrapper)
    await settle()
    expect(readOneShots().selectedSituationId).toBeTruthy()

    await startButton(wrapper)?.trigger('click')
    await settle()

    // A new conversation must not preselect the one-off entries again (the entries stay).
    const stored = readOneShots()
    expect(stored.selectedSituationId).toBeNull()
    expect(stored.selectedPartnerId).toBeNull()
    expect(stored.situations).toHaveLength(1)
  })
})
