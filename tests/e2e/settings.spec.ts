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
