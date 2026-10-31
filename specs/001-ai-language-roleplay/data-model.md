# Phase 1 Data Model: Embrollado

**Date**: 2026-10-28 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md) |
**Spec**: [spec.md](./spec.md)

Storage layout follows the decisions in `research.md` (D6, D7, D8): IndexedDB is the primary store,
`localStorage` holds only a small settings document, and every name is prefixed with the app name.

---

## 1. Storage map

```text
IndexedDB database: "embrollado"          (version 1)
├── store "embrollado:sessions"   key: session.id (UUID)
│     index "embrollado:by-createdAt"   → session.createdAt
│     index "embrollado:by-language"    → session.language
├── store "embrollado:turns"      key: turn.id (UUID)
│     index "embrollado:by-session"     → turn.sessionId
│     index "embrollado:by-position"    → [turn.sessionId, turn.position]
├── store "embrollado:illustrations" key: illustration.id (UUID)
│     index "embrollado:by-session"     → illustration.sessionId
├── store "embrollado:audio"      key: audio.id (UUID)
│     index "embrollado:by-session"     → audio.sessionId
│     index "embrollado:by-turn"        → audio.turnId
└── store "embrollado:meta"       key: string
      keys: "embrollado:schemaVersion", "embrollado:lastExportAt"

localStorage
├── "embrollado.settings.v1"   { schema: 1, data: Settings }
└── "embrollado.service.v1"    { schema: 1, data: ServiceConfig }
```

Prefix rule (owner requirement): the database, every object store, every index and every
`localStorage` key starts with `embrollado` (stores/indexes use `embrollado:`, `localStorage`
keys use `embrollado.`). Object-store names are immutable in IndexedDB, so they are fixed here.

## 2. Entities

### Session

A single practice conversation. FR-015, FR-016, FR-053.

| Field               | Type                                       | Rules                                                                                                                                                                 |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID string                                | Required, unique on the device, written to the export file and reused on import (FR-053)                                                                              |
| `title`             | string                                     | Required, ≤ 80 characters, renameable (FR-018); defaults to `<situation> · <partner>`                                                                                 |
| `language`          | ISO 639-1 code                             | Required, one of the catalogue's target languages                                                                                                                     |
| `level`             | `"beginner" \| "intermediate" \| "expert"` | Required; changes apply from the next partner line on                                                                                                                 |
| `situation`         | `SituationRef`                             | Required                                                                                                                                                              |
| `partner`           | `PartnerRef`                               | Required                                                                                                                                                              |
| `situationSnapshot` | `SituationSnapshot`                        | Required — the situation and partner as they were described when the session started, so later edits or deletions of a learner-defined template never rewrite history |
| `options`           | `SessionOptions`                           | Required — the conversation options chosen when the session started (e.g. `{ knowsLearner }`), snapshotted like the situation (FR-060)                                |
| `state`             | `"active" \| "ended"`                      | Required                                                                                                                                                              |
| `createdAt`         | ISO 8601 string                            | Required                                                                                                                                                              |
| `updatedAt`         | ISO 8601 string                            | Required                                                                                                                                                              |
| `turnCount`         | number                                     | Required, derived from the stored turns                                                                                                                               |
| `lastTurnAt`        | ISO 8601 string \| null                    | Required                                                                                                                                                              |

### Turn

One cycle step of a session. FR-006…FR-014, FR-040…FR-043.

| Field                 | Type            | Rules                                                                                                                                                                                                     |
| --------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | UUID string     | Required                                                                                                                                                                                                  |
| `sessionId`           | UUID string     | Required, references a Session                                                                                                                                                                            |
| `position`            | number          | Required, ≥ 1, unique per session                                                                                                                                                                         |
| `partnerText`         | string          | Required — the partner's line in the target language                                                                                                                                                      |
| `partnerTextLanguage` | ISO 639-1       | Required, always the target language                                                                                                                                                                      |
| `translation`         | string          | Required — the partner's line in the learner's native language (FR-036)                                                                                                                                   |
| `explanation`         | string \| null  | Optional — objective coach note on the learner's answer, partner in the third person; null on the opening turn; never quotes or translates the new partner line of the same turn (FR-008, FR-061, FR-063) |
| `learnerText`         | string \| null  | Required for turns the learner answered; null for the opening turn                                                                                                                                        |
| `correctedText`       | string \| null  | The learner's answer, corrected; stays in the target language (FR-036)                                                                                                                                    |
| `interpretation`      | string \| null  | The learner's answer translated into the native language (what their words mean); never the partner's line (FR-008, FR-063)                                                                               |
| `assumptions`         | `Assumption[]`  | The gaps that were filled (FR-009)                                                                                                                                                                        |
| `badge`               | `Badge \| null` | The four-tier rating (FR-040); `unknown` when the model gave no usable rating                                                                                                                             |
| `issues`              | `Issue[]`       | Concrete things to improve, derived from the model's issue list                                                                                                                                           |
| `illustrationId`      | UUID \| null    | FK → Illustration                                                                                                                                                                                         |
| `audioId`             | UUID \| null    | FK → the cached AudioEntry for this line                                                                                                                                                                  |
| `createdAt`           | ISO 8601 string | Required                                                                                                                                                                                                  |
| `feedbackLanguage`    | ISO 639-1       | Required — the language the feedback was delivered in (FR-036)                                                                                                                                            |

### Persona (conversation partner)

FR-003, FR-044, FR-045, FR-046.

| Field         | Type                                    | Rules                                                                                                                                 |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string                                  | Required; `builtin:<slug>` for the 5 predefined partners, UUID for learner-defined ones                                               |
| `name`        | string                                  | Required, ≤ 60 characters                                                                                                             |
| `age`         | number \| null                          | Optional, 0…120                                                                                                                       |
| `gender`      | `"female" \| "male" \| "other" \| null` | Optional — used to describe the person in generated pictures (FR-028)                                                                 |
| `occupation`  | string                                  | Required, ≤ 60 characters                                                                                                             |
| `description` | string                                  | Required, ≤ 400 characters — the short biography the model plays                                                                      |
| `origin`      | `"builtin" \| "learner"`                | Required                                                                                                                              |
| `visibility`  | `"template" \| "session-only"`          | Required — a saved template persists; a session-only entry lives in the tab's sessionStorage and is gone when the tab closes (FR-046) |
| `createdAt`   | ISO 8601 string                         | Required for learner-defined entries                                                                                                  |

### Situation

FR-003, FR-044, FR-045, FR-046.

| Field               | Type                           | Rules                                                                                                                                 |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | string                         | Required; `builtin:<slug>` for the 13 predefined situations, UUID for learner-defined ones                                            |
| `name`              | string                         | Required, ≤ 80 characters                                                                                                             |
| `setting`           | string                         | Required, ≤ 400 characters — where and what is happening                                                                              |
| `keyMoments`        | string[]                       | Required; the situation's key moments — legacy illustration hooks (FR-028 as amended: pictures are on demand)                         |
| `suggestedPartners` | string[]                       | Optional hints; not a restriction (FR-044)                                                                                            |
| `origin`            | `"builtin" \| "learner"`       | Required                                                                                                                              |
| `visibility`        | `"template" \| "session-only"` | Required — a saved template persists; a session-only entry lives in the tab's sessionStorage and is gone when the tab closes (FR-046) |
| `createdAt`         | ISO 8601 string                | Required for learner-defined entries                                                                                                  |

### LearnerProfile

The learner as the app knows them. FR-021, FR-034; owner requirement (settings: name and further
details about their own person). Only the perceivable traits travel by default — FR-059.

| Field               | Type                                    | Rules                                                                                                                        |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `appearance`        | string                                  | Optional, ≤ 500 characters — what someone sees (hair, height, clothing); perceivable, part of every dialogue and of pictures |
| `voice`             | string                                  | Optional, ≤ 300 characters — what someone hears (voice, laugh, accent); perceivable, part of every dialogue                  |
| `age`               | number \| null                          | Optional, 0…120; sent to the model as an approximate band ("somewhere in their thirties")                                    |
| `gender`            | `"female" \| "male" \| "other" \| null` | Optional; perceivable                                                                                                        |
| `name`              | string                                  | Optional, ≤ 60 characters; pictures always, dialogue only with the "already knows you" option (FR-060)                       |
| `details`           | string                                  | Optional, ≤ 500 characters — job, hobbies, family, …; pictures always, dialogue only with the "already knows you" option     |
| `nativeLanguage`    | ISO 639-1 \| null                       | Optional; `null` means "fall back to the interface language" (FR-034)                                                        |
| `interfaceLanguage` | `"en" \| "de"`                          | Required, default `"en"` (FR-033)                                                                                            |
| `theme`             | `"light" \| "dark" \| "auto"`           | Required, default `"auto"`                                                                                                   |
| `cachedSpeechLines` | number                                  | Required, default 20, range 0…200 (FR-050)                                                                                   |

### SessionOptions

A per-session snapshot chosen when the conversation starts (FR-060).

| Field          | Type    | Rules                                                                                           |
| -------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `knowsLearner` | boolean | Default `false`. True releases the stored name + details to the partner from the first line on. |

### ServiceConfig

The AI service the learner brings. FR-021, FR-022, FR-038.

| Field             | Type                                   | Rules                                                                                                       |
| ----------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `baseUrl`         | string                                 | Required, must be an absolute `http(s)` URL; stored locally only (FR-022)                                   |
| `apiKey`          | string                                 | Required; stored locally only; never written to a log, an export or an error message (FR-022, Principle IV) |
| `authMode`        | `"bearer" \| "x-api-key" \| "api-key"` | Required, default `"bearer"`                                                                                |
| `chatModel`       | string                                 | Required                                                                                                    |
| `speechModel`     | string \| null                         | Optional; `null` disables speech (FR-026)                                                                   |
| `speechVoice`     | string \| null                         | Optional; the voice for the speech model — model-specific, `null` ⇒ profile default (TTS 400-avoidance)     |
| `imageModel`      | string \| null                         | Optional; `null` disables illustrations (FR-028)                                                            |
| `providerProfile` | string                                 | Required — selects the endpoint profile (see `contracts/ai-service.md`)                                     |

### Illustration

FR-028, FR-029, FR-052.

| Field              | Type                        | Rules                                                                            |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------- |
| `id`               | UUID string                 | Required                                                                         |
| `sessionId`        | UUID string                 | Required, references a Session                                                   |
| `turnId`           | UUID \| null                | The turn the picture was requested on; `null` only for legacy situation pictures |
| `moment`           | `"start" \| "key" \| "end"` | Required — on-demand pictures use `"key"`                                        |
| `prompt`           | string                      | Required, ≤ 1000 characters — the scene narration sent to the model              |
| `mimeType`         | string                      | Required, e.g. `image/webp`                                                      |
| `bytes`            | Blob                        | Required — stored locally, never fetched from a third-party address (FR-029)     |
| `width` / `height` | number                      | Required                                                                         |
| `createdAt`        | ISO 8601 string             | Required                                                                         |

On-demand pictures are bound to a turn and replace a previous picture of the same turn on a
second request. `PartnerRef` (the snapshot copied into the session) carries the partner's `age`
and `gender` so the narration knows who is in the scene.

### AudioEntry (speech cache)

FR-026, FR-029, FR-050.

| Field       | Type            | Rules                                                              |
| ----------- | --------------- | ------------------------------------------------------------------ |
| `id`        | UUID string     | Required                                                           |
| `sessionId` | UUID string     | Required                                                           |
| `turnId`    | UUID string     | Required                                                           |
| `text`      | string          | The line that was spoken — the key used to reuse an identical line |
| `voice`     | string          | Required                                                           |
| `mimeType`  | string          | Required, e.g. `audio/mpeg`                                        |
| `bytes`     | Blob            | Required                                                           |
| `createdAt` | ISO 8601 string | Required — the pruning order (oldest first)                        |

### Assumption (embedded in Turn)

FR-009.

| Field      | Type   | Rules                                                                                       |
| ---------- | ------ | ------------------------------------------------------------------------------------------- |
| `original` | string | Required — the learner's original text at that position (`???` or the native-language word) |
| `filled`   | string | Required — the plausible replacement the model assumed                                      |
| `reason`   | string | Required — why that reading fits the context, objectively phrased (FR-061)                  |

### Badge (embedded in Turn)

FR-040…FR-043.

| Field      | Type                                                                   | Rules                                                                                                       |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `tier`     | `"perfect" \| "good" \| "acceptable" \| "unsatisfactory" \| "unknown"` | Required; the four rating values, plus the app-side `unknown` state (missing/malformed rating, grey)        |
| `labelKey` | string                                                                 | Required — the key of the wording variant shown; the wording itself lives in the translation files (FR-041) |
| `label`    | string                                                                 | The rendered label, stored so a stored transcript keeps the wording it was shown with                       |

### Issue (embedded in Turn)

| Field        | Type                                                     | Rules                                                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category`   | `"grammar" \| "vocabulary" \| "usage" \| "completeness"` | Required                                                                                                                                                                                                                   |
| `detail`     | string                                                   | Required, in the native language, objectively phrased (FR-061)                                                                                                                                                             |
| `suggestion` | string \| null                                           | Optional, in the native language, objectively phrased, never a command to change the answer (FR-062)                                                                                                                       |
| `original`   | string \| null                                           | Optional — the wrong fragment exactly as the learner wrote it; set only for a concrete wrong form and only together with `corrected` (FR-062); optional in the type so stored turns from before this field keep validating |
| `corrected`  | string \| null                                           | Optional — the same fragment as it should be; must differ from `original`; the app drops phantom pairs whose `original` does not appear in the answer (FR-062)                                                             |

## 3. Relationships

```text
Session 1 ──── n Turn                (turn.sessionId → session.id, cascade delete)
Session 1 ──── n Illustration        (illustration.sessionId → session.id, cascade delete)
Session 1 ──── n AudioEntry          (audio.sessionId → session.id, cascade delete)
Turn    1 ──── 0..1 Illustration     (turn.illustrationId)
Turn    1 ──── 0..1 AudioEntry       (turn.audioId)
Turn    1 ──── n Assumption          (embedded)
Turn    1 ──── 0..1 Badge            (embedded)
Turn    1 ──── n Issue               (embedded)
Session n ──── 1 Situation (ref)     (snapshot copied into the session)
Session n ──── 1 Persona (ref)       (snapshot copied into the session)
LearnerProfile 1 ──── 1 ServiceConfig (settings screen; independent of any session)
```

`Situation` and `Persona` are catalogue entities, not children of a session. A session stores a
**snapshot** of both, so deleting or renaming a learner-defined template never rewrites past
sessions (edge case in the spec).

## 4. Validation rules

| Rule                                                                              | Source                      | Where it is enforced                                                       |
| --------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `session.id` is a valid UUID and unique                                           | FR-053                      | `data/sessions.ts` on write; the store key is the UUID                     |
| `turn.position` is unique and consecutive within a session                        | FR-014                      | `data/sessions.ts`                                                         |
| `session.language` is in the catalogue's language list                            | FR-002                      | `domain/catalogue.ts`                                                      |
| `session.level` ∈ {beginner, intermediate, expert}                                | FR-002                      | `domain/catalogue.ts`                                                      |
| A turn always has a badge unless the learner has not answered yet                 | FR-040                      | `domain/session.ts`                                                        |
| A badge tier is one of the four rating values, or `unknown` for an unratable turn | FR-040, FR-058              | `domain/badge.ts`                                                          |
| A badge label is one of the locale's variants for that tier                       | FR-041, FR-042              | `i18n/badges.ts`                                                           |
| A learner-defined persona has a name; a learner-defined situation has a setting   | FR-048                      | `views/SetupView.vue` + `data/profile.ts`                                  |
| A learner-defined entry is either a template or session-only                      | FR-045, FR-046              | `data/profile.ts` + `data/oneShots.ts`                                     |
| Editing a learner-defined entry keeps its id and replaces the entry               | FR-047                      | `data/profile.ts` + `views/SetupView.vue`                                  |
| An import file has `format === "embrollado.export"` and an integer `version ≥ 1`  | FR-056                      | `data/exportImport.ts` before any write                                    |
| An import file is not larger than 250 MB                                          | — (denial-of-service guard) | `data/exportImport.ts` before reading                                      |
| The API base URL is an absolute http(s) URL                                       | FR-021                      | `views/SettingsView.vue`                                                   |
| The API key is never written to a log, an export or an error message              | FR-022                      | `ai/errors.ts` redaction + `data/exportImport.ts` excludes `ServiceConfig` |

## 5. State transitions

### Session

```text
          start
            │
            ▼
        ┌────────┐   end session (learner)    ┌────────┐
        │ active │ ─────────────────────────▶ │ ended  │
        └────────┘                            └────────┘
            │  ▲                                  │
            │  │ continue (reopen from the list)  │ delete (confirmed, permanent)
            │  └──────────────────────────────────┘
            ▼
        deleted
```

- `active → ended`: the learner ends the session explicitly. The transcript stays readable.
- `active → active`: reopening an active session continues the dialogue (FR-011 keeps the cycle
  running until the learner ends the session).
- `ended → active`: **not** implemented in the first release — an ended session is read-only. This
  was flagged as an open point during `/speckit.clarify` and is resolved here; see the note in the
  plan's "Notes for the reviewer" below.
- Any state → `deleted`: confirmed and permanent (FR-018).

### Turn (a single cycle step)

```text
  ┌────────────┐  learner sends an answer   ┌──────────────┐
  │ awaiting   │ ─────────────────────────▶ │ generating   │
  │ (partner   │                            │ (streaming)  │
  │  line only)│                            └──────┬───────┘
  └────────────┘                                   │
                                                   │ stream finished / fallback
                                                   ▼
                                           ┌──────────────┐
                                           │ feedback     │
                                           │ complete     │
                                           └──────────────┘
```

Failure states: `generating → failed` (the learner's text is kept and can be sent again — the
edge case in the spec); `generating → aborted` (the learner cancelled). In both cases the turn
keeps the partner line if it had already been streamed.

### Badge tier

The tier is chosen by the model from the answer's correctness and quality **relative to the
selected level** (FR-043). The app validates the returned tier against the four rating values;
when the model returns something unexpected or omits the badge entirely (typical with the
`json_object` fallback), the badge shows as `unknown` (grey) — the app never invents a rating
(FR-058, FR-025), and the assessment is never empty.

## 6. Storage operations that need care

| Operation                                | Rule                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writing an illustration or an audio blob | Wrap in `try/catch` for `QuotaExceededError`; on failure prune the speech cache (oldest first) and retry once; never delete a picture or a transcript (FR-051) |
| Writing a session or a turn              | One transaction over `embrollado:sessions` and `embrollado:turns`; a transaction must not clear a store and write in a second transaction                      |
| Deleting a session                       | One transaction deleting the session, its turns, its illustrations and its audio                                                                               |
| Importing a file                         | Validate, migrate, then **one** transaction that replaces the sessions, turns, illustrations and audio                                                         |
| Exporting                                | Assemble the JSON envelope from chunked `BlobPart`s so the whole file is never materialised as one string                                                      |
| Pruning the speech cache                 | Keep the newest `cachedSpeechLines` entries per session; run after each cached write                                                                           |

## 7. Notes for the reviewer

- **Ended sessions are read-only.** The spec implies this (FR-016 says "read the complete
  transcript") but does not state it. This is the open point flagged at the end of
  `/speckit.clarify`; it is resolved here as "ended = read-only" and needs a one-line addition to
  the spec if the owner wants the opposite.
- **The learner profile's `name` and `details`** come from the owner's technical notes and extend
  the spec's "Learner profile and settings" entity, which the spec lists without naming its
  fields. They are passed into the model's context so the partner can address the learner by name
  — see `contracts/turn-payload.md`.
- **The API key lives in `localStorage`** (`embrollado.service.v1`). IndexedDB would not protect it
  any better: both are readable by any script running on the origin. The privacy documentation
  states this plainly instead of implying the key is protected.
