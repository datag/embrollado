# Contract: Deployment

**Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Research**: [../research.md](../research.md)

How the built app is hosted, and what each hosting option can and cannot guarantee. Two
deployments are supported; they differ in one important respect — whether the host can set the
Content-Security-Policy header.

---

## 1. Two deployments

| | **GitHub Pages** (convenience) | **Self-hosted** (constitution-compliant) |
|---|---|---|
| Hosting | `https://<owner>.github.io/<repo>/` | Any static host, or the bundled helper server |
| Base path | `/<repo>/` (or `/` for a user site) | `/` (or whatever the host uses) |
| Strict CSP | **Not possible** — Pages sets no response headers | Yes, via `tools/serve.mjs` or a host snippet |
| `connect-src` | Not restricted (see §4) | Own origin + the learner's configured API origin only |
| Offline app shell | Yes, via the service worker | Yes |
| Setup | Enable Pages → "GitHub Actions" in the repository settings | One command or one host snippet |

The **primary** deployment is the self-hosted one, because it is the only one that can honour the
constitution's CSP rule for a runtime-configured API origin. GitHub Pages is the zero-setup
option for people who want to try the app immediately.

## 2. Building

```bash
pnpm install --frozen-lockfile
pnpm build                                  # base path "/" (local / self-hosted at the root)
pnpm build --base=/embrollado/              # base path "/embrollado/" (project Pages site)
pnpm build --base=/embrollado/ --csp=preset # additionally inject a meta CSP (see §4)
```

`--base` sets Vite's `base`; every asset URL, the router base and the service-worker scope follow
it. `CSP_MODE` (environment variable) or `--csp` selects the CSP mode; both are read by the Vite
plugin in `vite.config.ts`.

## 3. Routing

The app uses **hash routing** (`createWebHashHistory`). Consequences:

- It works on every static host — GitHub Pages, S3, Netlify, an nginx directory — with **no**
  rewrite rule and no 404 on refresh.
- Deep links look like `https://<host>/<repo>/#/session/<uuid>`.
- The router's `base` is `import.meta.env.BASE_URL`, so the same build works under any base path.

A history-mode router would require a rewrite rule (`try_files $uri /index.html`) on every host,
which is a recurring self-hosting failure. The hash route removes that class of problem.

## 4. Content Security Policy

The constitution requires that the app's policy allows only its own origin plus the
user-configured API origin. That origin is chosen at runtime, so the policy must be delivered by
the host — a `<meta>` policy cannot express it per user.

### Mode `strict` — self-hosted (the default for `tools/serve.mjs`)

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.openai.com;
  worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

`tools/serve.mjs` reads `allowedApiOrigin` from `embrollado.config.json` next to `dist/` and
substitutes it into `connect-src`. The README ships equivalent snippets for nginx, Caddy and
Netlify (`_headers`).

Verified in headless Chromium against a production build: zero violations, no `unsafe-inline`, no
`unsafe-eval`.

### Mode `preset` — GitHub Pages, opt-in

GitHub Pages cannot set response headers, so the policy can only be injected into the HTML at
build time. A policy that pinned `connect-src` to the preset providers would make the learner's
own AI service unreachable — which the BYOK design (FR-021) must not do. Therefore:

- The GitHub Pages build ships **without** a CSP by default (`CSP_MODE=none`).
- `CSP_MODE=preset` injects a `<meta>` policy that allows the app's own origin plus
  `https://api.openai.com` and `https://openrouter.ai` — usable only by learners on those two
  providers.
- The app detects a blocked request and names the origin that has to be allowed, so the failure is
  actionable instead of silent.

**This is a documented deviation** from the constitution's CSP rule, accepted for the convenience
deployment only, with the reasoning above. The self-hosted deployment keeps the strict guarantee.

## 5. Service worker and offline

- The app shell is precached by `public/sw.js` (hand-written, no workbox). It caches the built
  assets under their hashed names and never caches the AI API origin.
- The scope follows the base path: the worker is served from `<base>sw.js`, so its scope covers
  the whole app.
- `public/.nojekyll` is shipped so GitHub Pages does not strip anything from the artifact.
- Every new deployment changes the hashed asset names. The worker therefore carries a
  **version constant**; on a version change it activates the new worker and deletes the old cache.
  The activate step does **not** skip waiting for open tabs, so a running session is never
  interrupted mid-turn.
- The app shell is served from the cache when the network is unavailable — this is what makes
  SC-008 ("with the network disconnected, everything that does not need the AI service stays
  usable") true across a reload, not only in an already open tab.

## 6. GitHub Pages setup

1. Repository settings → **Pages** → Source: **GitHub Actions**.
2. The workflow `.github/workflows/gh-pages.yml` builds and deploys on every push to `main`, and
   can also be run manually.
3. The deployment URL is `https://<owner>.github.io/<repo>/`.
4. A custom domain works without changes; the base path then becomes `/` and the workflow detects
   that automatically (a `owner.github.io` repository is treated as a user site).

The workflow runs the constitution's quality gates **before** deploying: type-check, lint, unit
tests and end-to-end tests. A red gate stops the deployment.

## 7. Cache behaviour of the hosts

| Host | Behaviour |
|---|---|
| GitHub Pages | Caches with `max-age=600`; hashed asset names make this safe |
| Any host with `Cache-Control` | The README recommends `immutable` for `/assets/*` and `no-cache` for `index.html` and `sw.js` |

The service worker caches the app shell itself, so the host's caching policy mostly matters for
the first visit.

## 8. What the app must handle at runtime

| Situation | Behaviour |
|---|---|
| The host serves the app under a base path | All URLs are relative to `import.meta.env.BASE_URL`; nothing is hard-coded |
| The browser blocks a request by the page's policy | The app reports that the configured API origin is not allowed by the page's policy and names it |
| A new version is deployed while the app is open | The new service worker activates on the next visit; the current session is untouched |
| The app is opened offline | The cached app shell loads; only the AI features report the missing connection |
| The learner opens the app from a `file://` path | Not supported — storage behaviour is undefined there; the app shows a short notice |

## 9. Not supported

- A server-side runtime of any kind (constitution, Principle I).
- A proxy or relay in front of the AI service (spec FR-038).
- Analytics, error reporting or any other outbound request besides the AI service
  (spec FR-032).
