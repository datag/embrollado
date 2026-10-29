import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * User Story 5 (T080): with a service that supports speech and images, a line can be played and
 * an illustration is generated ON DEMAND; the requests go to the speech/images endpoints.
 *
 * FR-028 as amended: no automatic illustration at session start — the picture button next to the
 * input box is only offered when the service can produce images, and only a click triggers the
 * two requests (scene narration → picture).
 */
test.describe('speech and illustrations', () => {
  test('generates a picture only on request and plays the partner line', async ({ page }) => {
    await configureService(page, { speech: true, image: true })

    const imageRequests: string[] = []
    const speechRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/images/generations')) imageRequests.push(req.url())
      if (req.url().includes('/audio/speech')) speechRequests.push(req.url())
    })

    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    // No automatic image call at session start (FR-028 as amended) — the button is the trigger.
    await expect.poll(() => imageRequests.length).toBe(0)
    await expect(page.getByTestId('illustration-button')).toBeVisible()

    await page.getByTestId('illustration-button').click()
    await expect.poll(() => imageRequests.length, { timeout: 20_000 }).toBeGreaterThan(0)
    await expect(page.locator('figure img').first()).toBeVisible({ timeout: 15_000 })

    // Playback is a local blob; the speech request goes to the configured service.
    await page.getByTestId('speech-button').first().click()
    await expect.poll(() => speechRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
    // Playback succeeded: no error hint is rendered next to the button.
    await expect.poll(() => page.getByTestId('speech-hint').count(), { timeout: 15_000 }).toBe(0)
  })

  test('replaces the picture on a second request instead of accumulating', async ({ page }) => {
    await configureService(page, { image: true })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    const imageRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/images/generations')) imageRequests.push(req.url())
    })

    await page.getByTestId('illustration-button').click()
    await expect.poll(() => imageRequests.length, { timeout: 20_000 }).toBe(1)
    await expect(page.locator('figure img')).toHaveCount(1)

    await page.getByTestId('illustration-button').click()
    await expect.poll(() => imageRequests.length, { timeout: 20_000 }).toBe(2)
    // Still exactly one rendered picture — the old one was replaced, not duplicated.
    await expect(page.locator('figure img')).toHaveCount(1)
  })

  test('opens the full-resolution lightbox on click and closes on Escape', async ({ page }) => {
    await configureService(page, { image: true })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await page.getByTestId('illustration-button').click()
    await expect(page.locator('figure img').first()).toBeVisible({ timeout: 15_000 })

    // Clicking the thumbnail opens the native <dialog> lightbox with the same picture.
    await page.locator('figure img').first().click()
    const dialog = page.locator('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('img')).toHaveCount(1)

    // The lightbox shrink-wraps the picture: it must not stretch over the full viewport width.
    const dialogBox = await dialog.boundingBox()
    const imgBox = await dialog.locator('img').boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(imgBox).not.toBeNull()
    // Only the p-2 padding (2×8 px) plus the 2×1 px border separate image from dialog edge.
    expect(dialogBox!.width - imgBox!.width).toBeLessThanOrEqual(24)
    expect(dialogBox!.width).toBeLessThan(320)

    // Escape closes it again (native <dialog> cancel path).
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('without an image model the button is absent and the input takes full width', async ({
    page,
  }) => {
    await configureService(page)
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    await expect(page.getByTestId('illustration-button')).toHaveCount(0)
    const imageRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/images/generations')) imageRequests.push(req.url())
    })
    await expect(page.locator('figure img')).toHaveCount(0)
    expect(imageRequests).toEqual([])
  })

  test('hides the button when the provider profile cannot produce images', async ({ page }) => {
    // Ollama/llama.cpp/vLLM/LM Studio expose no images path — a configured image model alone must
    // not produce a button that can only fail on every click.
    await configureService(page, { image: true, profile: 'ollama' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    await expect(page.getByTestId('illustration-button')).toHaveCount(0)
  })

  test('plays a pcm-only service (Gemini-TTS style) by converting pcm to wav', async ({ page }) => {
    // OpenRouter profile requests pcm (the only format Gemini TTS accepts); the mock answers
    // header-less 16-bit LE PCM and the app wraps it in WAV before playback.
    await configureService(page, { speech: true, profile: 'openrouter' })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')

    const speechRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/audio/speech')) speechRequests.push(req.postData() ?? '')
    })

    await page.getByTestId('speech-button').first().click()
    await expect.poll(() => speechRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
    // The request asked for the pcm format…
    await expect.poll(() => speechRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
    expect(speechRequests[0]).toContain('"response_format":"pcm"')
    // …and playback succeeded (no hint) — the stored bytes were cached as playable WAV.
    await expect.poll(() => page.getByTestId('speech-hint').count(), { timeout: 15_000 }).toBe(0)
  })

  test('degrades gracefully on a service without these capabilities', async ({ page }) => {
    await configureService(page, { speech: false, image: false })
    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    // No speech model configured → the playback button stays, nothing is requested.
    await page.getByTestId('speech-button').first().click()
    await expect(page.getByText('This service cannot produce speech.')).toBeVisible()
    // No illustration button and no illustration appear (image model missing).
    await expect(page.getByTestId('illustration-button')).toHaveCount(0)
    await expect(page.locator('figure img')).toHaveCount(0)
  })
})
