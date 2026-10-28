# Phase 0 Research: Embrollado – AI Language Practice Conversations

**Date**: 2026-10-28 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

All findings below were verified on 2026-10-28 (npm registry, vendor documentation, live CORS
probes against `api.openai.com` and `openrouter.ai`, and locally built production bundles measured
with gzip -9). Anything that could not be verified is marked **UNVERIFIED** in the decision it
belongs to.

Owner overrides applied on top of the research: **pnpm** as package manager, and **no handwriting
font** (the "notebook style with script font" idea is dropped).

---

## D1 — Package manager: pnpm

- **Decision**: pnpm 10.x, pinned via `"packageManager": "pnpm@10.x"` in `package.json` with
  `pnpm-lock.yaml` committed. All scripts run through `pnpm`.
- **Rationale**: The constitution requires a committed lockfile and a minimal dependency set. pnpm's
  content-addressed store gives a strict, non-hoisted `node_modules` that makes accidental
  undeclared imports fail loudly instead of silently resolving — the behaviour a "minimal
  dependencies" rule needs. `pnpm dlx` also replaces the global-install habits that `npx`
  encourages.
- **Alternatives considered**: `npm` (ships with Node, but its flat hoist hides undeclared
  dependencies and its `npx` pulls packages into the global cache); `yarn` (classic PnP is
  disruptive with Vite's plugin ecosystem; pnpm is the better-supported option today).
- **Consequences**: pnpm 10 blocks dependency lifecycle scripts by default. Vite 8 ships native
  binaries, so `package.json` needs `pnpm.onlyBuiltDependencies` listing the packages that must be
  built (`esbuild`, `@tailwindcss/oxide` and any rolldown binary package). Install with
  `pnpm install`; browsers for the e2e suite with `pnpm exec playwright install --with-deps chromium`.

## D2 — Framework and build toolchain

- **Decision**: Vue 3.5.44 + Vite 8.3.5 (Rolldown-based) + TypeScript 6.0.3 + Tailwind CSS 4.3.3.
- **Rationale**: The owner named Vite/TypeScript/Tailwind/Vue. Vite 8 is the current stable line
  and its Rust bundler is fast. Tailwind 4's CSS-first configuration fits a design-token-heavy
  light/dark theme without a JS config file. Vue 3.5.44 is the current **stable** release — Vue
  3.6 is only at `rc.13` and `vue-i18n`'s types already depend on a 3.6 symbol.
- **TypeScript 7 is not an option**: `typescript@latest` is 7.0.2, the native Go port, which has
  **no compiler API**. `vue-tsc`/Volar need that API, and Microsoft's own guidance is that Vue
  projects must stay on TypeScript 6.0 for now. TypeScript 7.1 (beta) adds the API plus a Vue
  content mapper — worth revisiting once released, not before.
- **Alternatives considered**: React + Vite (equivalent ecosystem size, but Vue's reactivity model
  fits a single-store app with fewer dependencies); Vue 3.6 RC (pre-release, rejected); Tailwind v3
  (stable LTS, but v4 is the current release and the CSS-first tokens fit the theme system
  better).
- **Consequences**: `tsconfig.json` needs `strict: true`, `skipLibCheck: true` (vue-i18n's
  declarations reference a Vue 3.6 type), `moduleResolution: "bundler"`, and an explicit
  `"types": ["vite/client"]` (TypeScript 6 defaults to `types: []`).
  Vite 8 renames `build.rollupOptions` → `build.rolldownOptions`.

## D3 — Single bundle, no code splitting

- **Decision**: `build.rolldownOptions.output.codeSplitting: false` and
  `build.assetsInlineLimit: 0`. One JS chunk, one CSS file, fonts as separate hashed files.
- **Rationale**: The owner asked for an SPA without lazy loading. Measured with a realistic
  build (4 views, 5 routes, 3 locales, markdown rendering, one subsetted font): **82.0 KB gzipped
  JavaScript**, 2.1 KB gzipped CSS, 38 KB font — ~112 KB total. The constitution's 250 KB
  gzipped-JS budget therefore has ~3× headroom, so the single-chunk requirement costs nothing.
- **Alternatives considered**: Route-level dynamic imports (would contradict the owner's "kein
  Nachladen" and is unnecessary at 1/3 of budget); keeping the default 4 KB asset-inline limit
  (Vite would inline the woff2 as a `data:` URI, which `font-src 'self'` blocks — hence
  `assetsInlineLimit: 0`).

## D4 — State management

- **Decision**: Plain composables (`useSession`, `useSettings`, `useTheme`) built on Vue
  reactivity. No Pinia.
- **Rationale**: The app has three small pieces of shared state. Pinia 4 adds ~2.9 KB gzipped and
  an ESM-only build with a required peer dependency (`@vue/devtools-api`), for devtools
  time-travel that a local-first single-device app does not need. The constitution requires
  complexity to be justified.
- **Alternatives considered**: Pinia 4.1.0 (rejected: dependency cost without benefit);
  Vuex (superseded).

## D5 — Internationalization

- **Decision**: `vue-i18n@11.4.16` for the interface (English, German) and for the feedback
  language; the badge label variants live in the same locale files.
- **Rationale**: FR-033/FR-034/FR-036 require an interface in English and German, a separate
  native-language setting for the feedback, and badge label variants per tier per language
  (FR-041/FR-042). `vue-i18n` gives message interpolation, fallback chains and locale formatting
  for ~18 KB gzipped.
- **Alternatives considered**: A hand-rolled `t()` over a nested map (saves ~16 KB but needs
  pluralisation and locale-aware formatting to be written by hand); raw strings (violates FR-041).
- **Consequences**: `skipLibCheck: true` is required — vue-i18n ≥ 11.2.1 imports
  `GenericComponentInstance`, which only exists in Vue 3.6. A fallback chain
  (native language → interface language → English) implements FR-034's "falls back to the
  interface language".

## D6 — Local storage layout

- **Decision**: IndexedDB (via `idb@8.0.4`) is the primary store for everything large or binary;
  `localStorage` holds only the small settings document. Every name carries the app prefix:
  database `embrollado`, stores `embrollado:sessions`, `embrollado:images`, `embrollado:audio`,
  `embrollado:meta`, indexes `embrollado:by-createdAt` / `embrollado:by-session`, and
  `localStorage` keys `embrollado.settings.v1` / `embrollado.service.v1`.
- **Rationale**: The constitution makes IndexedDB the default and limits `localStorage` to small,
  non-critical values; the owner asked for prefixed stores. Object-store names are immutable in
  IndexedDB (renaming means `deleteObjectStore` and losing all data), so the names are fixed at
  day one. `localStorage` is synchronous and capped around 5 MiB per origin — transcripts and
  images do not belong there. `idb` costs 1.2 KB gzipped against roughly 25 KB for Dexie.
- **Alternatives considered**: Dexie (heavier, own migration DSL); `idb-keyval` (no indexes);
  OPFS (raw bytes, wrong tool); `file://` storage (undefined behaviour, cannot be relied on).

## D7 — Storage quotas and durability

- **Decision**: Request `navigator.storage.persist()` from a user gesture (after the first saved
  session); guard every write for `QuotaExceededError`; on quota pressure prune **only** the
  speech cache (oldest first) and never transcripts or pictures; surface a message to the learner.
- **Rationale**: FR-050/FR-051 require exactly this. Browser quotas are a percentage of free disk
  and eviction is all-or-nothing per origin, so the learner must know their data is at risk before
  the browser removes it. `navigator.storage.estimate()` is available (Chrome 61+, Firefox 57+,
  Safari 17+) but is an estimate only — the error path still has to be implemented.
- **Alternatives considered**: Nothing (the browser's default eviction would silently delete
  practice history, which the constitution forbids).

## D8 — Export / import

- **Decision**: A single JSON envelope `{ format: "embrollado.export", version: 1, exportedAt,
  sessions: [...] }`, versioned with a migration chain; import **replaces** the device's
  conversations after a warning (FR-054/FR-055); sessions carry a UUID (FR-053); pictures and
  cached audio are excluded from the default export.
- **Rationale**: FR-019/FR-053…FR-056 require a portable file, a version marker, replace semantics
  and a warning. Pictures are base64 and inflate the file by 4/3; audio is a cache, not user data.
  Chunked Blob assembly keeps peak memory at roughly one session instead of the whole export
  twice.
- **Alternatives considered**: Compressing the export with `CompressionStream('gzip')` (supported
  everywhere, but it breaks "open it in a text editor" and the import path); NDJSON (better for
  hundreds of megabytes, unnecessary at tens of megabytes).

## D9 — Download, upload, share

- **Decision**: The Share action is a menu with **Download file** and **Import file** always
  available, plus **Share to another app** shown only when `navigator.canShare({ files })` is true.
- **Rationale**: The owner asked for a share option (download & upload). Web Share needs a secure
  context, a transient user gesture and permission; Firefox desktop has no Web Share at all, so it
  can only ever be an enhancement. The download path is an anchor with `URL.createObjectURL` and a
  revoked URL; the upload path is `<input type="file" accept="application/json">`.
- **Alternatives considered**: Web Share as the only path (excludes Firefox desktop and older
  Safari); `showOpenFilePicker` (not supported in Safari and Firefox).

## D10 — Typography and visual identity

- **Decision**: **One** self-hosted family — Atkinson Hyperlegible Next (variable, OFL 1.1),
  subset to Latin + Latin-1 + Latin Extended-A (38 KB woff2). **No handwriting / script font.**
  Light and dark themes are driven by CSS custom properties in Tailwind v4, with a
  light/dark/auto switch; the accent colour and the rounded, paper-like surfaces carry the
  identity.
- **Rationale**: The owner dropped the notebook-with-handwriting idea. What remains has to be
  "ansprechend und doch simpel" and, above all, readable — the whole product is about reading a
  language. Atkinson Hyperlegible Next was designed for legibility by the Braille Institute,
  covers every target language's Latin glyphs (including Polish `ą ć ę ł ń ś ź ż` and Turkish
  `İ ğ Ğ ş Ş`), is a variable font (one file, weights 200–800), and is the smallest font in its
  legibility class at 38 KB. Handwriting fonts were dropped for two reasons beyond the owner's
  decision: script letterforms blur below 16 px, and WCAG 1.4.12 (Text Spacing) is the criterion
  they break first — connected letterforms collide at +0.12 em tracking.
- **Alternatives considered**: Nunito (39.7 KB, rounder and warmer — the best swap if the app
  should feel more playful); Inter (69 KB, neutral, twice the bytes); Literata / Source Serif 4
  (119–131 KB, reading serifs, wrong for UI text); Playpen Sans (208 KB, handwriting-inspired but
  humanist — legible, yet far too heavy); Caveat (75 KB, the original handwriting idea — dropped).
- **Obligations**: the OFL requires shipping the licence with the font and naming any
  modification. Subsetting is a modification, so `src/assets/fonts/LICENSES/` holds `OFL.txt` and
  a `NOTICE.md` recording the subset, and the About screen lists the font, its author and its
  licence.
- **UNVERIFIED**: the WCAG contrast ratio of the concrete `oklch()` token pairs is not yet
  computed — it must be checked before release (the token values are placeholders in the plan).

## D11 — Theme system

- **Decision**: Tailwind CSS v4's CSS-first tokens: `:root` / `.dark` custom properties, one
  `@theme inline` block mapping them to `--color-*`, and
  `@custom-variant dark (&:where(.dark, .dark *))` for a class-based dark mode. The theme class is
  toggled on `<html>` by `useTheme()`.
- **Rationale**: One set of semantic utilities (`bg-surface`, `text-fg`, `bg-accent`) serves both
  modes without scattered `dark:` variants, and v4 tree-shakes unused theme variables. The pattern
  was verified end to end: a 6 KB raw / 2.1 KB gzipped stylesheet for the whole app.
- **Alternatives considered**: v3 with `darkMode: 'class'` and a JS config (stable LTS, but the
  current release line is v4); `prefers-color-scheme` only (no user switch, which the owner
  explicitly wants).

## D12 — AI access: direct browser → user's endpoint

- **Decision**: Every request goes **directly from the browser to the address the learner
  configured** (FR-038). No proxy, no relay, no backend of our own. A refusal caused by the
  service's cross-origin policy is detected and reported with provider-specific guidance
  (FR-039).
- **Rationale**: Verified live: OpenAI and OpenRouter both send
  `access-control-allow-origin` for browser origins, so no intermediary is needed. For
  self-hosted servers the user must enable the browser origin themselves — Ollama via
  `OLLAMA_ORIGINS`, llama.cpp via `--cors-origins` (default `*`), vLLM via `--allowed-origins`
  (**empty by default since v0.32**). The failure is a `fetch` `TypeError` with no status code and
  no body, so the app must classify it explicitly and show the matching hint.
- **Alternatives considered**: A bundled local proxy (rejected by the owner in `/speckit.clarify`
  — answer A — and unnecessary for OpenAI and OpenRouter).

## D13 — One adapter, provider profiles

- **Decision**: A single `aiService` module owns request construction, response parsing and error
  mapping (constitution, Principle IV). Provider differences live in a declarative
  `EndpointProfile`: base URL, auth header style, URL template (Azure needs `?api-version=`),
  schema placement, JSON mode, default audio format, and capability flags.
- **Rationale**: Verified differences that a single hard-coded payload would break on:
  - **Structured output**: OpenAI, OpenRouter, Ollama, vLLM and LM Studio accept
    `response_format: { type: "json_schema", json_schema: { name, strict, schema } }`; **llama.cpp
    documents the schema as a sibling of `type`** (`{ type: "json_schema", schema }`) and may
    silently ignore the nested form. The profile therefore controls where the schema is placed.
  - **Streaming**: all six targets support SSE; OpenRouter's final usage chunk deviates from the
    OpenAI shape (non-empty `choices`), OpenRouter sometimes emits `:` comment frames, and
    llama.cpp sends keepalive pings every 30 s. The parser must be defensive and must never
    `JSON.parse` a partial buffer.
  - **Speech**: `/v1/audio/speech` exists on OpenAI, OpenRouter and Ollama (v0.40.8+), **not** on
    llama.cpp, vLLM or LM Studio. Default `response_format` differs (OpenAI `mp3`, OpenRouter
    `pcm`, Ollama `wav`) and Ollama returns HTTP 400 for unsupported values — so the format is
    always sent explicitly.
  - **Images**: OpenAI uses `/v1/images/generations`, **OpenRouter uses `/api/v1/images`** — not
    the same path. Current OpenAI image models always return `b64_json`; `url` responses point at
    a different host (Azure Blob Storage) which a strict `img-src` CSP would block. Base64 is
    requested and the bytes are stored locally.
  - **Errors**: OpenAI returns `{ error: { message, type, param, code } }`; OpenRouter returns
    `{ error: { code: <number>, message, metadata: { error_type } } }`. OpenRouter can also return
    HTTP **200 with an error body**. Both shapes are normalised into one internal error kind.
  - **`Retry-After` is not readable cross-origin** (neither OpenAI nor OpenRouter expose it via
    `access-control-expose-headers`), so backoff is derived from the status code.
  - **Auth**: `Authorization: Bearer` by default, with `x-api-key` and `api-key` selectable for
    Anthropic-style and Azure-style gateways. Azure additionally needs an `api-version` query
    parameter, so it is a URL-template profile, not just a header difference.
- **Alternatives considered**: Using the OpenAI SDK in the browser (loses control of the raw SSE
  and of arbitrary self-hosted base URLs; `dangerouslyAllowBrowser` friction); a per-provider
  implementation (violates the "one adapter" principle).

## D14 — Structured turn payload

- **Decision**: The model is asked for a strict JSON object per turn: the partner's line, the
  translation, an optional explanation, the corrected learner answer, the interpretation, the
  filled-in assumptions (each marked as an assumption), the badge tier, and the issue list. The
  schema is the contract in `contracts/turn-payload.md`. `json_schema` is requested first; if the
  endpoint rejects it, the app retries once with `json_object` plus the schema embedded in the
  prompt, and then parses leniently.
- **Rationale**: FR-008 and FR-014 require a fixed, predictable feedback layout per turn, and
  FR-040/FR-043 require a four-tier badge rather than free text. A schema makes the layout
  enforceable; the fallback covers servers with partial structured-output support.
- **Alternatives considered**: Free-text answers parsed heuristically (unreliable, and the
  "Explain to me" content would have to be re-parsed on every click).

## D15 — Progressive display

- **Decision**: The partner's line is streamed over SSE and shown as it arrives; the feedback block
  appears afterwards as one unit. If the endpoint cannot stream, the app falls back to showing the
  complete turn (FR-035).
- **Rationale**: FR-035 and SC-012 (first words visible within 2 s in ≥ 90 % of turns) require
  streaming. Because the turn is a structured JSON document, the *feedback* cannot be rendered
  progressively — only the partner's line can, and it is streamed as a JSON string value.
- **Alternatives considered**: Streaming every field (impossible with schema-constrained output);
  no streaming at all (rejected by the owner in `/speckit.clarify` — answer B).

## D16 — Testing strategy

- **Decision**: Vitest 5 + `@vue/test-utils` + happy-dom + `fake-indexeddb` for unit and component
  tests; Playwright 1.64.1 against `vite preview` for e2e at 393 px, 390 px and 320 px. The AI
  adapter is exercised against a mocked `fetch` transport and against `tools/mock-ai.mjs`, a local
  mock of the OpenAI-compatible endpoints. `pnpm test` runs both suites.
- **Rationale**: The constitution requires deterministic tests that never touch the network and a
  mocked AI transport. `fake-indexeddb` covers IndexedDB (it implements no quota, so the quota
  path is tested by injecting a writer that throws `QuotaExceededError`). Playwright can assert the
  constitution's hard promises directly: no horizontal scrolling at 320 px, hit-target sizes, zero
  third-party requests, a CSP-violation listener that must stay silent, and an offline run.
- **Alternatives considered**: Vitest only (cannot verify the 320 px layout, the CSP or the
  offline promise); a real paid endpoint in tests (unacceptable — cost, flakiness, and a
  network dependency).

## D17 — CSP, offline shell, licence

- **Decision**:
  - CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
    font-src 'self'; connect-src 'self' <allowed API origin>; worker-src 'self';
    object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Because the API origin is chosen
    at runtime, the header is set by `tools/serve.mjs` from `embrollado.config.json`; the README
    ships nginx, Caddy and Netlify snippets for other hosts.
  - Offline: a hand-written app-shell service worker precaches the built assets; the API origin is
    never cached. A `<meta>` CSP is explicitly **not** used — it cannot express a per-user
    `connect-src`, and `frame-ancestors` is ignored there.
  - Licence: MIT for the application (`LICENSE`), plus the OFL text and a `NOTICE` for the bundled
    font, surfaced on the About screen.
- **Rationale**: Verified in headless Chromium against a real production build: **zero CSP
  violations**, no `unsafe-inline` and no `unsafe-eval` needed (Vite injects nothing inline;
  Vue's `:style` bindings go through CSSOM and are not blocked). `assetsInlineLimit: 0` keeps the
  font a file rather than a `data:` URI. The service worker is what makes SC-008 true across a
  reload, not just in an open tab.
- **Alternatives considered**: `connect-src *` (violates Principle III); a meta CSP (cannot be
  per-user); a workbox-based service worker (a dependency for ~50 lines of code).

## D18 — Deployment: GitHub Pages plus a self-hosted option

- **Decision**: Two deployments. (1) **GitHub Pages** through
  `.github/workflows/gh-pages.yml`, built with `pnpm build --base=/<repo>/` — the convenience
  deployment. (2) **Self-hosted** static files served with a strict CSP by `tools/serve.mjs` —
  the constitution-compliant deployment, and the primary one.
- **Rationale**: GitHub Pages cannot set response headers, so it cannot deliver the CSP that
  allows only the app's own origin plus the *runtime-configured* API origin. A `<meta>` policy
  cannot be per user, and a policy that pinned `connect-src` to the preset providers would make a
  learner's own service unreachable — which the BYOK design must not do. The Pages build therefore
  ships without a CSP by default and offers an opt-in `CSP_MODE=preset`; the self-hosted
  deployment keeps the strict guarantee. **Hash routing is what makes the Pages deployment
  work**: no rewrite rule is needed on any static host, so a refresh never 404s.
- **Alternatives considered**: `actions/configure-pages` instead of computing the base path
  (the base path still has to be known at build time for the router and the service worker);
  history-mode routing (needs a rewrite rule on every host — a recurring self-hosting failure);
  a Pages build with a pinned `connect-src` (breaks custom endpoints).
- **Consequences**: the workflow runs the constitution's gates (type-check, lint, unit tests, e2e)
  **before** deploying; `public/.nojekyll` is shipped; the service worker carries a version
  constant so a new deployment replaces the old app-shell cache without interrupting a running
  session. Details in `contracts/deployment.md`.

## Summary of decisions

| # | Decision | Status |
|---|---|---|
| D1 | pnpm 10.x, pinned `packageManager`, `pnpm-lock.yaml` committed | owner-mandated |
| D2 | Vue 3.5.44 + Vite 8.3.5 + TypeScript 6.0.3 (not TS 7) + Tailwind 4.3.3 | decided |
| D3 | One chunk, no code splitting, `assetsInlineLimit: 0` (~82 KB gz) | decided |
| D4 | Plain composables, no Pinia | decided |
| D5 | vue-i18n 11.4.16, native-language fallback chain | decided |
| D6 | IndexedDB (`embrollado` DB, prefixed stores) + prefixed `localStorage` keys | decided |
| D7 | `persist()` + `QuotaExceededError` handling, prune speech cache only | decided |
| D8 | JSON export envelope v1, replace-on-import with warning, UUID ids | decided |
| D9 | Download + upload always, Web Share as an enhancement | decided |
| D10 | One font: Atkinson Hyperlegible Next 38 KB, **no handwriting font** | owner-mandated / decided |
| D11 | Tailwind v4 CSS-first tokens, class-based dark mode | decided |
| D12 | Direct browser → configured endpoint, no proxy | owner-mandated / decided |
| D13 | One adapter + declarative provider profiles | decided |
| D14 | Strict JSON turn payload with `json_object` fallback | decided |
| D15 | Stream the partner's line, deliver feedback as one block | decided |
| D16 | Vitest + Playwright, mocked transport, `pnpm test` | decided |
| D17 | CSP via helper server, service-worker app shell, MIT + OFL attribution | decided |
| D18 | GitHub Pages deployment (`gh-pages.yml`, `--base=/<repo>/`) + self-hosted strict-CSP deployment | owner-mandated / decided |
