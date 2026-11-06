import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'
import { APP_CATEGORIES, APP_REFERER_URL, APP_TITLE } from '@/ai/attribution'

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

/**
 * FR-066: the app identifies itself to a provider that documents app attribution (OpenRouter).
 * The headers are non-simple headers, so a server that does not allow them in its CORS preflight
 * would reject every request — a profile without the documented headers must not receive them.
 */
test.describe('app attribution (FR-066)', () => {
  test('sends the attribution headers to the profile that documents them', async ({ page }) => {
    const headers: Record<string, string>[] = []
    page.on('request', (req) => {
      if (req.url().includes('localhost:8787')) headers.push(req.headers())
    })

    await configureService(page, { profile: 'openrouter' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    const chat = headers.find((h) => h['content-type']?.includes('application/json'))
    expect(chat?.['http-referer']).toBe(APP_REFERER_URL)
    expect(chat?.['x-openrouter-title']).toBe(APP_TITLE)
    expect(chat?.['x-openrouter-categories']).toBe(APP_CATEGORIES)
    expect(chat?.['x-openrouter-app-visibility']).toBe('hidden')
  })

  test('sends no attribution headers to a profile without them', async ({ page }) => {
    const headers: Record<string, string>[] = []
    page.on('request', (req) => {
      if (req.url().includes('localhost:8787')) headers.push(req.headers())
    })

    await configureService(page, { profile: 'openai' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    const chat = headers.find((h) => h['content-type']?.includes('application/json'))
    expect(chat).toBeDefined()
    expect(chat?.['http-referer']).toBeUndefined()
    expect(chat?.['x-openrouter-title']).toBeUndefined()
    expect(chat?.['x-openrouter-app-visibility']).toBeUndefined()
  })
})
