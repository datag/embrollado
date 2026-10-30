# Contract: Learner Profile, Settings and Service Configuration

**Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Storage**: [storage-export.md](./storage-export.md)

The Settings screen is the only place where the learner states who they are and which AI service
to use (FR-021, FR-034; owner requirement for the name and further personal details).

---

## 1. Screens

| Screen   | Route           | Purpose                                                                                   |
| -------- | --------------- | ----------------------------------------------------------------------------------------- |
| Sessions | `#/`            | The list of past and running conversations (FR-016)                                       |
| Dialogue | `#/session/:id` | One conversation, the cycle of §3 (FR-006…FR-014)                                         |
| Setup    | `#/new`         | Target language, level, situation, partner — or the learner's own (FR-001…FR-005)         |
| Settings | `#/settings`    | Service configuration, learner profile, theme, language, storage (FR-021, FR-033, FR-034) |
| About    | `#/about`       | Licence, font attribution, privacy notes (OFL obligations)                                |

Hash routing (`createWebHashHistory`) so the app works on any static host without a rewrite rule.

## 2. Settings screen contract

### 2.1 AI service

| Field           | Control                                                                           | Validation                                                                  | Where it goes                                                          |
| --------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Service address | Text input + preset list (OpenAI, OpenRouter, Ollama, llama.cpp, vLLM, LM Studio) | Absolute http(s) URL                                                        | `ServiceConfig.baseUrl`                                                |
| API key         | Password input, with a reveal toggle                                              | Non-empty                                                                   | `ServiceConfig.apiKey` (local only)                                    |
| Auth style      | Select: `Bearer` / `x-api-key` / `api-key`                                        | —                                                                           | `ServiceConfig.authMode`                                               |
| Chat model      | Text input, with a "fetch models" action that calls `GET {baseUrl}/models`        | Non-empty                                                                   | `ServiceConfig.chatModel`                                              |
| Speech model    | Text input, optional                                                              | —                                                                           | `ServiceConfig.speechModel`                                            |
| Speech voice    | Text input, optional; empty ⇒ provider default                                    | Voices are model-specific — a wrong voice is the usual cause of an HTTP 400 | `ServiceConfig.speechVoice`                                            |
| Image model     | Text input, optional                                                              | —                                                                           | `ServiceConfig.imageModel`                                             |
| Test            | Button: "Test the connection"                                                     | —                                                                           | Sends one minimal request; reports success, the CORS hint or the error |

**Rules**

- The key is written only to `embrollado.service.v1` on the device (FR-022). It is never sent
  anywhere except the configured `baseUrl`, never logged, never exported.
- The "Test the connection" action is the only automatic request the app makes, and it only runs
  when the learner presses the button (FR-023).
- A CORS failure shows the provider-specific hint from `contracts/ai-service.md` §8.

### 2.2 The learner

| Field               | Control                                                 | Validation                 | Where it goes                                                         |
| ------------------- | ------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| Appearance          | Text area                                               | ≤ 500 characters, optional | `LearnerProfile.appearance` — perceivable, sent with every dialogue  |
| Voice               | Text area                                               | ≤ 300 characters, optional | `LearnerProfile.voice` — perceivable, sent with every dialogue       |
| Age                 | Number                                                  | 0…120, optional            | `LearnerProfile.age` — sent as an approximate band                   |
| Gender              | Select: not specified / female / male / other           | —                          | `LearnerProfile.gender`                                               |
| Name                | Text input                                              | ≤ 60 characters, optional  | `LearnerProfile.name` — pictures always; dialogue only via the "already knows you" option |
| About me            | Text area                                               | ≤ 500 characters, optional | `LearnerProfile.details` — pictures always; dialogue only via the "already knows you" option |
| Native language     | Select from the language list + "same as the interface" | —                          | `LearnerProfile.nativeLanguage` (`null` ⇒ interface language, FR-034) |
| Interface language  | Select: English / Deutsch                               | —                          | `LearnerProfile.interfaceLanguage` (FR-033)                           |
| Theme               | Select: light / dark / follow the system                | —                          | `LearnerProfile.theme`                                                |
| Cached spoken lines | Number input                                            | 0…200, default 20          | `LearnerProfile.cachedSpeechLines` (FR-050)                           |

**Rules**

- The perceivable traits (appearance, voice, age, gender) are **sent to the AI service** as part of
  the model context of every dialogue and of the picture prompt, so the partner can perceive the
  learner and the pictures can show them (FR-059).
- The **name and the personal details** are sent in the picture context (FR-028) and reach the
  dialogue only when the learner enables the per-session option "The AI partner already knows you"
  (FR-060). Otherwise the partner must learn them during the conversation (FR-059).
- A **pseudonym tip** next to the profile fields makes clear that these values can reach the
  configured provider.
- Both name and details are optional; the picture context falls back to "the learner has not
  shared personal details".
- The interface language switch applies immediately to every screen and every message (FR-033).
- The native language applies to the feedback only: translation, explanation, interpretation,
  assumptions, assessment and the badge label (FR-036). The corrected answer stays in the target
  language.

### 2.3 Storage

| Entry                    | Behaviour                                                                  |
| ------------------------ | -------------------------------------------------------------------------- |
| Storage used / available | From `navigator.storage.estimate()`; a warning when the headroom is low    |
| Persistent storage       | A button that calls `navigator.storage.persist()` inside the click handler |
| Export                   | Downloads the JSON file (see `contracts/storage-export.md` §7)             |
| Import                   | Picks a file, shows the warning, then replaces the conversations           |
| Delete a conversation    | Per session in the session list; confirmed and permanent (FR-018)          |

## 3. The dialogue cycle in the UI

| Step | What the learner sees                                                                                                                                                                             | Requirement            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1    | The partner's line appears — progressively while it is generated (FR-035). Its translation sits muted directly under the line, hidden by default; a per-line toggle reveals or hides it, and once the learner answers the line the translation becomes visible immediately | FR-006, FR-057         |
| 2    | The learner's input field with a send button of at least 44 × 44 px                                                                                                                               | FR-007                 |
| 3    | One feedback block, always in this order: explanation (optional) → correction → interpretation → assumptions → quality badge → issues. Every field concerns the learner's own latest answer — the explanation clarifies it, the correction fixes it, the interpretation translates it | FR-008, FR-014 |
| 4    | The partner's next line (or the cycle ends when the learner ends the session)                                                                                                                     | FR-011                 |

Feedback block details:

- The **badge** is a coloured pill with the tier's label from the translation files (FR-041,
  FR-042). The colour and the text must reach 4.5:1 contrast.
- **Assumptions** are shown in a marked block: the learner's original text (`???`) next to the
  filled-in text and the reason (FR-009).
- The partner line's **translation** is NOT part of the feedback block: it is rendered muted under
  the line itself, hidden by default, revealable per line via a toggle, and revealed automatically
  once the line has been answered (FR-057). A translation that was explicitly hidden stays hidden.
- The **correction** is shown in the target language, everything else in the native language
  (FR-036).

States the dialogue view must render: empty (no session yet), waiting for the first line,
streaming, complete, failed (with the learner's text kept and a retry), offline, and
"the service is not configured" (with a link to Settings).

## 4. Setup screen contract

| Control         | Options                                                                       | Requirement    |
| --------------- | ----------------------------------------------------------------------------- | -------------- |
| Target language | The catalogue's language list                                                 | FR-002         |
| Level           | beginner / intermediate / expert, each with a one-line explanation            | FR-002         |
| Situation       | The 13 predefined situations + the learner's saved templates + "write my own" | FR-003, FR-044 |
| Partner         | The 5 predefined partners + the learner's saved templates + "write my own"    | FR-003, FR-044 |
| Conversation option | "The AI partner already knows you" — checkbox, default off                 | FR-060         |

"Write my own" opens a small form:

| Field                             | Validation                           | Persistence |
| --------------------------------- | ------------------------------------ | ----------- |
| Name (partner) / Name (situation) | Required, ≤ 60 / 80 characters       | FR-048      |
| Age (partner), optional           | 0…120                                | —           |
| Occupation (partner)              | Required, ≤ 60 characters            | FR-048      |
| Description / Setting             | Required, ≤ 400 characters           | FR-048      |
| Language of the description       | Required for learner-defined entries | —           |
| Save as a template                | Toggle                               | FR-045      |
| Use for this session only         | The default when not saving          | FR-046      |

A session keeps a **snapshot** of the situation and the partner, so later changes to a template
never rewrite past conversations. The conversation option is snapshotted the same way
(`Session.options`), so a resumed session and an export keep the partner's starting knowledge
identical to the original talk.

## 5. Validation and error behaviour in the UI

| Case                                               | Behaviour                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The service is not configured                      | The dialogue view shows "Set up your AI service" with a link to Settings; no request is sent                             |
| The key is rejected (401/403)                      | "The service rejected the key" with a link to Settings                                                                   |
| The service is rate limiting (429)                 | "The service is rate limiting, try again in a moment"; the typed text is kept                                            |
| The service is unreachable / the browser blocks it | The cross-origin hint for that provider (`contracts/ai-service.md` §8)                                                   |
| The answer cannot be parsed                        | "The service answered in an unexpected format"; the typed text is kept; the turn is not shown as valid feedback (FR-025) |
| The device is offline                              | "You are offline — the dialogue needs the service"; reading, exporting and the settings stay usable                      |
| The device storage is full                         | "The device storage is full — cached audio is no longer being saved"; nothing else is deleted (FR-051)                   |
| The picture could not be generated                 | The conversation continues without a picture (FR-030)                                                                    |
| The speech could not be produced                   | The playback button explains that the service cannot do speech; the conversation continues (FR-027)                      |
