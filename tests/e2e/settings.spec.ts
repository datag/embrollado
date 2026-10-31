import { expect, test } from '@playwright/test'

/**
 * Settings — provider profile / service address interaction (settings-profile.md §2.1).
 * The profile leads: picking it pre-fills an auto-filled address, but never a manually entered
 * one, and never replaces a manually chosen auth style.
 */
test('selecting a provider profile pre-fills the service address', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByTestId('service-provider').selectOption('openrouter')
  await expect(page.getByTestId('service-base-url')).toHaveValue('https://openrouter.ai/api/v1')
  // The previous value was the pre-filled default, so the next switch replaces it again.
  await page.getByTestId('service-provider').selectOption('ollama')
  await expect(page.getByTestId('service-base-url')).toHaveValue('http://localhost:11434/v1')
})

test('a manually entered address survives a profile switch', async ({ page }) => {
  await page.goto('/#/settings')
  const url = page.getByTestId('service-base-url')
  // e.g. an EU-bounded OpenRouter host
  await url.fill('https://eu.openrouter.ai/api/v1')
  await page.getByTestId('service-provider').selectOption('ollama')
  await expect(url).toHaveValue('https://eu.openrouter.ai/api/v1')
})

test('a manually chosen auth style survives a profile switch', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByTestId('service-auth-mode').selectOption('x-api-key')
  await page.getByTestId('service-provider').selectOption('ollama')
  await expect(page.getByTestId('service-auth-mode')).toHaveValue('x-api-key')
})

test('the detected profile hint can be applied', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByTestId('service-base-url').fill('https://eu.openrouter.ai/api/v1')
  const hint = page.getByTestId('service-detected-hint')
  await expect(hint).toBeVisible()
  await expect(hint).toContainText('OpenRouter')
  await hint.click()
  await expect(page.getByTestId('service-provider')).toHaveValue('openrouter')
  // The typed address stays exactly as entered.
  await expect(page.getByTestId('service-base-url')).toHaveValue('https://eu.openrouter.ai/api/v1')
  await expect(hint).toHaveCount(0)
})

test('fetch models fills the chat, speech and image suggestions', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByTestId('service-provider').selectOption('openrouter')
  await page.getByTestId('service-base-url').fill('http://localhost:8787/v1')
  await page.getByTestId('service-api-key').fill('test')
  // The fetch button lives in its own row above the model fields, not next to the chat model.
  const fetchBox = await page.getByTestId('fetch-models').boundingBox()
  const chatBox = await page.getByTestId('service-chat-model').boundingBox()
  expect(fetchBox!.y + fetchBox!.height).toBeLessThanOrEqual(chatBox!.y + 4)

  const modelsRequests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('/models')) modelsRequests.push(req.url())
  })
  await page.getByTestId('fetch-models').click()
  // OpenRouter is asked for ALL output modalities — TTS models declare "speech" and are hidden
  // from the unfiltered listing.
  await expect.poll(() => modelsRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
  expect(modelsRequests[0]).toContain('output_modalities=all')

  const chat = page.getByTestId('model-list-chat')
  await expect(chat).toContainText('mock-chat')
  await expect(page.getByTestId('model-list-speech')).toContainText('mock-speech')
  await expect(page.getByTestId('model-list-image')).toContainText('mock-image')
  // Tapping a suggestion applies it and collapses the list.
  await chat.getByRole('button', { name: 'mock-chat' }).click()
  await expect(page.getByTestId('service-chat-model')).toHaveValue('mock-chat')
  await expect(chat).toHaveCount(0)
})
