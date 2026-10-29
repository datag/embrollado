# Quickstart: Validating Embrollado

**Date**: 2026-10-28 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

A runnable guide that proves the feature works end to end. It assumes the implementation exists;
the commands are the ones the plan prescribes.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node | ≥ 22.12 (Vite 8 needs ≥ 20.19, Vitest 5 needs ≥ 22.12) | `node -v` |
| pnpm | 10.x | `pnpm -v` |

No other global tooling is needed. The Playwright browsers are installed per project.

## 2. Install

```bash
pnpm install
pnpm exec playwright install --with-deps chromium
```

`pnpm install` runs the approved dependency build scripts listed in
`package.json → pnpm.onlyBuiltDependencies` (Vite 8 ships native binaries).

## 3. Run it locally

Two processes: the mock AI service and the dev server.

```bash
# terminal 1 — mock OpenAI-compatible service on :8787
pnpm mock-ai

# terminal 2 — the app on :5173
pnpm dev
```

Open <http://localhost:5173>. In **Settings → AI service**:

| Field | Value |
|---|---|
| Service address | `http://localhost:8787/v1` |
| API key | `test` (the mock ignores it) |
| Auth style | `Bearer` |
| Chat model | `mock-chat` |
| Speech model | `mock-speech` (optional) |
| Image model | `mock-image` (optional) |

Press **Test the connection** — the mock answers a one-word chat request, so the app shows
"Connected" and lists the mock's models.

**Expected outcome**: the mock service answers `/v1/chat/completions` (streamed and unstreamed),
`/v1/audio/speech` and `/v1/images/generations`, and `GET /v1/models`. No request ever leaves the
machine.

## 4. Walk through the feature

| # | Action | Expected outcome |
|---|---|---|
| 1 | **Setup** → pick English, level *intermediate*, the camping-site washroom, partner *Nicole, 38, confectioner* → **Start** | Nicole's first line appears in English and streams in word by word |
| 2 | Answer: "Is the washroom next to the showers???" | One feedback block: explanation, correction, interpretation, the `???` filled in as a labelled assumption, a coloured badge, and the issue list |
| 3 | Press the badge's playback button | The line is spoken; the audio is cached |
| 4 | Answer several more turns | The picture for the situation appears; the badge wording changes between turns while the tier stays |
| 5 | **Sessions** → open the session, then reload the page | The full transcript with all feedback is still there |
| 6 | **Settings** → switch to *Dark* and to *Deutsch* | The whole interface changes; the feedback language stays as configured |
| 7 | **Sessions** → *Export* | `embrollado-export-<date>.json` is downloaded; it contains the conversations and no API key |
| 8 | **Settings** → *Import* that file | A warning names how many conversations will be replaced; after confirming, the same conversations are there |
| 10 | **Settings** → write your own partner, save it as a template | The template appears in the Setup screen and in later sessions |

## 5. Build and preview (production behaviour)

```bash
pnpm build
pnpm preview            # serves dist/ on :4173
```

For the production CSP (which must allow the configured API origin), run the helper server:

```bash
cp embrollado.config.example.json embrollado.config.json
# edit "allowedApiOrigin" to the origin of your AI service, e.g. "https://api.openai.com"
node tools/serve.mjs
```

**Expected outcome**: the app is served with

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
font-src 'self'; connect-src 'self' https://api.openai.com; worker-src 'self';
object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

and the browser console shows **no CSP violation**. With `allowedApiOrigin` set to the wrong
origin, the app reports "the service did not allow the request from the browser" and names the
origin to add.

## 6. Deploy to GitHub Pages

The repository ships `.github/workflows/gh-pages.yml`, adapted from the retro-writer template
(pnpm via Corepack, Node 24, `actions/upload-pages-artifact` → `actions/deploy-pages`).

**One-time setup**: repository settings → **Pages** → Source: **GitHub Actions**.

**Every push to `main`** then runs:

```text
checkout → corepack (pnpm 10.0.0) → setup-node 24 (pnpm cache) → pnpm install --frozen-lockfile
         → pnpm typecheck → pnpm lint → pnpm test:unit → playwright install → pnpm test:e2e
         → pnpm build --base=/<repo>/ → upload-pages-artifact → deploy-pages
```

The quality gates run **before** the deployment: a failing gate stops the release.

**Expected outcome**: <https://<owner>.github.io/<repo>/> serves the app; the base path is
`/<repo>/`; the router uses hash routes (`…/#/sessions`), so a refresh on any URL never 404s; the
service worker is served from `/<repo>/sw.js` and its scope covers the app.

Notes:

- The base path is computed by the workflow: `/` for a user site (`<owner>.github.io`), otherwise
  `/<repo>/`.
- GitHub Pages cannot set response headers, so the Pages build ships **without** a CSP. Set the
  repository variable `CSP_MODE=preset` to inject a meta policy that allows only the app's origin
  plus `api.openai.com` and `openrouter.ai` — usable only with those two providers. For the strict
  policy, deploy the `dist/` folder yourself (section 5).
- `public/.nojekyll` is part of the artifact so Pages serves it as-is.
- Manual runs: **Actions → Build and deploy to GitHub Pages → Run workflow**.

## 7. Tests

```bash
pnpm test               # Vitest, then Playwright
pnpm test:unit          # Vitest only
pnpm test:e2e           # Playwright only
pnpm typecheck          # vue-tsc --noEmit
pnpm lint
```

**Expected outcome**

| Suite | What it proves |
|---|---|
| Unit | The badge tier logic, the catalogue, the SSE parser, the error normaliser, the prompt builder, the export envelope, the migrations |
| Component | The feedback block renders the six elements in the fixed order and keeps them visible when the explanation is added |
| E2E | The dialogue cycle with the mock service, the offline behaviour, the settings, the export/import round trip, and the 320 px layout |

The e2e suite asserts the constitution's hard promises directly: no horizontal scrolling at
320 px, hit targets ≥ 44 px, **zero** third-party requests, **zero** CSP violations, and the
session surviving a reload.

## 8. Manual checks that cannot be automated

| Check | How |
|---|---|
| The app is usable with the network disconnected | DevTools → Network → Offline, then read a stored session, export it and open the settings |
| The app survives a device restart | Close the tab, reopen it, check that the sessions are there |
| The picture and the speech look and sound right | Play a full session with the mock or a real service |
| The contrast of the badge colours | Check each tier's colour against its background (≥ 4.5:1) |
| The offline reload | Build, preview, load the app, then go offline and reload — the app shell comes from the service worker |

## 9. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "The service did not allow the request from the browser" | The service's cross-origin policy | See `contracts/ai-service.md` §8 for the provider-specific flag |
| The first request takes ~10 s | The service compiles the response schema on first use | Wait it out; it is cached afterwards |
| The picture does not appear | The service has no image model, or the image endpoint lives at another path | Check the model name and the provider profile |
| The audio button is missing | The service has no `/v1/audio/speech` | Expected — the app hides the button and explains why |
| "The device storage is full" | The quota is nearly exhausted | Delete a session or lower the cached-lines setting; pictures and transcripts are never deleted automatically |
| The e2e suite cannot find the preview server | A stale process holds the port | `pkill -f "vite preview"` and re-run |
