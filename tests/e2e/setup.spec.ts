import { expect, test, type Page } from '@playwright/test'

/**
 * Learner-defined entries in the Setup screen, end to end (FR-045/046/047, SC-017): a custom
 * entry is visible and recognisably selected, a template persists across a reload, and both the
 * one-off and the template entry can be removed again.
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

test('a one-off situation is listed, visibly selected and marked ONE-TIME, and gone after reload', async ({
  page,
}) => {
  await page.goto('/#/new')
  await createCustomSituation(page, 'Park bench chat')

  // Listed and marked as one-off, with the built-in "write my own" row still there.
  const entry = situationPicker(page).getByRole('button', { name: /Park bench chat/ })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('ONE-TIME')
  await expect(entry).toHaveClass(/border-accent/) // the selected highlight
  // The selected row offers promote (★) and remove (✕).
  await expect(situationPicker(page).getByTestId('promote-entry')).toBeVisible()
  await expect(situationPicker(page).getByTestId('remove-entry')).toBeVisible()

  // A one-off entry is never stored (SC-017): after a reload it is not offered again.
  await page.reload()
  await expect(situationPicker(page).getByRole('button', { name: 'Write my own' })).toBeVisible()
  await expect(situationPicker(page).getByText('Park bench chat')).toHaveCount(0)
})

test('a template situation appears immediately with the CUSTOM badge and survives a reload', async ({
  page,
}) => {
  await page.goto('/#/new')
  await createCustomSituation(page, 'Hotel bar small talk', { template: true })

  // Immediately visible in the list (the refresh race is fixed), marked CUSTOM, no promote action.
  const entry = situationPicker(page).getByRole('button', { name: /Hotel bar small talk/ })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('CUSTOM')
  await expect(entry).toHaveClass(/border-accent/)
  await expect(situationPicker(page).getByTestId('promote-entry')).not.toBeVisible()
  await expect(situationPicker(page).getByTestId('remove-entry')).toBeVisible()

  // A template persists and is offered again after a reload (FR-045, SC-017).
  await page.reload()
  await expect(
    situationPicker(page).getByRole('button', { name: /Hotel bar small talk/ }),
  ).toBeVisible()
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
