import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 5 (T080): with a service that supports speech and images, a line can be played and
 * an illustration appears; the requests go to the speech/images endpoints.
 */
test.describe('speech and illustrations', () => {
  test('generates a situation illustration and plays the partner line', async ({ page }) => {
    await configureService(page, { speech: true, image: true })

    const imageRequests: string[] = []
    const speechRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/images/generations')) imageRequests.push(req.url())
      if (req.url().includes('/audio/speech')) speechRequests.push(req.url())
    })

    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // The start illustration is generated automatically (FR-028) and stored locally.
    await expect.poll(() => imageRequests.length, { timeout: 20_000 }).toBeGreaterThan(0)
    await expect(page.locator('figure img').first()).toBeVisible({ timeout: 15_000 })

    // Playback is a local blob; the speech request goes to the configured service.
    await page.getByTestId('speech-button').first().click()
    await expect.poll(() => speechRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
    // Playback succeeded: no error hint is rendered next to the button.
    await expect.poll(() => page.getByTestId('speech-hint').count(), { timeout: 15_000 }).toBe(0)
  })

  test('degrades gracefully on a service without these capabilities', async ({ page }) => {
    await configureService(page, { speech: false, image: false })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    // No speech model configured → the playback button stays, nothing is requested.
    await page.getByTestId('speech-button').first().click()
    await expect(page.getByText('This service cannot produce speech.')).toBeVisible()
    // No illustration appears (image model missing).
    await expect(page.locator('figure img')).toHaveCount(0)
  })
})
