import { expect, test } from '@playwright/test'
import { configureService, startConversation, expectPartnerLine } from './helpers'

/**
 * Debug panel (development TODO): the footer item opens it, lists the current session's AI requests
 * and shows the payload while redacting the API key — even in the production build.
 */
test.describe('debug panel', () => {
  test('lists AI requests and redacts the API key', async ({ page }) => {
    await configureService(page, { chatModel: 'mock-chat' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    const panel = page.getByTestId('debug-panel')
    await expect(panel).toHaveCount(0)

    await page.getByTestId('debug-toggle').click()
    await expect(panel).toBeVisible()

    // A chat request was captured.
    await expect(panel.getByText('Chat').first()).toBeVisible()
    await expect(panel.getByText('Request').first()).toBeVisible()

    // Drill into a request: the payload is visible, and the credential header is redacted once the
    // (collapsed-by-default) headers section is opened — the raw key never appears.
    await panel.getByTestId('debug-entry').first().click()
    await expect(panel.getByTestId('debug-payload')).toBeVisible()
    await expect(panel.getByTestId('debug-headers')).not.toHaveAttribute('open')
    await panel.getByTestId('debug-headers').locator('summary').click()
    await expect(panel.getByText('<REDACTED>').first()).toBeVisible()
    await expect(panel).not.toContainText('Bearer test')
  })
})
