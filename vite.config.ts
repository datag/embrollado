import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

/**
 * Injects a `<meta http-equiv="Content-Security-Policy">` into the built index.html when the
 * build is run with `--csp=preset` or `CSP_MODE=preset`.
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
      mode = (config.mode as 'production') === 'production' ? process.env.CSP_MODE ?? 'none' : 'none'
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

export default defineConfig({
  plugins: [vue(), tailwindcss(), cspMetaPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
  test: {
    // Vitest 5: config lives in vitest.config.ts; nothing to merge here.
  },
})