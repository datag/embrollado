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

    // Chronological sort, newest first (timestamps non-increasing down the list).
    const stamps = await panel.getByTestId('debug-entry').allTextContents()
    const times = stamps
      .map((s) => (s.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/) ?? [])[0] ?? '')
      .map((t) => Date.parse(t.replace(' ', 'T')))
    for (let i = 1; i < times.length; i++) {
      expect(times[i - 1]).toBeGreaterThanOrEqual(times[i])
    }

    // It is a real modal at the narrow viewport: the backdrop and a full-width box are present.
    await expect(page.getByTestId('debug-backdrop')).toBeVisible()
    const box = await panel.boundingBox()
    const viewport = page.viewportSize()!
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width - 1)

    // Scroll chaining is disabled: the page behind is locked while the modal is open.
    await page.evaluate(() => {
      const sp = document.createElement('div')
      sp.style.height = '3000px'
      sp.setAttribute('data-testid', 'spacer')
      document.body.appendChild(sp)
      window.scrollTo(0, 200)
    })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await page.getByTestId('debug-panel').hover()
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(150)
    const scrollYWhileOpen = await page.evaluate(() => window.scrollY)
    expect(scrollYWhileOpen).toBeGreaterThan(0) // the overlay scroll did NOT scroll the page to bottom

    // Drill into a REQUEST entry: the payload is visible, the credential header is redacted (the
    // response entries show real response headers, which carry no key), and the key never appears.
    await panel.getByTestId('debug-entry').filter({ hasText: 'Request' }).first().click()
    await expect(panel.getByTestId('debug-payload')).toBeVisible()
    await expect(panel.getByTestId('debug-detail')).toContainText('Request')
    await expect(panel.getByTestId('debug-detail')).toContainText('Chat')
    // The header back control returns to the list.
    await expect(panel.getByTestId('debug-back')).toBeVisible()
    await panel.getByTestId('debug-back').click()
    await expect(panel.getByTestId('debug-list')).toBeVisible()
    await expect(panel.getByTestId('debug-back')).toHaveCount(0)
    // Re-open a detail for the redaction assertions.
    await panel.getByTestId('debug-entry').filter({ hasText: 'Request' }).first().click()
    // The payload is unfolded by default (the toggle offers "Show raw").
    await expect(panel.getByTestId('debug-expand')).toHaveText('Show raw')
    await expect(panel.getByTestId('debug-headers')).not.toHaveAttribute('open')
    await panel.getByTestId('debug-headers').locator('summary').click()
    await expect(panel.getByText('<REDACTED>').first()).toBeVisible()
    await expect(panel).not.toContainText('Bearer test')

    // Close and reload: the log survives in this tab.
    await page.getByTestId('debug-close').click()
    await expect(panel).toHaveCount(0)
    // The footer item is a small chip-like control and the last interactive element of the footer.
    const chip = page.getByTestId('debug-toggle')
    await expect(chip).toHaveText('Traffic')
    await expect(chip).not.toHaveClass(/rounded-full/)
    await expect(chip).toHaveClass(/uppercase/)
    await page.reload()
    await page.getByTestId('debug-toggle').click()
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Request').first()).toBeVisible()
  })
})
