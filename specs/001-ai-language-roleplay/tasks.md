---
description: 'Task list for the Embrollado AI language practice conversations feature'
---

# Tasks: Embrollado – AI Language Practice Conversations

**Input**: Design documents from `/specs/001-ai-language-roleplay/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md,
data-model.md, contracts/

**Tests**: Test tasks are included. They are required here by the project constitution
(Principle V: non-trivial logic MUST be covered, the suite MUST run with one command and MUST
never need the network) and by the plan's quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- The app is a browser-only SPA; no `backend/` and no `frontend/` split
- Paths follow the source tree in `specs/001-ai-language-roleplay/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create the repository skeleton per `specs/001-ai-language-roleplay/plan.md`: `src/{ai,assets/fonts,components,composables,data,domain,i18n/locales,router,views}/`, `public/`, `tests/{unit,component,e2e}/`, `tools/`
- [x] T002 Initialize the pnpm project in `package.json` with `"packageManager": "pnpm@10.0.0"`, `"license": "MIT"`, the scripts `dev`, `build`, `preview`, `lint`, `format`, `typecheck`, `test`, `test:unit`, `test:e2e`, `mock-ai`, and `pnpm.onlyBuiltDependencies` for the native build scripts
- [x] T003 Add the runtime dependencies `vue@3.5.44`, `vue-router@5.4.0`, `vue-i18n@11.4.16`, `idb@8.0.4`, `marked@18.1.2`, `dompurify@3.4.17`, `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `vite@8.3.5` and the dev dependencies `typescript@6.0.3`, `vue-tsc@3.3.13`, `vitest@5.0.5`, `@vue/test-utils@2.5.1`, `happy-dom@21.0.4`, `fake-indexeddb@6.2.6`, `@playwright/test@1.64.1`; commit `pnpm-lock.yaml`
- [x] T004 Configure TypeScript in `tsconfig.json` with `strict: true`, `skipLibCheck: true`, `moduleResolution: "bundler"`, `types: ["vite/client"]`, and a matching `tsconfig.node.json`
- [x] T005 Configure Vite in `vite.config.ts` with the `@tailwindcss/vite` plugin, `build.rolldownOptions.output.codeSplitting: false`, `build.assetsInlineLimit: 0` and `build.modulePreload.polyfill: false`
- [x] T006 Create the Tailwind theme in `src/style.css`: `@import "tailwindcss"`, `@custom-variant dark (&:where(.dark, .dark *))`, and an `@theme inline` block mapping `--color-surface`, `--color-fg`, `--color-accent` to `:root` / `.dark` values
- [x] T007 [P] Configure ESLint with `eslint-plugin-vue` and `typescript-eslint` plus Prettier in `eslint.config.js` and `.prettierrc.json`
- [x] T008 [P] Add the MIT `LICENSE` file and the font licence files in `src/assets/fonts/LICENSES/OFL.txt` and `src/assets/fonts/LICENSES/NOTICE.md` recording the subsetting
- [x] T009 [P] Add the self-hosted font `src/assets/fonts/atkinson-next-var-latin.woff2` (Atkinson Hyperlegible Next, variable, subset to Latin + Latin-1 + Latin Extended-A, ~38 KB) with an `@font-face` rule using `font-weight: 200 800` and `font-display: swap`
- [x] T010 [P] Create `index.html` with the viewport meta tag, the `#app` mount point, a `<link rel="preload">` for the font and no inline script or style
- [x] T011 [P] Create the mock AI service `tools/mock-ai.mjs` with `POST /v1/chat/completions` (streamed and unstreamed), `GET /v1/models`, `POST /v1/audio/speech` and `POST /v1/images/generations`
- [x] T012 [P] Create `tools/check-bundle-size.mjs` that fails when the gzipped size of `dist/assets/*.js` exceeds 250 KB
- [x] T013 [P] Create the static server `tools/serve.mjs` that reads `allowedApiOrigin` from `embrollado.config.json` and sets the strict CSP `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <allowedApiOrigin>; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`
- [x] T014 [P] Add `embrollado.config.example.json` and the `public/.nojekyll` file
- [x] T015 Configure Vitest in `vitest.config.ts` (environment `happy-dom`, `setupFiles: ["tests/setup.ts"]`) and Playwright in `playwright.config.ts` with the projects Pixel 5 (393 px), iPhone 12 (390 px) and iPhone SE (320 px) against `pnpm preview`
- [x] T016 [P] Create `tests/setup.ts` importing `fake-indexeddb/auto` and resetting `indexedDB` per test

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T017 Create the domain types in `src/domain/types.ts`: `Session` (id: UUID, title ≤ 80 chars, language, level ∈ beginner/intermediate/expert, situation, partner, situationSnapshot, learnerName, state active/ended, createdAt, updatedAt, turnCount, lastTurnAt), `Turn` (position, partnerText, translation, explanation, correctedText, interpretation, assumptions, badge, issues, explain, illustrationId, audioId, feedbackLanguage), `Persona`, `Situation`, `LearnerProfile`, `ServiceConfig`, `Illustration`, `AudioEntry`, `Explanation`, `Assumption`, `Badge`, `Issue`
- [x] T018 Implement the IndexedDB layer in `src/data/db.ts`: database `embrollado` with the stores `embrollado:sessions`, `embrollado:turns`, `embrollado:illustrations`, `embrollado:audio`, `embrollado:meta` and the indexes `embrollado:by-createdAt`, `embrollado:by-language`, `embrollado:by-session`, `embrollado:by-position`
- [x] T019 Implement the versioned settings store in `src/data/settings.ts`: key `embrollado.settings.v1`, payload `{ "schema": 1, "data": … }`, migration on read, defaults when the stored schema is newer
- [x] T020 Implement the service configuration store in `src/data/profile.ts`: key `embrollado.service.v1` with `baseUrl`, `apiKey`, `authMode`, `chatModel`, `speechModel`, `imageModel`, `providerProfile`; the API key is never written to a log or an export
- [x] T021 Implement the AI transport seam in `src/ai/transport.ts`: the single `fetch` call site, an SSE frame parser that tolerates comment frames, keepalive frames and a missing `choices` array, and never parses a partial buffer as JSON
- [x] T022 Implement the error normaliser in `src/ai/errors.ts`: the OpenAI shape `{ error: { message, type, param, code } }` and the OpenRouter shape `{ error: { code, message, metadata } }`, error bodies returned with HTTP 200, `fetch` `TypeError` classified as `cors`/`network`, and the API key replaced with `***` in every message
- [x] T023 Implement the provider profiles in `src/ai/providers.ts`: `openai`, `openrouter`, `ollama`, `llamacpp` (schema placed as a sibling of `type` and sent in both places), `vllm`, `lmstudio`, `custom`, each with the auth mode, the audio `response_format` and the images path
- [x] T024 Implement the single AI adapter in `src/ai/aiService.ts`: request construction, response parsing, the `json_schema` → `json_object` fallback with the schema in the prompt, and the capability detection for chat, streaming, speech, images and the model list
- [x] T025 Implement the catalogue in `src/domain/catalogue.ts`: the target language list, the three levels beginner/intermediate/expert with their one-line descriptions, the 12 predefined situations and the 5 predefined partners
- [x] T026 Implement the router in `src/router/index.ts` with `createWebHashHistory()` and the routes `#/`, `#/session/:id`, `#/new`, `#/settings`, `#/about`
- [x] T027 Implement the internationalisation in `src/i18n/index.ts` with the locales `src/i18n/locales/en.ts` and `src/i18n/locales/de.ts` and the fallback chain native language → interface language → English, plus the badge label variants in `src/i18n/badges.ts` (at least two per tier per locale)
- [x] T028 Implement the theme composable in `src/composables/useTheme.ts`: `light` / `dark` / `auto`, toggling the `dark` class on `<html>`
- [x] T029 Create the app shell in `src/main.ts`, `src/App.vue` and `src/components/AppHeader.vue` with the view outlet, usable at 320 px without horizontal scrolling
- [x] T030 Implement the settings composable in `src/composables/useSettings.ts`: reactive state persisted to `embrollado.settings.v1`, quota failures swallowed with a warning

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Start a practice conversation with a chosen person and situation (Priority: P1) 🎯 MVP

**Goal**: The learner picks a target language, a level, a situation and a partner — or brings their
own — and the partner's first line appears in the target language.

**Independent Test**: Open the app, choose language, level, situation and partner, start, and
verify that the partner's first line appears in the target language and matches the choice. The
feedback features are not needed for this story to be complete.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T031 [P] [US1] Unit test the catalogue in `tests/unit/catalogue.test.ts`: 12 situations, 5 partners, every situation combinable with every partner, the three levels
- [x] T032 [P] [US1] Component test the setup pickers in `tests/component/setup.test.ts`
- [x] T033 [P] [US1] End-to-end test starting a session against the mock service in `tests/e2e/dialogue.spec.ts`

### Implementation for User Story 1

- [x] T034 [P] [US1] Create the setup screen `src/views/SetupView.vue` with the language, level, situation and partner pickers and a "start" action
- [x] T035 [P] [US1] Create `src/components/LanguagePicker.vue` and `src/components/LevelPicker.vue` with the plain-language level descriptions
- [x] T036 [P] [US1] Create `src/components/SituationPicker.vue` and `src/components/PartnerPicker.vue` with search by keyword
- [x] T037 [P] [US1] Create the learner-defined entry form `src/components/CustomEntryForm.vue`: a partner needs a name ≤ 60 chars, an age of 0…120, an occupation ≤ 60 chars and a description ≤ 400 chars; a situation needs a name ≤ 80 chars and a setting ≤ 400 chars; the entry is either saved as a template or used for this session only
- [x] T038 [US1] Implement the session creation in `src/data/sessions.ts`: a UUID id, a title ≤ 80 chars, the level from {beginner, intermediate, expert} and a snapshot of the situation and partner as they were described
- [x] T039 [US1] Implement the system prompt in `src/ai/prompts.ts`: role, situation, level rules, target language, feedback language, the learner's name and details, and the gap-filling rules
- [x] T040 [US1] Implement the dialogue screen `src/views/DialogueView.vue` with the header showing situation, partner, language and level, the partner bubble and the input with a send control of at least 44 × 44 px
- [x] T041 [US1] Implement the turn cycle in `src/composables/useSession.ts`: create the session, request the partner's line, stream it progressively and render it as it arrives

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Get feedback on my own answer (Priority: P1)

**Goal**: After every answer the learner sees the translation of the partner's line, the corrected
answer, the interpretation, the filled-in gaps, a quality badge and the issues, plus an
"Explain to me" action.

**Independent Test**: Send one answer containing a deliberate mistake and an unknown word, and
verify that all feedback elements appear and that "Explain to me" returns further information.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T042 [P] [US2] Unit test the badge tiers in `tests/unit/badge.test.ts`: the four tiers perfect/good/acceptable/unsatisfactory and an invalid tier falling back to acceptable
- [x] T043 [P] [US2] Unit test the SSE parser in `tests/unit/transport.sse.test.ts`: comment frames, keepalive frames, the OpenRouter final frame with a non-empty `choices`, and a partial buffer that is never parsed
- [x] T044 [P] [US2] Unit test the error normaliser in `tests/unit/errors.test.ts`: both provider shapes, an HTTP 200 error body and a `TypeError`
- [x] T045 [P] [US2] Unit test the prompt builder in `tests/unit/prompts.test.ts`
- [x] T046 [P] [US2] Component test the feedback panel in `tests/component/FeedbackPanel.test.ts`: the six elements in the fixed order and the explanation added without hiding them
- [x] T047 [P] [US2] End-to-end test the feedback cycle in `tests/e2e/feedback.spec.ts`

### Implementation for User Story 2

- [x] T048 [P] [US2] Create the turn JSON schema in `src/ai/schema.ts` with all properties required, `additionalProperties: false` and the badge tier enum `perfect|good|acceptable|unsatisfactory`
- [x] T049 [P] [US2] Implement the badge logic in `src/domain/badge.ts`: tier validation and the rotation through the label variants
- [x] T050 [P] [US2] Create `src/components/QualityBadge.vue` with a distinct colour per tier and the label from `src/i18n/badges.ts`
- [x] T051 [P] [US2] Create `src/components/TurnBubble.vue` for the partner's line and the learner's answer
- [x] T052 [US2] Create the feedback block `src/components/FeedbackPanel.vue` in the fixed order: translation → explanation → correction → interpretation → assumptions → badge → issues
- [x] T053 [US2] Implement the feedback assembly and validation in `src/domain/session.ts`: at most 5 assumptions, assumptions dropped when their original text is not in the learner's answer, an invalid tier falling back to acceptable
- [x] T054 [US2] Implement the "Explain to me" request in `src/ai/aiService.ts` with the `embrollado_explanation` schema and store the result on the turn
- [x] T055 [P] [US2] Create `src/components/ExplainButton.vue` that adds the explanation without hiding the existing feedback
- [x] T056 [US2] Store the turn with its feedback in `src/data/sessions.ts` and render the feedback block in `src/views/DialogueView.vue`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Review and manage my conversations (Priority: P2)

**Goal**: The learner sees every past conversation, opens a transcript, searches, renames,
deletes, exports and imports.

**Independent Test**: Run two sessions with different partners, reload the app, and verify that
both are listed, that a reopened session shows its complete transcript with the feedback, and that
an export and import reproduce the same conversations.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T057 [P] [US3] Unit test the export envelope in `tests/unit/exportImport.test.ts`: the `embrollado.export` magic, the integer version, the chunked blob assembly and the absence of the API key
- [x] T058 [P] [US3] Unit test the migrations in `tests/unit/migrations.test.ts`: a v1 fixture migrates to the current version and a newer version is refused
- [x] T059 [P] [US3] End-to-end test the export and import round trip in `tests/e2e/export-import.spec.ts`: a second browser context acts as the clean device, the warning is shown and the identifiers survive
- [x] T060 [P] [US3] End-to-end test the session list in `tests/e2e/sessions.spec.ts`: list, search, rename and confirmed delete

### Implementation for User Story 3

- [x] T061 [P] [US3] Create the session list `src/views/SessionsView.vue` showing situation, partner, language, level, date and turn count
- [x] T062 [US3] Implement the session operations in `src/data/sessions.ts`: `listSessions`, `renameSession`, `deleteSession` with the cascade over turns, illustrations and audio in one transaction, and search by language, situation and keyword
- [x] T063 [P] [US3] Create the transcript list `src/components/TranscriptList.vue` rendering the stored turns with all their feedback
- [x] T064 [US3] Implement the export in `src/data/exportImport.ts`: the envelope `{ format: "embrollado.export", version: 1, exportedAt, app, sessions }`, the chunked `BlobPart` assembly and the download name `embrollado-export-YYYY-MM-DD-HHmm.json`
- [x] T065 [US3] Implement the import in `src/data/exportImport.ts`: the 250 MB size cap, the validation of `format` and `version`, the migration chain, the warning naming the affected conversations and the replace in a single transaction
- [x] T066 [P] [US3] Create the share menu `src/components/ShareMenu.vue` with download and import always available and the native share entry only when `navigator.canShare({ files })` is true
- [x] T067 [US3] Add the read-only mode for ended sessions in `src/views/DialogueView.vue`

**Checkpoint**: At this point, User Stories 1, 2 AND 3 should all work independently

---

## Phase 6: User Story 4 - Keep my practice data on my own device (Priority: P2)

**Goal**: Everything stays on the device; the app works without a network apart from the AI
service; the service is configured by the learner; nothing is ever sent anywhere else.

**Independent Test**: Disconnect the network, reload, browse the sessions and export them, then
trace a full session and see that only the configured AI service is contacted.

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T068 [P] [US4] End-to-end test the persistence across a reload and the offline behaviour in `tests/e2e/offline.spec.ts`
- [x] T069 [P] [US4] End-to-end test the network isolation in `tests/e2e/network.spec.ts`: no third-party request and no CSP violation during a full session
- [x] T070 [P] [US4] Unit test the settings migration in `tests/unit/settings.test.ts`

### Implementation for User Story 4

- [x] T071 [P] [US4] Create the settings screen `src/views/SettingsView.vue` with the service address, the API key, the auth style, the three model fields and a "test the connection" action
- [x] T072 [P] [US4] Create the learner profile form `src/components/ProfileForm.vue`: name ≤ 60 chars and personal details ≤ 500 chars
- [x] T073 [US4] Implement the connection test in `src/ai/aiService.ts`: one minimal request, and the provider-specific cross-origin hint when the request fails with a `TypeError`
- [x] T074 [US4] Implement the storage safeguards in `src/data/db.ts`: `navigator.storage.persist()` inside a user gesture, the `QuotaExceededError` handling that prunes only the speech cache and never a transcript or a picture
- [x] T075 [P] [US4] Create the app-shell service worker `public/sw.js`: precache the built assets, carry a version constant so a new deployment replaces the old cache without interrupting a running session, and never cache the AI origin
- [x] T076 [US4] Register the service worker and the web app manifest in `src/main.ts` and `public/manifest.webmanifest`, production only
- [x] T077 [US4] Implement the language switching in `src/composables/useSettings.ts` and `src/i18n/index.ts`: the interface language applies to every screen, the native language applies to the feedback only and falls back to the interface language
- [x] T078 [US4] Implement the storage usage display and the persistent-storage request in `src/views/SettingsView.vue`

**Checkpoint**: At this point, User Stories 1 to 4 should all work independently

---

## Phase 7: User Story 5 - Hear the partner and see the situation (Priority: P2)

**Goal**: The learner can play back the partner's lines and sees an illustration of the situation
at the start, at the key moments and at the end.

**Independent Test**: Start a session on a service that supports speech and images and verify that
a line can be played and an illustration appears; repeat on a service without those capabilities
and verify the graceful fallback.

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T079 [P] [US5] Unit test the speech cache pruning in `tests/unit/media.test.ts`: only the newest `cachedSpeechLines` entries are kept and the oldest are pruned first
- [x] T080 [P] [US5] End-to-end test the speech and the illustration in `tests/e2e/media.spec.ts`

### Implementation for User Story 5

- [x] T081 [P] [US5] Implement the speech request in `src/ai/aiService.ts`: `POST /v1/audio/speech` with an explicit `response_format`, the audio as a `Blob` played from an object URL, and the capability marked unavailable on a 404 or 405
- [x] T082 [US5] Implement the media store in `src/data/media.ts`: the illustrations and the audio entries with the bounded cache and the quota handling
- [x] T083 [P] [US5] Create the playback control `src/components/SpeechButton.vue` that explains the situation when the service cannot produce speech
- [x] T084 [US5] Implement the illustration generation in `src/ai/aiService.ts`: `POST /v1/images/generations` requesting base64, the bytes stored locally and a failure that never interrupts the conversation
- [x] T085 [P] [US5] Create the illustration panel `src/components/IllustrationPanel.vue` for the start, key and end moments
- [x] T086 [US5] Wire the illustration moments into the turn cycle in `src/domain/session.ts`

**Checkpoint**: At this point, all five user stories should work independently

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T087 [P] Create the about screen `src/views/AboutView.vue` with the MIT licence, the font attribution and the privacy notes, satisfying the OFL requirement to name the font and its licence
- [x] T088 [P] Write `README.md` with the prerequisites, the pnpm commands, the test command, how to configure the AI service, where the data lives, the export and import, and both deployment options; add `docs/` with the API configuration guide
- [x] T089 [P] Check the accessibility of the core flows in `src/components/QualityBadge.vue`, `src/views/DialogueView.vue` and `src/style.css`: a contrast of at least 4.5:1 for the four badge colours, hit targets of at least 44 px, keyboard operability and no horizontal scrolling at 320 px
- [x] T090 [P] Verify the CSP and the network isolation with `tools/serve.mjs`: zero CSP violations, no request to any origin other than the configured AI service
- [x] T091 Run `node tools/check-bundle-size.mjs` and record the measured gzipped JavaScript size
- [x] T092 Run the validation scenarios from `specs/001-ai-language-roleplay/quickstart.md` end to end
- [x] T093 [P] Verify the GitHub Pages deployment in `.github/workflows/gh-pages.yml` and `README.md`: the base path, the hash routes, the service worker scope and the repository variable `CSP_MODE`

## Phase 9: Translation at the Partner Line (FR-057)

**Purpose**: Deliver the partner-line translation with the same request (already the case) and
render it muted under the line — hidden by default, revealable per line, auto-revealed once the
learner answers (FR-057).

### Implementation

- [x] T094 Implement the pure visibility rule in `src/domain/session.ts`: `translationVisible(override, answered, sessionEnded)` — an explicit decision wins, otherwise answered lines and every line of an ended session are visible
- [x] T095 Wire the per-line visibility into `src/composables/useSession.ts`: a reactive `translationOverrides` map, `isTranslationVisible(turnId)` and `toggleTranslation(turnId)`, and the auto-reveal of the answered line at the start of `sendAnswer`
- [x] T096 Extend `src/components/TurnBubble.vue` with an optional muted `translation` rendered under the text (partner side only)
- [x] T097 Create the per-line toggle `src/components/TranslationToggle.vue` (eye button, `aria-pressed`, 44 × 44 px)
- [x] T098 Wire the bubble and the toggle into `src/views/DialogueView.vue`; remove the translation section from `src/components/FeedbackPanel.vue`; show the translation muted in `src/components/TranscriptList.vue`
- [x] T099 Add the i18n labels `dialogue.showTranslation` / `dialogue.hideTranslation` to `src/i18n/locales/en.ts` and `de.ts`; drop the unused `feedback.translation`

### Tests for Phase 9

- [x] T100 [P] Unit test `translationVisible` in `tests/unit/session-visibility.test.ts`
- [x] T101 [P] Component test the bubble translation and the toggle in `tests/component/translation.test.ts`
- [x] T102 Update `tests/component/FeedbackPanel.test.ts` for the new block order (explanation first, no translation)
- [x] T103 Update `tests/e2e/dialogue.spec.ts`: translation hidden by default, toggle reveal/hide, auto-reveal of the answered line while the new line stays hidden

### Interpretation as a translation into the feedback language (follow-up)

- [x] T104 Sharpen the system-prompt rule for `interpretation` in `src/ai/prompts.ts`: it must render the learner's answer in the feedback language — the translation of what their words mean, as one would interpret them; only the learner's own text is translated (no intentions, no situation/partner-line import, no framing like "The learner asks:"), gap markers stay unchanged
- [x] T105 Update the interpretation rule assertion in `tests/unit/prompts.test.ts`, the mock answer in `tools/mock-ai.mjs` (learner answer translated into German) with the matching e2e assertion in `tests/e2e/dialogue.spec.ts`, and the `interpretation` wording in `contracts/turn-payload.md` and `data-model.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P2 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Builds on the adapter and the session from US1, but the feedback block is testable on its own
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Needs the session storage from US1, independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Needs the settings and profile stores from Phase 2, independently testable
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Needs the adapter from Phase 2, independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test the catalogue in tests/unit/catalogue.test.ts"
Task: "Component test the setup pickers in tests/component/setup.test.ts"
Task: "End-to-end test starting a session against the mock service in tests/e2e/dialogue.spec.ts"

# Launch all screens and components for User Story 1 together:
Task: "Create the setup screen src/views/SetupView.vue with the language, level, situation and partner pickers and a 'start' action"
Task: "Create src/components/LanguagePicker.vue and src/components/LevelPicker.vue with the plain-language level descriptions"
Task: "Create src/components/SituationPicker.vue and src/components/PartnerPicker.vue with search by keyword"
Task: "Create the learner-defined entry form src/components/CustomEntryForm.vue"
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Unit test the badge tiers in tests/unit/badge.test.ts"
Task: "Unit test the SSE parser in tests/unit/transport.sse.test.ts"
Task: "Unit test the error normaliser in tests/unit/errors.test.ts"
Task: "Unit test the prompt builder in tests/unit/prompts.test.ts"
Task: "Component test the feedback panel in tests/component/FeedbackPanel.test.ts"
Task: "End-to-end test the feedback cycle in tests/e2e/feedback.spec.ts"

# Launch the schema, the badge logic and the components together:
Task: "Create the turn JSON schema in src/ai/schema.ts"
Task: "Implement the badge logic in src/domain/badge.ts"
Task: "Create src/components/QualityBadge.vue with a distinct colour per tier"
Task: "Create src/components/TurnBubble.vue for the partner's line and the learner's answer"
Task: "Create src/components/ExplainButton.vue that adds the explanation without hiding the existing feedback"
```

---

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task: "Unit test the export envelope in tests/unit/exportImport.test.ts"
Task: "Unit test the migrations in tests/unit/migrations.test.ts"
Task: "End-to-end test the export and import round trip in tests/e2e/export-import.spec.ts"
Task: "End-to-end test the session list in tests/e2e/sessions.spec.ts"

# Launch the screen and the components together:
Task: "Create the session list src/views/SessionsView.vue"
Task: "Create the transcript list src/components/TranscriptList.vue"
Task: "Create the share menu src/components/ShareMenu.vue"
```

---

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: "End-to-end test the persistence across a reload and the offline behaviour in tests/e2e/offline.spec.ts"
Task: "End-to-end test the network isolation in tests/e2e/network.spec.ts"
Task: "Unit test the settings migration in tests/unit/settings.test.ts"

# Launch the screens, the form and the service worker together:
Task: "Create the settings screen src/views/SettingsView.vue"
Task: "Create the learner profile form src/components/ProfileForm.vue"
Task: "Create the app-shell service worker public/sw.js"
```

---

## Parallel Example: User Story 5

```bash
# Launch all tests for User Story 5 together:
Task: "Unit test the speech cache pruning in tests/unit/media.test.ts"
Task: "End-to-end test the speech and the illustration in tests/e2e/media.spec.ts"

# Launch the components together:
Task: "Create the playback control src/components/SpeechButton.vue"
Task: "Create the illustration panel src/components/IllustrationPanel.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
   - Developer D: User Story 4
   - Developer E: User Story 5
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
