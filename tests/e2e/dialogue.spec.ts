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
    // badge wording and interpretation (the learner's answer, translated into German)
    await expect(feedback).toContainText('Well done!')
    await expect(feedback).toContainText('Ist der Waschraum neben den Duschen?')
    // The explanation addresses the learner objectively, never in the partner's first person (FR-061).
    await expect(feedback).toContainText('Deine Antwort ist verständlich')
    // The concrete error pair renders as original → corrected next to the detail (FR-062).
    await expect(feedback).toContainText('showers')
    await expect(feedback).toContainText('washrooms')
    await expect(feedback.getByText('→')).toBeVisible()
    // The badge must be a visible coloured pill (its bg utility is not generated otherwise).
    const badgeBg = await page.evaluate(() => {
      const el = document.querySelector('span[class*="bg-badge-"]')
      return el ? getComputedStyle(el).backgroundColor : null
    })
    expect(badgeBg ?? 'rgba(0, 0, 0, 0)').not.toBe('rgba(0, 0, 0, 0)')
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

  test('moves focus back into the input after every AI feedback', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // Sending focuses the send button; the focus must return to the composer once the feedback
    // (and the disabled state) is gone, so the learner can keep typing without clicking.
    await page.getByTestId('dialogue-input').fill('Where do you come from?')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null))
      .toBe('dialogue-input')
  })

  test('moves focus into the input when opening an existing conversation', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // Leave to the session list and open the same, already running conversation again.
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Your conversations' })).toBeVisible()
    await page
      .getByRole('button', { name: /washroom/i })
      .first()
      .click()
    await expect(page.getByTestId('dialogue-input')).toBeEnabled({ timeout: 20_000 })

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null))
      .toBe('dialogue-input')
  })

  test('scrolls the window to the bottom when a new message arrives', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // Grow the transcript so it overflows the viewport (dialogue runs on the pixel5 project only).
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('dialogue-input').fill('Where do you come from?')
      await page.getByTestId('send').click()
      await expect(page.getByTestId('feedback')).toHaveCount(i + 1, { timeout: 20_000 })
    }

    // The transcript must overflow the viewport for the assertion to be meaningful.
    const maxScroll = await page.evaluate(() => {
      const doc = document.documentElement
      return Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight
    })
    expect(maxScroll).toBeGreaterThan(0)

    // And the app must follow the new content down instead of leaving the learner to scroll.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const doc = document.documentElement
          const max = Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight
          return window.scrollY >= max - 4
        }),
      )
      .toBe(true)
  })

  test('locks the send button and shows a spinner while the AI responds', async ({ page }) => {
    await configureService(page, { chatModel: 'mock-slow-chat' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // The mock-slow-chat model answers after ~1 s: the send button must be locked for the whole
    // wait and show a spinner instead of the arrow, then unlock again.
    await page.getByTestId('dialogue-input').fill('Where do you come from?')
    await page.getByTestId('send').click()
    const send = page.getByTestId('send')
    await expect(send).toBeDisabled()
    await expect(send.locator('[data-testid="spinner"]')).toBeVisible()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })
    // The streaming lock is released once the response landed…
    await expect(send.locator('[data-testid="spinner"]')).toHaveCount(0)
    // …and the button becomes active again as soon as the learner types.
    await page.getByTestId('dialogue-input').fill('Anything else?')
    await expect(send).toBeEnabled()
  })

  test('continues a running session after a reload (history rebuilt from stored turns)', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.getByTestId('dialogue-input').fill('Where do you come from?')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })

    await page.reload()
    await expect(page.getByTestId('dialogue-input')).toBeEnabled({ timeout: 20_000 })
    await page.getByTestId('dialogue-input').fill('Is the washroom nearby?')
    await page.getByTestId('send').click()
    // The resumed session builds its dialogue-only history from the stored turns instead of
    // starting with an empty context (which would answer with an "unexpected format" error).
    const continued = page.getByTestId('feedback')
    await expect(continued).toBeVisible({ timeout: 20_000 })
    await expect(continued).toContainText('Well done!')
  })

  test('keeps the learner of the start after the profile changed (FR-065)', async ({ page }) => {
    await configureService(page)

    // The profile at the start of the conversation.
    await page.getByTestId('profile-name').fill('Dominik')
    await startConversation(page, { knowsLearner: true })
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    const conversationUrl = page.url()

    // The learner changes their profile while the conversation runs.
    await page.goto('/#/settings')
    await page.getByTestId('profile-name').fill('Monika')

    // A full reload rebuilds the system prompt from the stored session.
    await page.goto(conversationUrl)
    await page.reload()
    await expect(page.getByTestId('dialogue-input')).toBeEnabled({ timeout: 20_000 })
    await page.getByTestId('dialogue-input').fill('Is the washroom nearby?')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })

    // The request that was just sent still describes Dominik.
    await page.getByTestId('debug-toggle').click()
    const panel = page.getByTestId('debug-panel')
    await expect(panel).toBeVisible()
    await panel.getByTestId('debug-entry').filter({ hasText: 'Request' }).first().click()
    const payload = panel.getByTestId('debug-payload')
    await expect(payload).toContainText('Their name is Dominik')
    await expect(payload).not.toContainText('Monika')
  })

  test('streams the partner line and holds the feedback position while it arrives', async ({
    page,
  }) => {
    // The `mock-streaming-chat` model pauses inside the `partnerText` string, so the mid-stream
    // rendering is observable: the line is only partially there and the assessment is still
    // pending (FR-035).
    await configureService(page, { chatModel: 'mock-streaming-chat' })
    await startConversation(page)

    // The opening turn: the partner line streams in — partially.
    const streaming = page.getByTestId('partner-streaming')
    await expect(streaming).toBeVisible({ timeout: 20_000 })
    await expect(streaming).toContainText('Hello! Nice to')
    await expect(streaming).not.toContainText('come from?')
    // The opening turn has no learner answer, so there is no assessment to wait for.
    await expect(page.getByTestId('feedback-placeholder')).toHaveCount(0)

    // The complete line replaces the streamed one.
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    await expect(page.getByTestId('partner-streaming')).toHaveCount(0)

    await page.getByTestId('dialogue-input').fill('Where do you come from?')
    await page.getByTestId('send').click()

    // While the turn is generated, the feedback block's position is held by the loading card —
    // the app's own status message, never the partner's voice (FR-061).
    const placeholder = page.getByTestId('feedback-placeholder')
    await expect(placeholder).toBeVisible({ timeout: 20_000 })
    await expect(placeholder).toContainText('Your answer is being assessed…')
    // The new partner line streams in partially, too.
    await expect(page.getByTestId('partner-streaming')).toContainText('Hello! Nice to')
    await expect(page.getByTestId('partner-streaming')).not.toContainText('come from?')

    // When the stream completes, the real assessment replaces the loading card.
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })
    await expect(placeholder).toHaveCount(0)
    await expect(page.getByTestId('partner-streaming')).toHaveCount(0)
  })

  test('keeps the partner line still when the assessment arrives (T132)', async ({ page }) => {
    // The assessment is variable in height (sometimes only the badge, sometimes every field). When
    // it lands the partner line must not be pushed around. This only holds when the transcript
    // actually overflows the viewport (the reading case) — on a page that fits there is no scroll
    // room, so the line must just stay on screen. Build a tall transcript first.
    await configureService(page, { chatModel: 'mock-streaming-chat' })
    await startConversation(page)
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('dialogue-input').fill('Where do you come from?')
      await page.getByTestId('send').click()
      await expect(page.getByTestId('feedback')).toHaveCount(i + 1, { timeout: 20_000 })
    }
    // The transcript now overflows, so there is scroll room to keep the line still.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    )
    expect(overflow).toBeGreaterThan(300)

    await page.getByTestId('dialogue-input').fill('Is this the washroom?')
    await page.getByTestId('send').click()

    // Mid-stream: remember where the newest line sits in the viewport. The app snaps the wheel to
    // the foot when the line first appears — sample only after that has settled (the mock pauses
    // for 2 s, so this window is deterministic).
    const streaming = page.getByTestId('partner-streaming')
    await expect(streaming).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(200)
    const streamedTop = await streaming.evaluate((el) => el.getBoundingClientRect().top)

    // When the assessment lands, the line must stay at that exact viewport position. The partner
    // line's permanent slot gains the translation toggle column (absent while streaming), so a
    // small residual is expected — what must NOT happen is the line being shoved by the block's
    // height (~200–330 px): the anchor keeps it within a few dozen pixels.
    await expect(page.getByTestId('feedback')).toHaveCount(4, { timeout: 20_000 })
    const finalLine = page.getByTestId('partner-line').last()
    const drift = await finalLine.evaluate(
      (el, top) => el.getBoundingClientRect().top - top,
      streamedTop,
    )
    expect(Math.abs(drift)).toBeLessThanOrEqual(48)
  })

  test('sends the failed answer only once when the learner retries (T129)', async ({ page }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // The first learner turn answers without a usable partnerText: the app rejects the answer
    // ("unexpected format", FR-025) and offers the retry. Every later request goes to the mock.
    let broken = false
    await page.route('**/v1/chat/completions', async (route) => {
      const body = route.request().postData() ?? ''
      const isLearnerTurn = body.includes('this is the answer you assess')
      if (!isLearnerTurn || broken) {
        await route.continue()
        return
      }
      broken = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '{"translation":"nope"}' },
              finish_reason: 'stop',
            },
          ],
        }),
      })
    })

    const answer = 'Is the washroom nearby?'
    await page.getByTestId('dialogue-input').fill(answer)
    await page.getByTestId('send').click()

    // The rejected answer shows the error and offers the retry.
    await expect(
      page.getByText('The service answered in an unexpected format.').first(),
    ).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Send again' }).click()

    // The retry succeeds — the assessment lands, and the answer is shown exactly once.
    await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: answer })).toHaveCount(1)

    // The request the service received carries the answer exactly once: the failed attempt left
    // nothing behind in the model-side history, so the retry did not repeat it.
    const payload = await page.evaluate(() => {
      const raw = sessionStorage.getItem('embrollado.debug.v1')
      if (!raw) return null
      const doc = JSON.parse(raw) as {
        data: { entries: Array<{ direction: string; kind: string; payload: string }> }
      }
      // The entries are newest first — the newest chat request is the retry.
      const request = doc.data.entries.find((e) => e.direction === 'request' && e.kind === 'chat')
      return request?.payload ?? null
    })
    expect(payload).not.toBeNull()
    expect(payload!.split(answer).length - 1).toBe(1)
  })
})
