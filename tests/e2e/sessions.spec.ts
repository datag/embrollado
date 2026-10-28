import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 3 (T060): the session list — search, rename and confirmed delete.
 */
test.describe('session list', () => {
  test('lists a created session and survives a reload', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.goto('/#/')
    await expect(page.locator('li')).toContainText(/washroom/i)

    await page.reload()
    await expect(page.locator('li')).toContainText(/washroom/i)
  })

  test('searches by keyword', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.goto('/#/')
    await page.getByPlaceholder(/language, situation, keyword/i).fill('washroom')
    await expect(page.locator('li')).toContainText(/washroom/i)
    // A query that matches nothing shows the empty state.
    await page.getByPlaceholder(/language, situation, keyword/i).fill('zzz-no-match')
    await expect(page.getByText(/no conversations match/i)).toBeVisible()
  })

  test('renames a session inline', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello!')

    await page.goto('/#/')
    await page.getByRole('button', { name: 'Rename' }).click()
    await page.getByPlaceholder('Conversation title').fill('My camping chat')
    await page.getByRole('button', { name: '✓' }).click()
    await expect(page.locator('li')).toContainText('My camping chat')
  })

  test('deletes a session after confirmation', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello!')

    await page.goto('/#/')
    await expect(page.locator('li')).toHaveCount(1)
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText(/no conversations yet/i)).toBeVisible()
  })
})
