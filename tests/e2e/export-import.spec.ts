import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'
import fs from 'node:fs'

/**
 * User Story 3 (T059): the export/import round trip. The second browser context acts as a clean
 * device: it imports the file, sees the warning, and ends up with the same conversations.
 */
test.describe('export and import', () => {
  test('downloads an export and imports it on a clean device', async ({ browser }) => {
    // Context 1 — the "source" device.
    const sourceContext = await browser.newContext()
    const page = await sourceContext.newPage()
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    await page.getByTestId('dialogue-input').fill('Hi, nice to meet you too!')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })

    await page.goto('/#/')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download file' }).click()
    const download = await downloadPromise
    const filePath = await download.path()
    const buffer = fs.readFileSync(filePath!)

    // The export must never carry the API key or the service configuration.
    const text = buffer.toString('utf8')
    expect(text).not.toContain('apiKey')
    expect(text).not.toContain('baseUrl')

    // Context 2 — a clean device.
    const cleanContext = await browser.newContext()
    const clean = await cleanContext.newPage()
    await clean.goto('/#/')
    await expect(clean.getByText(/no conversations yet/i)).toBeVisible()

    await clean.getByRole('button', { name: 'Import conversations' }).click()
    const input = clean.locator('input[type="file"]')
    await input.setInputFiles({
      name: 'embrollado-export.json',
      mimeType: 'application/json',
      buffer,
    })

    // The warning is shown before anything is replaced (FR-055).
    await expect(clean.getByRole('alertdialog')).toBeVisible()
    await expect(clean.getByRole('alertdialog')).toContainText(/replaces/i)
    await clean.getByRole('button', { name: 'Replace and import' }).click()

    // The imported conversation is present, with its feedback intact.
    await expect(clean.locator('li')).toContainText(/washroom/i)
    await clean
      .locator('button')
      .filter({ hasText: /washroom/i })
      .first()
      .click()
    await expect(clean.getByTestId('feedback')).toBeVisible({ timeout: 15_000 })

    await sourceContext.close()
    await cleanContext.close()
  })

  test('refuses a random JSON file', async ({ page }) => {
    await configureService(page)
    await page.goto('/#/')
    await page.getByRole('button', { name: 'Import conversations' }).click()
    const input = page.locator('input[type="file"]')
    await input.setInputFiles({
      name: 'not-embrollado.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    })
    await expect(page.getByText(/not a valid Embrollado export/i)).toBeVisible()
  })
})
