import { expect, test, type Page } from '@playwright/test'
import { configureService, expectPartnerLine } from './helpers'

/**
 * Learner-defined entries in the Setup screen, end to end (FR-045/046/047, SC-017): a custom
 * entry is visible and recognisably selected, a template persists across a reload, one-off entries
 * survive a reload in the same tab (sessionStorage) and can be edited or removed again.
 */

async function createCustomSituation(page: Page, name: string, opts: { template?: boolean } = {}) {
  await page.getByRole('button', { name: 'Write my own' }).first().click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.locator('textarea').fill('A situation for the setup e2e test.')
  if (opts.template) {
    await page.getByLabel('Save as a template', { exact: true }).check()
  }
  await page.getByRole('button', { name: 'Continue' }).click()
}

const situationPicker = (page: Page) => page.getByTestId('situation-picker')

test('a one-off situation survives a reload in the same tab and stays selected', async ({
  page,
}) => {
  await page.goto('/#/new')
  await createCustomSituation(page, 'Park bench chat')

  const entry = situationPicker(page).getByRole('button', { name: /Park bench chat/ })
  await expect(entry).toBeVisible()
  await expect(entry).toBeInViewport() // the list scrolled the fresh entry into view
  await expect(entry).toContainText('ONE-TIME')
  await expect(entry).toHaveClass(/border-accent/) // the selected highlight
  // The selected row offers edit, promote (★) and remove (✕).
  await expect(situationPicker(page).getByTestId('edit-entry')).toBeVisible()
  await expect(situationPicker(page).getByTestId('promote-entry')).toBeVisible()
  await expect(situationPicker(page).getByTestId('remove-entry')).toBeVisible()

  // A one-off entry lives for the browser tab (FR-046): after a reload the entry AND the
  // selection are still there, so the ★ path stays reachable.
  await page.reload()
  await expect(situationPicker(page).getByText('Park bench chat')).toBeVisible()
  const restored = situationPicker(page).getByRole('button', { name: /Park bench chat/ })
  await expect(restored).toHaveClass(/border-accent/)
  await expect(situationPicker(page).getByTestId('promote-entry')).toBeVisible()
})

test('a template situation appears immediately with the CUSTOM badge and survives a reload', async ({
  page,
}) => {
  await page.goto('/#/new')
  await createCustomSituation(page, 'Hotel bar small talk', { template: true })

  // Immediately visible in the list (the refresh race is fixed), marked CUSTOM, no promote action.
  const entry = situationPicker(page).getByRole('button', { name: /Hotel bar small talk/ })
  await expect(entry).toBeVisible()
  await expect(entry).toBeInViewport()
  await expect(entry).toContainText('CUSTOM')
  await expect(entry).toHaveClass(/border-accent/)
  await expect(situationPicker(page).getByTestId('promote-entry')).not.toBeVisible()
  await expect(situationPicker(page).getByTestId('edit-entry')).toBeVisible()
  await expect(situationPicker(page).getByTestId('remove-entry')).toBeVisible()

  // A template persists and is offered again after a reload (FR-045, SC-017).
  await page.reload()
  await expect(
    situationPicker(page).getByRole('button', { name: /Hotel bar small talk/ }),
  ).toBeVisible()
})

test('edits a stored template without duplicating it', async ({ page }) => {
  await page.goto('/#/new')
  await createCustomSituation(page, 'Editable template', { template: true })

  await situationPicker(page).getByTestId('edit-entry').click()
  // The form opens prefilled; there is no "save as a template" toggle for an existing template.
  await expect(page.getByText('Edit entry')).toBeVisible()
  await expect(page.getByLabel('Save as a template', { exact: true })).toHaveCount(0)
  await page.getByLabel('Name', { exact: true }).fill('Renamed template')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(
    situationPicker(page).getByRole('button', { name: /Renamed template/ }),
  ).toBeVisible()
  // Same identity: the old name is gone, not duplicated.
  await expect(situationPicker(page).getByText('Editable template')).toHaveCount(0)
})

test('starting a conversation clears the restored one-off selection', async ({ page }) => {
  await configureService(page)
  await page.goto('/#/new')
  await createCustomSituation(page, 'Selection check')
  await page.getByRole('button', { name: /Nicole/i }).click()

  // Reload restores the one-off selection; then start a real conversation.
  await page.reload()
  await expect(situationPicker(page).getByTestId('promote-entry')).toBeVisible()
  await page.getByRole('button', { name: 'Start the conversation' }).click()
  await expectPartnerLine(page, 'Hello! Nice to meet you.')

  // A new conversation setup must not preselect the one-off entry again — but the entry itself
  // stays until the tab closes.
  await page.goto('/#/new')
  await expect(situationPicker(page).getByTestId('promote-entry')).toHaveCount(0)
  await expect(situationPicker(page).getByText('Selection check')).toBeVisible()
})

test('removing a one-off entry clears it without a confirmation; removing a template asks first', async ({
  page,
}) => {
  await page.goto('/#/new')
  await createCustomSituation(page, 'One-off to remove')

  // One-off removal needs no confirmation.
  await situationPicker(page).getByTestId('remove-entry').click()
  await expect(situationPicker(page).getByText('One-off to remove')).toHaveCount(0)

  // Create a template and remove it with the native confirm accepted.
  await createCustomSituation(page, 'Template to remove', { template: true })
  page.once('dialog', (dialog) => dialog.accept())
  await situationPicker(page).getByTestId('remove-entry').click()
  await expect(situationPicker(page).getByText('Template to remove')).toHaveCount(0)

  // Declining the confirmation keeps the template.
  await createCustomSituation(page, 'Kept template', { template: true })
  page.once('dialog', (dialog) => dialog.dismiss())
  await situationPicker(page).getByTestId('remove-entry').click()
  await expect(situationPicker(page).getByText('Kept template')).toBeVisible()
})
