import { expect, test } from '@playwright/test'
import { configureService, startConversation, expectPartnerLine } from './helpers'

/**
 * Debug panel (development TODO): the footer item opens a full-width modal that lists the current
 * session's AI requests, redacts the API key, and survives a reload in the same tab — even in the
 * production build.
 */
test.describe('debug panel', () => {
  test('opens as a full-width modal, lists requests, redacts the key and survives a reload', async ({
    page,
  }) => {
    await configureService(page, { chatModel: 'mock-chat' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    const panel = page.getByTestId('debug-panel')
    await expect(panel).toHaveCount(0)

    await page.getByTestId('debug-toggle').click()
    await expect(panel).toBeVisible()

    // A chat request was captured, with an ISO-like timestamp.
    await expect(panel.getByText('Chat').first()).toBeVisible()
    await expect(panel.getByText('Request').first()).toBeVisible()
    await expect(panel.getByText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/).first()).toBeVisible()

    // It is a real modal at the narrow viewport: the backdrop and a full-width box are present.
    await expect(page.getByTestId('debug-backdrop')).toBeVisible()
    const box = await panel.boundingBox()
    const viewport = page.viewportSize()!
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width - 1)

    // Drill into a REQUEST entry: the payload is visible, the credential header is redacted (the
    // response entries show real response headers, which carry no key), and the key never appears.
    await panel.getByTestId('debug-entry').filter({ hasText: 'Request' }).first().click()
    await expect(panel.getByTestId('debug-payload')).toBeVisible()
    await expect(panel.getByTestId('debug-headers')).not.toHaveAttribute('open')
    await panel.getByTestId('debug-headers').locator('summary').click()
    await expect(panel.getByText('<REDACTED>').first()).toBeVisible()
    await expect(panel).not.toContainText('Bearer test')

    // Close and reload: the log survives in this tab.
    await page.getByTestId('debug-close').click()
    await expect(panel).toHaveCount(0)
    await page.reload()
    await page.getByTestId('debug-toggle').click()
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Request').first()).toBeVisible()
  })
})
