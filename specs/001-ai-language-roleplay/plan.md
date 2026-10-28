# Implementation Plan: Embrollado – AI Language Practice Conversations

**Branch**: `001-ai-language-roleplay` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/speckit.specify` → `specs/001-ai-language-roleplay/spec.md`,
clarified in `/speckit.clarify` (5 decisions, see `spec.md` → `## Clarifications`).

**Owner-supplied technical points** (2026-10-28):

- UI: appealing yet simple, light/dark mode; the "notebook style with handwriting font" idea is
  **dropped** (owner decision, 2026-10-28).
- OpenAI-compatible, BYOK. Settings: AI API key (OpenAI, OpenRouter, …), AI API URL, the learner's
  name, and further details about their own person.
- Licence: MIT.
- Tech: Vite, TypeScript, Tailwind, Vue. SPA, no lazy loading. All resources (scripts, fonts, …)
  load locally, never from external providers (GDPR). All data stored locally (localStorage,
  IndexedDB; every store prefixed with the app name), with JSON export/import and a share option
  (download & upload).
- Package manager: **pnpm** (owner decision, 2026-10-28).

## Summary

A browser-only single-page app that lets a learner practise a foreign language by holding a
realistic role-play conversation with an AI partner. The learner picks a target language, one of
three levels, one of 12 situations and one of 5 partners (or brings their own), then cycles:
partner line → learner answer → translation + correction + interpretation + gap assumptions +
quality badge → "Explain to me" on demand. Everything lives on the learner's device; the only
outbound traffic is to the AI service the learner configures themselves.

**Technical approach**: Vue 3.5 + TypeScript 6 + Tailwind CSS 4, built by Vite 8 into a single
chunk (no code splitting), with all state in the browser — IndexedDB for sessions, illustrations and
the speech cache, `localStorage` for small settings — and one adapter module that owns every call
to the user's OpenAI-compatible endpoint. Conversation turns are requested as a strict JSON object
(`response_format: json_schema`) with a `json_object` fallback, the partner's line is streamed over
SSE and shown progressively, and speech and images are capability-detected and degrade silently.
Measured production payload: **~82 KB gzipped JavaScript** against the constitution's 250 KB
budget, plus a single self-hosted variable font.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict) + Vue 3.5.44 SFCs; toolchain Node ≥ 22.12
(Vite 8 needs ≥ 20.19, Vitest 5 needs ≥ 22.12); package manager **pnpm 10.x** (`packageManager`
pinned in `package.json`, `pnpm-lock.yaml` committed). TypeScript **7.0.2 is not usable** — the
native port has no compiler API, and `vue-tsc`/Volar still need it (Microsoft's own note: "Projects
using Vue… will need to continue using TypeScript 6.0 for now").

**Primary Dependencies**: `vue@3.5.44`, `vue-router@5.4.0` (hash history), `vue-i18n@11.4.16`,
`idb@8.0.4`, `marked@18.1.2`, `dompurify@3.4.17`, `tailwindcss@4.3.3` + `@tailwindcss/vite@4.3.3`,
`vite@8.3.5`. Dev-only: `typescript@6.0.3`, `vue-tsc@3.3.13`, `vitest@5.0.5`,
`@vue/test-utils@2.5.1`, `happy-dom@21.0.4`, `fake-indexeddb@6.2.6`, `@playwright/test@1.64.1`.
No Pinia (plain composables), no highlight.js, no icon package (inline SVG), no font CDN.

**Storage**: IndexedDB database `embrollado` with prefixed object stores
(`embrollado:sessions`, `embrollado:images`, `embrollado:audio`, `embrollado:meta`) via `idb`;
`localStorage` only for small settings under `embrollado.settings.v1` / `embrollado.service.v1`.
Export/import as a versioned JSON envelope. `navigator.storage.persist()` requested inside a user
gesture; `QuotaExceededError` handled by pruning the speech cache only.

**Testing**: Vitest 5 (happy-dom + `fake-indexeddb`) for unit/component tests, Playwright 1.64.1
against `vite preview` at Pixel 5 (393 px), iPhone 12 (390 px) and iPhone SE (**320 px**); a
single `pnpm test` runs both. The AI adapter is exercised against a mocked transport and a local
mock service — no test touches the network or a paid endpoint.

**Target Platform**: Web browsers, current and previous major version of Chrome, Safari, Firefox
and Edge, mobile-first from **320 CSS px**. Served as static files over http(s) (`file://` has
undefined storage behaviour and is not supported).

**Project Type**: Web application — browser-only SPA, no backend, no server-side runtime.

**Performance Goals**: ≤ 250 KB gzipped JavaScript on the initial route (constitution; measured
~82 KB); partner's first words visible ≤ 2 s in ≥ 90 % of turns; complete feedback block ≤ 10 s in
≥ 95 % of turns; app usable with the network disconnected apart from AI calls.

**Constraints**: No third-party runtime fetch except the configured AI API (constitution); all
assets bundled and served from the app's own origin; no code splitting / lazy loading; strict CSP
without `unsafe-inline` / `unsafe-eval`; TypeScript strict; WCAG 2.1 AA for core flows; MIT
licence; OFL font licences honoured with an attribution page.

**Deployment**: two targets — **GitHub Pages** (`https://<owner>.github.io/<repo>/`, built with
`pnpm build --base=/<repo>/`, deployed by `.github/workflows/gh-pages.yml` after the type-check,
lint, unit and e2e gates have passed) and **self-hosted** static files (served by
`tools/serve.mjs`, which sets the strict CSP with the learner's runtime-configured API origin).
Hash routing keeps both working without a rewrite rule. Details: `contracts/deployment.md`.

**Scale/Scope**: Single learner per device, no accounts, no sync. Catalogue: ~12 target languages,
3 levels, 12 situations, 5 partners. 5 screens. 50+ sessions per device (acceptance target),
unbounded transcript length per session.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Constitution requirement (v1.0.0) | How this plan satisfies it | Gate |
|---|---|---|---|
| G1 | I — mobile-first: usable at 320 px, no horizontal scrolling, controls ≥ 44 × 44 px, no hover/physical keyboard | Tailwind v4 token system, single-column layout, Playwright project `narrow-320` asserting `scrollWidth` and hit-target sizes | e2e |
| G2 | I — initial route ≤ 250 KB gzipped JS | Single chunk (`codeSplitting: false`), measured ~82 KB gz; `tools/check-bundle-size.mjs` fails CI above 250 KB | CI |
| G3 | II — local-first: IndexedDB default, `localStorage` only for small non-critical values, no telemetry | `data-model.md`: IndexedDB `embrollado` DB for all content, `localStorage` only for settings; no analytics, tracking or crash reporting anywhere | review + e2e |
| G4 | II — data survives reload and device restart; quota errors handled explicitly | IDB persistence, `navigator.storage.persist()` on user gesture, `QuotaExceededError` → prune speech cache only, never transcripts or pictures | e2e |
| G5 | II — export/import as a portable file | `contracts/storage-export.md`: JSON envelope `embrollado.export` v1, versioned migrations, replace-on-import with warning | e2e |
| G6 | III — self-contained: no third-party runtime fetch, all assets bundled | Fonts self-hosted, no CDN, no remote image URLs, no analytics; CI scans `dist/` for external origins; Playwright asserts zero third-party requests | CI + e2e |
| G7 | III — dependencies must not fetch at import time | `idb`, `marked`, `dompurify`, `vue-i18n`, `vue-router` verified import-clean (no network on import) | CI |
| G8 | IV — exactly one AI egress, through a single adapter, user-triggered, keys never logged | `contracts/ai-service.md`: one `AiService` module owns request construction, parsing and error mapping; `transport.ts` is the single `fetch` seam; keys redacted before any logging | unit |
| G9 | IV — no proxy/relay of our own (spec FR-038/FR-039) | Direct browser → configured origin only; a CORS refusal is detected and reported with provider-specific guidance | e2e |
| G10 | V — tests where it makes sense, deterministic, no network, mocked transport | Vitest + `fake-indexeddb` + mocked SSE `fetch`; Playwright against `vite preview`; `pnpm test` is the single documented command | CI |
| G11 | VI — README and documentation stay in step with the change | `README.md` (install, run, test, configure the API, where data lives, export/import) and `docs/` updated in the same commit | review |
| G12 | Technical Constraints — TypeScript strict, lockfile committed, minimal dependencies, WCAG 2.1 AA, CSP without `unsafe-inline`/`unsafe-eval` | TS 6.0.3 `strict`, `pnpm-lock.yaml` committed, 8 runtime deps only, contrast/toast targets checked, CSP served by `tools/serve.mjs` | CI + review |
| G13 | Technical Constraints — CSP allows only our origin plus the configured API origin | `tools/serve.mjs` reads `allowedApiOrigin` from `embrollado.config.json` and sets the header; README ships nginx/Caddy/Netlify snippets; the app detects a CSP block and names the origin to allow | e2e |
| G14 | Governance — complexity justified before introduction | *Complexity Tracking* below | review |

**Verdict: PASS.** Re-checked after Phase 1 design — see `research.md` (decisions D1–D17) and
`data-model.md`; no gate changed state.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-language-roleplay/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — decisions, rationale, alternatives
├── data-model.md        # Phase 1 output — entities, fields, validation, states
├── quickstart.md        # Phase 1 output — runnable validation guide
├── contracts/           # Phase 1 output
│   ├── ai-service.md    # The OpenAI-compatible service contract
│   ├── turn-payload.md  # The structured turn the model must return
│   ├── storage-export.md# Storage layout + export/import envelope
│   ├── settings-profile.md # Learner profile + service configuration
│   └── deployment.md    # Hosting options, base paths, CSP modes, service worker
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
embrollado/
├── LICENSE                        # MIT
├── README.md
├── package.json                   # pnpm (packageManager: pnpm@10.x)
├── pnpm-lock.yaml
├── tsconfig.json                  # strict
├── tsconfig.node.json
├── vite.config.ts                 # tailwind plugin, codeSplitting:false, assetsInlineLimit:0
├── vitest.config.ts
├── playwright.config.ts
├── index.html                     # no inline script/style, font preload
├── embrollado.config.example.json# allowedApiOrigin for tools/serve.mjs
├── .github/workflows/
│   ├── ci.yml               # pull requests: type-check, lint, unit, e2e, bundle budget
│   └── gh-pages.yml         # push to main: gates, build with --base, deploy to GitHub Pages
├── tools/
│   ├── serve.mjs                  # dependency-free static server that sets the CSP header
│   ├── mock-ai.mjs                # local mock of the OpenAI-compatible endpoints
│   └── check-bundle-size.mjs      # fails above the 250 KB gzipped JS budget
├── public/
│   ├── manifest.webmanifest
│   ├── .nojekyll                   # so GitHub Pages serves the artifact as-is
│   └── sw.js                      # app-shell service worker (offline reload)
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── style.css                  # Tailwind v4 @theme tokens + @font-face
│   ├── assets/fonts/
│   │   ├── atkinson-next-var-latin.woff2
│   │   └── LICENSES/              # OFL.txt + NOTICE (subsetting disclosed)
│   ├── router/index.ts            # hash history
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── locales/{en,de}.ts
│   │   └── badges.ts              # tier -> label variants per locale
│   ├── data/
│   │   ├── db.ts                  # idb schema, prefixed stores
│   │   ├── sessions.ts
│   │   ├── media.ts               # illustrations + bounded speech cache
│   │   ├── settings.ts            # versioned localStorage settings
│   │   ├── profile.ts             # learner profile + service config
│   │   └── exportImport.ts        # envelope, migrations, import replace
│   ├── ai/
│   │   ├── aiService.ts           # the single adapter (G8)
│   │   ├── transport.ts           # fetch seam + SSE parser
│   │   ├── providers.ts           # endpoint profiles (OpenAI, OpenRouter, local…)
│   │   ├── errors.ts              # error normalizer
│   │   ├── prompts.ts             # system prompt + context builder
│   │   └── schema.ts              # JSON schema of a turn
│   ├── domain/
│   │   ├── types.ts
│   │   ├── badge.ts               # tier logic and label variants
│   │   ├── catalogue.ts           # languages, levels, 12 situations, 5 partners
│   │   └── session.ts             # session state machine
│   ├── composables/
│   │   ├── useSession.ts
│   │   ├── useSettings.ts
│   │   └── useTheme.ts            # light / dark / auto
│   ├── views/
│   │   ├── SessionsView.vue
│   │   ├── DialogueView.vue
│   │   ├── SetupView.vue
│   │   ├── SettingsView.vue
│   │   └── AboutView.vue          # licences and attribution (OFL)
│   └── components/
│       ├── AppHeader.vue
│       ├── TurnBubble.vue
│       ├── FeedbackPanel.vue
│       ├── QualityBadge.vue
│       ├── ExplainButton.vue
│       ├── LanguagePicker.vue
│       ├── LevelPicker.vue
│       ├── SituationPicker.vue
│       ├── PartnerPicker.vue
│       ├── ProfileForm.vue
│       └── IllustrationPanel.vue
└── tests/
    ├── setup.ts                   # fake-indexeddb/auto
    ├── unit/{badge,catalogue,errors,transport.sse,prompts,exportImport,migrations}.test.ts
    ├── component/FeedbackPanel.test.ts
    └── e2e/{dialogue,offline,settings,export-import,mobile}.spec.ts
```

**Structure Decision**: single package, single origin, one SPA. The repository root is the app —
no monorepo, no server package, no shared library package. The only non-`src` code is `tools/`
(three dependency-free Node scripts), which exist to satisfy the constitution's CSP and
budget gates without becoming part of the application.

## Complexity Tracking

> *Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `vue-i18n` runtime dependency (~18 KB gz) | FR-033 requires an English/German interface and FR-041 requires badge label variants held in translation files; the feedback is delivered in a third "native language" that can be any of ~12 languages | A hand-rolled `t()` over a nested message map would save ~16 KB but has no pluralisation or locale formatting, and the badge variants alone are a keyed list per locale per tier |
| `marked` + `dompurify` (~24 KB gz) | The model returns the feedback as markdown; the app renders correction, interpretation and "Explain to me" text as formatted prose | Rendering raw text would be free but would break the spec's "one place" feedback layout and the line-level formatting of corrections |
| `vue-router` (~9 KB gz) | Five screens need deep links and a working back button; the session list, the dialogue and the settings must be linkable | A `currentView` ref would save 9 KB but loses back/forward, deep links and the ability to return to a specific session |
| `tools/serve.mjs` static server | The CSP must allow the user's runtime-configured API origin, and a CSP is a response header that a static host cannot know in advance | A `<meta>` CSP cannot express a per-user `connect-src`, and loosening `connect-src` to `*` would break Principle III |
| Service worker (`public/sw.js`) | Principle II and SC-008 require the app to stay usable with the network disconnected — including a reload, which needs an app shell in the cache | Dropping the service worker would limit "offline" to an already-open tab, which is weaker than the spec promises |
| GitHub Pages deployment ships **without** a CSP | GitHub Pages cannot set response headers, and a `<meta>` policy cannot express the learner's runtime-configured API origin; a policy pinned to the preset providers would make a learner's own service unreachable, which the BYOK design forbids | The self-hosted deployment (`tools/serve.mjs`) keeps the strict guarantee and is the primary target; the Pages build is the zero-setup convenience option. This is a deliberate, documented narrowing of gate G13 for that one deployment — see `contracts/deployment.md` §4 |

No gate is violated. Every dependency above is justified against a measured budget headroom of
~3× (82 KB used of 250 KB) and against a dependency count of 8 runtime packages.
