import { expect, type Page } from '@playwright/test'

/**
 * Shared e2e helpers. Configure the mock AI service through the real settings screen so the
 * tests exercise the same path a learner would.
 */
export const MOCK_BASE_URL = 'http://localhost:8787/v1'

export async function configureService(
  page: Page,
  opts: {
    speech?: boolean
    image?: boolean
    profile?: string
    chatModel?: string
    speechModel?: string
  } = {},
) {
  await page.goto('/#/settings')
  const baseUrl = page.getByTestId('service-base-url')
  // Provider first, then the address — mirrors the settings order. The mock address is a manual
  // entry and therefore survives the profile switch (never overwritten).
  await page.getByTestId('service-provider').selectOption(opts.profile ?? 'openai')
  await page.getByTestId('service-auth-mode').selectOption('bearer')
  await baseUrl.fill(MOCK_BASE_URL)
  await page.getByTestId('service-api-key').fill('test')
  await page.getByTestId('service-chat-model').fill(opts.chatModel ?? 'mock-chat')
  if (opts.speech) {
    await page.getByTestId('service-speech-model').fill(opts.speechModel ?? 'mock-speech')
    await page.getByTestId('service-speech-voice').fill('alloy')
  }
  if (opts.image) {
    await page.getByTestId('service-image-model').fill('mock-image')
  }
  await page.getByTestId('test-connection').click()
  await expect(page.getByText('Connected.')).toBeVisible({ timeout: 15_000 })
}

export async function startConversation(page: Page) {
  await page.goto('/#/new')
  await page.getByRole('button', { name: /washroom/i }).click()
  await page.getByRole('button', { name: /Confectioner/i }).click()
  await page.getByRole('button', { name: 'Start the conversation' }).click()
}

export async function expectPartnerLine(page: Page, fragment: string) {
  await expect(page.getByText(fragment)).toBeVisible({ timeout: 20_000 })
}
