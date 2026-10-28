import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 4 (T068): persistence across a reload and the offline behaviour. Everything that
 * does not need the AI service stays usable with the network disconnected (SC-008).
 */
test.describe('offline', () => {
  test('keeps sessions after a reload and browses/exports them offline', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // Back to the session list, which is where the offline assertions belong.
    await page.goto('/#/')
    await expect(page.locator('li')).toContainText(/washroom/i)

    // Make sure the service worker is installed and controlling the page.
    await page.waitForFunction(() =>
      'serviceWorker' in navigator ? navigator.serviceWorker.getRegistration() : null,
    )
    await page.reload()
    await expect(page.locator('li')).toContainText(/washroom/i)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration()
          return Boolean(reg?.active)
        }),
      )
      .toBe(true)

    // Go offline and reload — the app shell comes from the service worker.
    await page.context().setOffline(true)
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Your conversations' })).toBeVisible()
    await expect(page.locator('li')).toContainText(/washroom/i)

    // The export still works offline: it is a local blob, no network involved.
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download file' }).click()
    await downloadPromise

    // And the settings screen is reachable.
    await page.goto('/#/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })
})
