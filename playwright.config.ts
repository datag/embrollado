import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    // The functional specs are viewport-agnostic, so they only run once (pixel5). Only the layout
    // spec (mobile.spec.ts) genuinely needs every mobile viewport; network.spec.ts covers desktop.
    {
      name: 'pixel5',
      use: { viewport: { width: 393, height: 727 } },
      testIgnore: /network\.spec\.ts/,
    },
    {
      name: 'iphone12',
      use: { viewport: { width: 390, height: 844 } },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'iphoneSE',
      use: { viewport: { width: 320, height: 568 } },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
      testMatch: /network\.spec\.ts/,
    },
  ],
  webServer: [
    {
      // Local mock of the OpenAI-compatible endpoints — no test ever touches the network.
      command: 'node tools/mock-ai.mjs',
      url: 'http://localhost:8787/v1/models',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm build && pnpm preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
