import { expect, test } from '@playwright/test'

/**
 * The licence files ship with the app and are linked from the About screen. They must be reachable
 * in the deployment (here: the production build on :4173) and stay available when the network is
 * unavailable — the service worker keeps them in its shell cache.
 */
test.describe('licence files', () => {
  test('the About screen links the shipped licence files', async ({ page }) => {
    await page.goto('/#/about')

    await expect(page.getByRole('link', { name: 'Licence text (MIT)' })).toHaveAttribute(
      'href',
      '/LICENSE',
    )
    await expect(page.getByRole('link', { name: 'Third-party licences' })).toHaveAttribute(
      'href',
      '/THIRD_PARTY_LICENSES.md',
    )
    await expect(
      page.getByRole('link', { name: 'Font licence (SIL Open Font License 1.1)' }),
    ).toHaveAttribute('href', '/LICENSES/OFL.txt')
    await expect(page.getByRole('link', { name: 'Font subsetting notice' })).toHaveAttribute(
      'href',
      '/LICENSES/NOTICE.md',
    )
  })

  test('the deployed app serves the licence files', async ({ page }) => {
    const licence = await page.request.get('/LICENSE')
    expect(licence.status()).toBe(200)
    expect(await licence.text()).toContain('MIT License')

    const thirdParty = await page.request.get('/THIRD_PARTY_LICENSES.md')
    expect(thirdParty.status()).toBe(200)
    const notices = await thirdParty.text()
    expect(notices).toContain('DOMPurify')
    expect(notices).toContain('Atkinson Hyperlegible Next')

    const ofl = await page.request.get('/LICENSES/OFL.txt')
    expect(ofl.status()).toBe(200)
    expect(await ofl.text()).toContain('SIL OPEN FONT LICENSE')

    const notice = await page.request.get('/LICENSES/NOTICE.md')
    expect(notice.status()).toBe(200)
    expect(await notice.text()).toContain('Atkinson Hyperlegible Next')
  })

  test('the licence files are available offline', async ({ page }) => {
    await page.goto('/#/about')

    // Wait for the service worker and let it take control of the page.
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return Boolean(reg?.active)
    })
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

    await page.context().setOffline(true)

    for (const file of ['/LICENSE', '/THIRD_PARTY_LICENSES.md', '/LICENSES/OFL.txt']) {
      const text = await page.evaluate(async (url) => {
        const response = await fetch(url)
        return response.ok ? response.text() : ''
      }, file)
      expect(text, `${file} is not served from the cache`).not.toBe('')
    }
  })
})
