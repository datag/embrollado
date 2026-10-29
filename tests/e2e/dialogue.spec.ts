import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 1 + 2 end to end (T033, T047): the dialogue cycle against the mock service.
 * The mock streams the partner line word by word and answers a fixed turn with feedback.
 * The mock's translation is "Hallo! Schön, dich zu treffen. Woher kommst du?" — a fixed line
 * every turn, so counting visible translations distinguishes answered (revealed) from new lines.
 */
test.describe('dialogue cycle', () => {
  test('starts a session and streams the partner first line in the target language', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
  })

  test('sends an answer and shows the feedback block with badge and correction', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.getByTestId('dialogue-input').fill('Is the washroom next to the showers???')
    await page.getByTestId('send').click()

    const feedback = page.getByTestId('feedback')
    await expect(feedback).toBeVisible({ timeout: 20_000 })
    // badge wording and interpretation
    await expect(feedback).toContainText('Well done!')
    await expect(feedback).toContainText('greeted the partner')
    // The translation moved to the partner bubble (FR-057) — not duplicated here.
    await expect(feedback).not.toContainText('Hallo! Schön, dich zu treffen.')
  })

  test('keeps the partner-line translation hidden until the toggle reveals it (FR-057)', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // Hidden by default — the learner should not be able to read ahead.
    const translation = page.getByText('Hallo! Schön, dich zu treffen.')
    await expect(translation).toHaveCount(0)

    // Peek: the toggle reveals the muted translation.
    const toggle = page.getByTestId('translation-toggle').first()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(translation).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // Toggle again hides it.
    await toggle.click()
    await expect(translation).toHaveCount(0)
  })

  test('reveals the answered line immediately and keeps the new line hidden (FR-057)', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    await expect(page.getByText('Hallo! Schön, dich zu treffen.')).toHaveCount(0)

    await page.getByTestId('dialogue-input').fill('Where do you come from?')
    await page.getByTestId('send').click()
    const feedback = page.getByTestId('feedback')
    await expect(feedback).toBeVisible({ timeout: 20_000 })

    // Exactly the answered line's translation is visible — the new line stays hidden.
    await expect(page.getByText('Hallo! Schön, dich zu treffen.')).toHaveCount(1)
    const toggles = page.getByTestId('translation-toggle')
    await expect(toggles).toHaveCount(2)
    await expect(toggles.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(toggles.last()).toHaveAttribute('aria-pressed', 'false')
  })

  test('shows the next partner line after the answer', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.getByTestId('dialogue-input').fill('Where do you come from?')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })
    // The mock always answers the same fixed line for every turn.
    await expect(page.getByText('Nice to meet you').last()).toBeVisible()
  })

  test('explains a turn on demand without hiding the existing feedback (FR-010)', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.getByTestId('dialogue-input').fill('Is the washroom next to the showers???')
    await page.getByTestId('send').click()
    const feedback = page.getByTestId('feedback')
    await expect(feedback).toBeVisible({ timeout: 20_000 })
    await expect(feedback).toContainText('Well done!')

    await page.getByRole('button', { name: 'Explain to me' }).click()
    // The mock answers the explanation request; the previous feedback stays visible.
    await expect(feedback).toContainText(/informal and idiomatic/i, { timeout: 20_000 })
    await expect(feedback).toContainText('Well done!')
  })
})
