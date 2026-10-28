import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'pixel5',
      use: { viewport: { width: 393, height: 727 } },
    },
    {
      name: 'iphone12',
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'iphoneSE',
      use: { viewport: { width: 320, height: 568 } },
    },
  ],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})