# AGENTS.md

Browser-only Vue 3 + Vite 8 + Tailwind 4 language-practice app: no backend, no accounts. It talks to
arbitrary **OpenAI-compatible** endpoints the user configures (BYOK). Everything is governed by the
project constitution — read `.specify/memory/constitution.md` before changing behavior.

## High-signal files to read first

- `.specify/memory/constitution.md` — the governing document (mobile-first, local-first, one AI egress, quality gates).
- `specs/001-ai-language-roleplay/` — spec/plan/tasks/quickstart for the feature; code comments cite requirement IDs (e.g. `T021`, `FR-057`) from here.
- `docs/configure-ai-service.md`, `docs/deployment.md` — provider quirks and CSP/deploy details.
- `THIRD_PARTY_LICENSES.md` — licences and copyright notices of the bundled components; the shipped copy lives in `public/`.
- `TODO.md` — open items (written in German).

## Commands

```bash
pnpm dev            # dev server :5173
pnpm mock-ai        # local mock of the OpenAI-compatible API :8787 — needs to run alongside pnpm dev
pnpm build          # production build into dist/ (single-file JS, no code splitting)
pnpm preview        # serves dist/ :4173 (no CSP header — that's what tools/serve.mjs is for)
pnpm lint           # ESLint (ignores tools/** and public/sw.js)
pnpm format         # Prettier write; .prettierrc: no semi, single quotes, width 100
pnpm typecheck      # vue-tsc --noEmit + tsc -p tsconfig.node.json (config files)
pnpm test           # test:unit, then test:e2e
pnpm test:unit      # Vitest (tests/unit + tests/component, happy-dom, fake-indexeddb, `@` → src)
pnpm test:e2e       # Playwright — REQUIRES `pnpm exec playwright install chromium` once (CI installs it too)
```

Manual dev: open `http://localhost:5173` → **Settings → AI service** → address
`http://localhost:8787/v1`, key `test`, auth `Bearer`, model `mock-chat` (optional `mock-speech`,
`mock-image`).

## E2E quirks

- `test:e2e` builds the app and serves the **production build** on `:4173` (not the dev server);
  Playwright starts the mock + preview server itself (`playwright.config.ts` `webServer`). First run
  takes a while (build + up to 120 s preview timeout).
- Run one spec: `pnpm exec playwright test tests/e2e/<file>.spec.ts`.
- 4 projects, run in parallel: functional specs run once on `pixel5` (393 px); `mobile.spec.ts`
  additionally on `iphone12` (390 px) and `iphoneSE` (320 px); `desktop` runs **only**
  `network.spec.ts`. A stale preview server on port 4173 breaks the suite:
  `pkill -f "vite preview"`.
- The suite asserts constitutional hard promises directly: zero third-party requests, zero CSP
  violations, no horizontal scroll at 320 px, ≥44 px touch targets.

## Architecture rules (constitution-enforced)

- **All** HTTP leaves through `src/ai/transport.ts` → `request()` — the single `fetch` seam. Never
  call `fetch` elsewhere; no third-party origin may be contacted at all.
- Data lives in IndexedDB db `embrollado` with prefixed stores (`src/data/db.ts`). Store names are
  **immutable in IndexedDB** — don't rename stores; schema changes go through the `idb` upgrade path
  and the migration (`tests/unit/migrations.test.ts`). Preferences/API config in localStorage keys
  `embrollado.settings.v1` / `embrollado.service.v1`.
- Proxy/setup belongs in `src/ai/` (adapter: `aiService.ts`, `providers.ts`, `transport.ts`,
  `errors.ts`, `schema.ts`, `prompts.ts`); domain logic in `src/domain/`; screens are
  `src/views/*.vue` (Setup, Dialogue, Sessions, Settings, About).
- Router uses **hash routing** (GH Pages, no rewrites). `public/sw.js` is a hand-written service
  worker (precaches built assets and the shipped licence documents, which are served from the cache
  when the network is unavailable); keep it lint-free manually.
- Model-provided markdown is rendered via `marked` + DOMPurify sanitize — `vue/no-v-html` is off for
  that; never render raw model HTML.
- The licence files ship with the app: `public/LICENSE`, `public/THIRD_PARTY_LICENSES.md` and
  `public/LICENSES/` are copies of their sources and must stay byte-identical (guarded by
  `tests/unit/third-party-licenses.test.ts`). The About screen links them via
  `import.meta.env.BASE_URL`, so they work under a base path as well.
- `FR-…`/`T…` IDs in comments are source-only traceability back to `specs/`; they are documented
  convention, not shipping content — Vue's compiler drops template comments in production and the
  minifier strips script comments, so the built bundle never contains them. Do not clean them up.

## Build / CI / deploy gotchas

- Initial route is capped at **250 KB gzipped JS**; CI enforces it via `node tools/check-bundle-size.mjs`.
- `embrollado.config.json` is gitignored (holds `allowedApiOrigin`); copy
  `embrollado.config.example.json` to use `node tools/serve.mjs` (serves dist/ on `:4174` with the
  strict CSP header).
- GH Pages can't send headers: `CSP_MODE=preset` at build time injects a meta CSP (OpenAI +
  OpenRouter only), otherwise the Pages build ships **without** CSP. That's intentional BYOK design.
- CI order (also the local completion bar): typecheck → lint → unit → e2e → bundle budget.

## Workflow conventions

- Run the QA tools after every change or extension: `pnpm test:unit`, `pnpm test:e2e`, and the
  Formatter/Prettier (`pnpm format`) on new or edited files.
- Third-party licences: adding, upgrading or removing a runtime dependency means updating
  `THIRD_PARTY_LICENSES.md` (package, version, SPDX id, copyright line) in the same change and
  copying it to `public/` — `tests/unit/third-party-licenses.test.ts` fails otherwise.
- Commit after every change (when several features/fixes are requested, prefer one atomic commit
  each), but **never push** — the maintainer decides when to publish.
- Tests must be deterministic and must **not** touch the network (mock/fake transport only).
- Bug fixes must include a regression test that fails before the fix.
- A change is done only when: full suite + typecheck + lint + formatter pass, verified in a browser
  ≤390 px (touch + keyboard), verified offline (AI flow aside), README/docs updated in the same
  change, and the diff adds no new request to a third-party origin.
