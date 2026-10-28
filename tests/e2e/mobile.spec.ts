import { expect, test } from '@playwright/test'
import { configureService, expectPartnerLine, startConversation } from './helpers'

/**
 * Constitution Principle I (T090): no horizontal scrolling at the narrow viewports and touch
 * targets of at least 44 × 44 px on the core screens.
 */
test.describe('mobile layout', () => {
  test('has no horizontal scrolling and 44px touch targets', async ({ page }) => {
    await configureService(page)

    // Core screens: settings, setup and the sessions list.
    await assertNoHorizontalScroll(page, 'settings')
    await page.goto('/#/new')
    await assertNoHorizontalScroll(page, 'setup')
    await assertTouchTargets(page)

    await startConversation(page)
    await expectPartnerLine(page, 'Hello! Nice to meet you.')
    await assertNoHorizontalScroll(page, 'dialogue')

    await page.goto('/#/')
    await assertNoHorizontalScroll(page, 'sessions')
  })
})

async function assertNoHorizontalScroll(page: import('@playwright/test').Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(
    overflow.scrollWidth,
    `${label}: page scrolls horizontally (${overflow.scrollWidth} > ${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth + 1)
}

async function assertTouchTargets(page: import('@playwright/test').Page) {
  const small = await page.evaluate(() => {
    const offenders: string[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button'))) {
      const r = el.getBoundingClientRect()
      if (el.offsetParent === null) continue // hidden
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        offenders.push(
          `${el.textContent?.trim().slice(0, 24) || 'button'} ${Math.round(r.width)}x${Math.round(r.height)}`,
        )
      }
    }
    return offenders
  })
  expect(small).toEqual([])
}
