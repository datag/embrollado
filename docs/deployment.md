# Deployment

Two supported deployments, two different CSP stories. The **self-hosted** one is the primary
deployment because it is the only one that can honour the constitution's Content-Security-Policy
rule for a runtime-configured API origin.

## 1. Self-hosted (strict CSP; recommended)

Build once and serve `dist/` with a host that sets the `Content-Security-Policy` header. The
bundled helper server does exactly that:

```bash
cp embrollado.config.example.json embrollado.config.json   # set "allowedApiOrigin"
pnpm build
node tools/serve.mjs            # http://localhost:4174
```

The header it sets (example with OpenAI):

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
font-src 'self'; connect-src 'self' https://api.openai.com; worker-src 'self';
object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

No `unsafe-inline`, no `unsafe-eval` — verified in headless Chromium against a production build
(zero violations).

### Host snippets for the same header

**nginx**

```nginx
location / {
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.openai.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
}
```

**Caddy**

```
header {
    Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.openai.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
}
```

**Netlify** (`netlify.toml`)

```toml
[[headers]]
for = "/*"
[headers.values]
Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.openai.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
```

Replace `https://api.openai.com` with your configured AI service's origin.

## 2. GitHub Pages (zero setup)

The repository ships `.github/workflows/gh-pages.yml`. On every push to `main` it runs the quality
gates (type-check, lint, unit tests, e2e tests) and then deploys:

```
checkout → corepack (pnpm 10.0.0) → setup-node 24 (pnpm cache) → pnpm install --frozen-lockfile
         → pnpm typecheck → pnpm lint → pnpm test:unit → playwright install → pnpm test:e2e
         → pnpm build --base=/<repo>/ → upload-pages-artifact → deploy-pages
```

### One-time setup

**Repository settings → Pages → Source: GitHub Actions.**

### CSP on GitHub Pages

GitHub Pages cannot set response headers, so the Pages build ships **without** a CSP by default.
Set the repository variable **`CSP_MODE=preset`** to inject a meta policy at build time that allows
only the app's own origin plus `api.openai.com` and `openrouter.ai` — only usable with those two
providers. This is a documented deviation from the strict guarantee, narrowing
`connect-src` to the preset providers for this deployment only.

### Why it works

- **Hash routing** (`#/sessions`) means no rewrite rule is needed on any static host; a refresh
  never 404s.
- The base path is computed by the workflow (`/` for a user site, `/<repo>/` otherwise) and passed
  to `vite build --base`, so all asset URLs and the service-worker scope follow it.
- `public/.nojekyll` is part of the artifact so GitHub Pages serves it as-is.
- The service worker carries a version constant and replaces the old app-shell cache on the next
  visit without interrupting a running session.

## Service worker and offline

`public/sw.js` is a hand-written app-shell worker. It precaches the built assets (index.html, the
hashed files under `assets/`, the manifest) and **never** caches the AI API origin. Navigation is
network-first with a cache fallback, so an offline reload shows the app shell; only the AI features
report the missing connection.

## Runtime edge cases the app handles

| Situation                                     | Behaviour                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| Served under a base path                      | All URLs are relative to `import.meta.env.BASE_URL`                            |
| Browser blocks a request by the page's policy | The app names the API origin that must be allowed                              |
| New version deployed while the app is open    | The new worker activates on the next visit; the current session is untouched   |
| Opened offline                                | The cached app shell loads; only the AI features report the missing connection |
| Opened from a `file://` path                  | Not supported (storage behaviour is undefined) — a short notice is shown       |
