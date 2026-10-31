import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

/**
 * Injects a `<meta http-equiv="Content-Security-Policy">` into the built index.html when the
 * build is run with `CSP_MODE=preset` (Vite's strict CLI rejects custom options).
 *
 * GitHub Pages cannot set response headers, so a policy can only be injected into the HTML there.
 * The `preset` policy allows only the app's own origin plus api.openai.com and openrouter.ai.
 * See specs/001-ai-language-roleplay/contracts/deployment.md §4.
 */
function cspMetaPlugin() {
  let mode = 'none'
  return {
    name: 'embrollado-csp-meta',
    configResolved(config: { mode: string }) {
      // Vite's strict CLI rejects unknown options, so CSP mode comes from the CSP_MODE
      // environment variable (set by the gh-pages workflow via `vars.CSP_MODE`).
      mode = config.mode === 'production' ? (process.env.CSP_MODE ?? 'none') : 'none'
    },
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      if (ctx.server || mode !== 'preset') return html
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' https://api.openai.com https://openrouter.ai",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`,
      )
    },
  }
}

/**
 * Prints which `APP_*` build-time variables are present during a build. Since the footer and the
 * access prompt only render what is configured, this makes a missing variable visible in the build
 * log (also in CI) instead of silently disappearing. Only "set / not set" is logged — never a value.
 */
const APP_ENV_VARS = {
  APP_PRIVACY_POLICY_URL: 'the privacy-policy footer links',
  APP_ACCESS_CODE: 'the access-code prompt',
} as const

function reportAppConfig(): Plugin {
  return {
    name: 'embrollado-report-app-config',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      for (const [key, description] of Object.entries(APP_ENV_VARS)) {
        const set = typeof config.env[key] === 'string' && config.env[key] !== ''
        console.log(
          `[app-config] ${key} is ${set ? 'set' : 'not set'} — ${description} will be ${
            set ? 'rendered' : 'hidden'
          }.`,
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), cspMetaPlugin(), reportAppConfig()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Expose the APP_* build-time variables to `import.meta.env` (see src/config/app.ts, .env.example).
  envPrefix: ['VITE_', 'APP_'],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
    assetsInlineLimit: 0,
    modulePreload: {
      polyfill: false,
    },
  },
  server: {
    watch: {
      ignored: ['**/*.md'],
    },
  },
  test: {
    // Vitest 5: config lives in vitest.config.ts; nothing to merge here.
  },
})
