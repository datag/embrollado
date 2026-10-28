import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 1 + 2 end to end (T033, T047): the dialogue cycle against the mock service.
 * The mock streams the partner line word by word and answers a fixed turn with feedback.
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
    // translation (in the mock: German), badge wording, interpretation
    await expect(feedback).toContainText('Hallo! Schön, dich zu treffen.')
    await expect(feedback).toContainText('Well done!')
    await expect(feedback).toContainText('greeted the partner')
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
    await expect(feedback).toContainText('Hallo! Schön, dich zu treffen.')
  })
})
