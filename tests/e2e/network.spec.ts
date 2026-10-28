import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 4 (T069): network isolation. During a full session the only origins contacted are
 * the app's own and the configured AI service — zero third-party requests, zero CSP violations.
 */
test.describe('network isolation', () => {
  test('touches only localhost during a full session', async ({ page }) => {
    const external: string[] = []
    const cspViolations: string[] = []
    page.on('request', (req) => {
      const { origin } = new URL(req.url())
      if (!['http://localhost:4173', 'http://localhost:8787'].includes(origin)) {
        external.push(req.url())
      }
    })
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('Content Security Policy') || text.includes('refused to connect')) {
        cspViolations.push(text)
      }
    })

    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    await page.getByTestId('dialogue-input').fill('This is my answer.')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })

    expect(external).toEqual([])
    expect(cspViolations).toEqual([])
  })
})
