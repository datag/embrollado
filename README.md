# Embrollado

**Practise a foreign language through realistic role-play conversations with an AI partner — and
everything stays on your device.**

Embrollado is a browser-only single-page app. You choose a target language, a level, a situation
and a partner, and then you talk: the partner replies in the target language with the translation
sitting muted under each line — hidden until you peek or until you have answered — and after every
answer you get an explanation, a correction, an interpretation, filled-in gaps, a quality badge
and concrete things to improve (a wrong word is shown as «as written» → «as it should be»). The
feedback always concerns only your latest answer and never reveals the meaning of the partner's
new line — you work that out yourself, with the translation appearing after you answer. Whenever
you want, you can have the partner's line read aloud and
generate an illustration of the current moment of the conversation (a picture button next to the
input box; the button only appears when an image model is configured). Click any picture in the
chat to view it at full resolution in a lightbox.

There is no backend, no account and no tracking. Conversations, pictures and cached audio live in
your browser (IndexedDB); a small settings document and your AI-service configuration live in
`localStorage`. The only outbound traffic is to the OpenAI-compatible AI service you configure
yourself (bring your own key).

## Prerequisites

| Tool    | Version |
| ------- | ------- |
| Node.js | ≥ 22.12 |
| pnpm    | 10.x    |

No other global tooling is needed. The e2e test browser (Chromium) is installed per project.

## Install

```bash
pnpm install
pnpm exec playwright install chromium   # only needed for the e2e tests
```

`pnpm install` runs the approved native build scripts listed in `package.json` under
`pnpm.onlyBuiltDependencies`.

## Run it locally

```bash
# Terminal 1 — the mock AI service (no request ever leaves the machine)
pnpm mock-ai

# Terminal 2 — the app
pnpm dev
```

Open <http://localhost:5173> and go to **Settings → AI service**:

| Field           | Value                               |
| --------------- | ----------------------------------- |
| Service address | `http://localhost:8787/v1`          |
| API key         | `test` (the mock ignores it)        |
| Auth style      | `Bearer`                            |
| Chat model      | `mock-chat`                         |
| Speech model    | `mock-speech` (optional)            |
| Voice (TTS)     | `alloy` — model-specific (optional) |
| Image model     | `mock-image` (optional)             |

Press **Test the connection**. Then start a conversation from **＋ New conversation**. Back in
**Conversations**, the most recently active conversation is listed first.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build into dist/
pnpm preview        # serve dist/ on :4173
pnpm mock-ai        # the local mock AI service on :8787
pnpm lint           # ESLint
pnpm format         # Prettier (write)
pnpm typecheck      # vue-tsc + tsc for the config files
pnpm test           # the whole suite: Vitest (unit + component), then Playwright (e2e)
pnpm test:unit      # Vitest only
pnpm test:e2e       # Playwright only (builds first, starts the mock automatically)
```

## Configure your AI service

Embrollado talks to any **OpenAI-compatible** endpoint. In **Settings → AI service**:

1. **Service address** — an absolute http(s) URL including the provider's version prefix,
   e.g. `https://api.openai.com/v1` or `https://openrouter.ai/api/v1`. The provider profile
   (OpenAI, OpenRouter, Ollama, llama.cpp, vLLM, LM Studio, custom) is detected from the address
   and can be changed manually — it controls auth style, schema placement, the speech format and
   the images path, so pick the row that matches your service.
2. **API key** — stored locally only. It is never logged, never exported, and sent nowhere except
   your configured service.
3. **Chat model** — required. **Speech/Image models** — optional; leaving them empty hides the
   playback button and the picture button.
4. **Test the connection** — one minimal request. If your service blocks the browser (CORS),
   Embrollado shows the exact flag for that provider.

The learner profile is split into **perceivable traits** and **other personal data**. What you can
see or hear (appearance, voice, approximate age, gender) travels with every conversation so the
partner and the generated pictures can reflect it. Your **name and details** always reach the
picture generation, and — in the dialogue — only when you tick "The AI partner already knows you"
when starting a conversation (off by default); otherwise the partner gets to know you during the
talk, the way strangers do. The privacy notes and a pseudonym tip in the app say so explicitly.

See [docs/configure-ai-service.md](docs/configure-ai-service.md) for provider-specific tips.

## Where your data lives

| Data                                              | Where                                                           |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Conversations, turns, illustrations, cached audio | IndexedDB database `embrollado` (stores prefixed `embrollado:`) |
| Settings (language, theme, learner profile)       | `localStorage` → `embrollado.settings.v1`                       |
| AI service configuration (incl. API key)          | `localStorage` → `embrollado.service.v1`                        |

Everything is wiped when the browser clears site data. Use **Export/Import** to move or back it up:

- **Export** downloads `embrollado-export-<date>.json` — the conversations in a portable,
  versioned envelope. Pictures are optional; cached audio and the API key are never exported.
- **Import** replaces the device's conversations after a warning. Files up to 250 MB, from any
  Embrollado version ≥ 1 (newer versions are refused).

The app requests persistent storage (`navigator.storage.persist()`) on demand; if the device is
low on space it prunes **only** the speech cache — never a transcript or a picture.

## Deployment

Two options:

### 1. Self-hosted with a strict CSP (recommended)

Build once, then serve `dist/` with a host that sets the Content-Security-Policy. The bundled
helper server reads the allowed API origin from `embrollado.config.json`:

```bash
cp embrollado.config.example.json embrollado.config.json
# edit "allowedApiOrigin" (e.g. "https://api.openai.com")
pnpm build
node tools/serve.mjs        # serves dist/ on :4174 with the strict CSP header
```

nginx, Caddy and Netlify snippets ship in [docs/deployment.md](docs/deployment.md).

### 2. GitHub Pages (zero setup)

On every push to `main`, the `gh-pages` workflow runs the quality gates (type-check, lint, unit,
e2e) and deploys to `https://<owner>.github.io/<repo>/`. Hash routing means no rewrite rule is
needed and a refresh never 404s.

- Repository settings → **Pages** → Source: **GitHub Actions** (one-time).
- GitHub Pages cannot set response headers, so the Pages build ships **without** a CSP by default.
  Set the repository variable `CSP_MODE=preset` for a meta policy that allows OpenAI and
  OpenRouter only.

## Offline

The app is a PWA: a hand-written service worker precaches the built assets. Everything that does
not need the AI service stays usable with the network disconnected, including a reload. Only the
dialogue itself reports the missing connection.

## Tests

`pnpm test` runs:

| Suite              | Covers                                                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (Vitest)      | badge tiers, catalogue, SSE parser, error normaliser, prompt builder, export envelope, migrations, settings, speech-cache pruning, translation visibility (FR-057)                                                                                             |
| Component (Vitest) | the setup pickers, the feedback block (fixed element order, explanation added without hiding feedback), the muted line translation and its toggle                                                                                                              |
| E2E (Playwright)   | the dialogue cycle against the local mock (incl. the hidden/revealed line translation), conversation list (search/rename/delete), export/import round trip, offline reload, speech + illustrations, network isolation, and the mobile layout at 393/390/320 px |

The e2e suite asserts the constitution's hard promises directly: no horizontal scrolling at
320 px, hit targets ≥ 44 px, zero third-party requests, zero CSP violations, and conversations
surviving a reload. No test touches the network or a paid endpoint.

## Licence

MIT — see [LICENSE](LICENSE). The bundled font, **Atkinson Hyperlegible Next** (Braille Institute
of America), is licensed under the SIL Open Font License 1.1; the OFL text and the subsetting
notice live in `src/assets/fonts/LICENSES/` and are shown on the About screen.
