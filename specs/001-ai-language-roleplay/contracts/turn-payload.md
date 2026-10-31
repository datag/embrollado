# Contract: The Turn Payload

**Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Service**: [ai-service.md](./ai-service.md)

What the model must return for one cycle step, and how the app renders it. The payload is the
enforceable form of FR-008 (translation, explanation, correction, interpretation, assumptions,
badge) and FR-040…FR-043 (the four-tier badge).

---

## 1. Shape of a turn

```json
{
  "partnerText": "¿Puedecriberse dónde está el lavadero?",
  "translation": "Können Sie mir sagen, wo der Waschraum ist?",
  "explanation": "Deine Antwort ist verständlich; etwas natürlicher wäre «¿Puede decirme…?».",
  "correctedText": "¿Puede decirme dónde está el lavadero?",
  "interpretation": "Kann ich neben den Waschräumen warten?",
  "assumptions": [
    {
      "original": "???",
      "filled": "el lavadero",
      "reason": "The partner had just mentioned the washroom, so this is the word that fits."
    }
  ],
  "badge": { "tier": "good", "labelKey": "good.short" },
  "issues": [
    {
      "category": "grammar",
      "detail": "«¿Puede decirse?» is not idiomatic here.",
      "suggestion": "Use «¿Puede decirme…?»."
    }
  ]
}
```

| Field            | Required           | Language | Rule                                                                                 |
| ---------------- | ------------------ | -------- | ------------------------------------------------------------------------------------ |
| `partnerText`    | yes                | target   | The partner's next line; one utterance, ≤ 300 characters                             |
| `translation`    | yes                | native   | The partner's line in the learner's native language (FR-036)                         |
| `explanation`    | no                 | native   | Optional explanation of the learner's answer — an objective note, partner in the third person (FR-008, FR-061) |
| `correctedText`  | no                 | target   | The learner's answer, corrected; `null` when the answer was already correct (FR-036) |
| `interpretation` | yes                | native   | The learner's answer translated into the native language — what their words mean (FR-008) |
| `assumptions`    | yes (may be empty) | native   | The gaps that were filled (FR-009)                                                   |
| `badge`          | yes                | —        | The four-tier rating (FR-040)                                                        |
| `issues`         | yes (may be empty) | native   | Concrete things to improve                                                           |

`partnerText` and `translation` are produced by the **same** model call — the app renders the
translation muted under the line it belongs to without a second request (FR-057).

## 2. JSON schema

Sent as `response_format.json_schema` with `strict: true`. Every property is listed in `required`
(strict mode forbids optionals — a missing field is expressed as `null`).

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "partnerText",
    "translation",
    "explanation",
    "correctedText",
    "interpretation",
    "assumptions",
    "badge",
    "issues"
  ],
  "properties": {
    "partnerText": { "type": "string" },
    "translation": { "type": "string" },
    "explanation": { "type": ["string", "null"] },
    "correctedText": { "type": ["string", "null"] },
    "interpretation": { "type": "string" },
    "assumptions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["original", "filled", "reason"],
        "properties": {
          "original": { "type": "string" },
          "filled": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    },
    "badge": {
      "type": "object",
      "additionalProperties": false,
      "required": ["tier", "labelKey"],
      "properties": {
        "tier": { "type": "string", "enum": ["perfect", "good", "acceptable", "unsatisfactory"] },
        "labelKey": { "type": "string" }
      }
    },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["category", "detail", "suggestion"],
        "properties": {
          "category": {
            "type": "string",
            "enum": ["grammar", "vocabulary", "usage", "completeness"]
          },
          "detail": { "type": "string" },
          "suggestion": { "type": ["string", "null"] }
        }
      }
    }
  }
}
```

**Validation on arrival** (the app is the last line of defence):

- `badge` missing, `null` or not an object ⇒ the turn is rated `unknown` (grey) — the json_object
  fallback does not enforce the schema, so a weak model may omit the field. The app never invents
  a rating: no `acceptable` fallback in that case (owner decision), and the assessment is never
  empty (FR-025, SC-003).
- `badge.tier` outside the four values ⇒ the badge is shown as `unknown` and the turn is flagged
  internally (FR-025).
- `assumptions[].original` does not appear in the learner's text ⇒ the assumption is dropped.
- An assumption is shown only when the learner actually left a gap: the answer contains the `???`
  marker, or `original` is a **single word** that differs from `filled`. A phrase the learner wrote
  in the target language is never a gap — the model sometimes lists one anyway, and the app drops
  it (FR-009).
- The number of assumptions is capped at 5; the rest are dropped.
- Unknown keys are ignored.

## 3. The badge

| Tier             | Meaning              | Label examples (English)   | Label examples (German)   |
| ---------------- | -------------------- | -------------------------- | ------------------------- |
| `perfect`        | Perfect to very good | "Perfect!", "Very good!"   | "Perfekt!", "Sehr gut!"   |
| `good`           | Good                 | "Good!", "Well done!"      | "Gut!", "Gut gemacht!"    |
| `acceptable`     | Acceptable           | "Acceptable", "That works" | "Akzeptabel", "Das geht"  |
| `unsatisfactory` | Unsatisfying         | "Not quite", "What?"       | "Noch nicht ganz", "Wie?" |
| `unknown`        | No rating could be determined (grey) | "No assessment" | "Keine Bewertung"        |

- The model returns the **tier** and a **label key**. The wording itself comes from the
  translation files (FR-041), so the same tier can be shown with different wordings on different
  turns (FR-042) without the model choosing the wording.
- `unknown` is **not** a tier the model may return — it is an app-side fallback for a missing or
  malformed rating, shown in grey. The app never invents a rating (owner decision).
- Each tier has at least two variants per locale. The app picks one — by default the next unused
  variant of the previous turn, so consecutive turns rarely repeat the same word.
- The tier is judged **relative to the selected level** (FR-043): the same sentence earns a
  different tier for a beginner than for an expert learner.
- There is **no numeric score** (owner decision, `/speckit.clarify`).

The app renders the badge with a distinct colour per tier; the colours must reach a contrast
ratio of at least 4.5:1 against the badge background (WCAG 1.4.3).

## 4. The system prompt

The system prompt is assembled by `ai/prompts.ts` from:

1. **Role** — "You are {partner.name}, {partner.age}, {partner.occupation}. {partner.description}".
2. **Situation** — "{situation.name}: {situation.setting}".
3. **Level** — one of the three level instructions (beginner / intermediate / expert), which bound
   vocabulary, sentence length and grammar.
4. **Languages — three of them, and they never mix** — (a) the situation and partner text may be
   written in **any** language; its language is irrelevant and never mirrored in the dialogue;
   (b) **`partnerText`** is in the **target language** (named explicitly, e.g. "Spanish", not only
   the ISO code; a short phrase in another language is a rare, natural exception, but the line
   stays in the target language); (c) **`translation`, `explanation`, `interpretation`,
   `assumptions[].reason`, `issues`** are in the **feedback language** (the learner's native
   language), and **`correctedText`** in the target language. The model must never speak to the
   learner in the feedback language and never write feedback in the target language.
5. **Learner perception** — the learner's perceivable traits (appearance, voice, approximate age,
   gender), read against the situation (face to face vs. a phone call), plus either the per-session
   option "The AI partner already knows you" (releases the name + details) or the first-meeting
   knowledge rules: no invented facts, no name before the learner introduces themselves.
6. **Rules** — one utterance per turn; stay in character; never break into a lesson; always answer
   with the JSON turn object; write `partnerText` first, from the learner's answer alone — it
   reacts to what was said, never to the assessment; the partner never mentions the rating and
   never praises or corrects the learner's language in the line; treat `???` and native-language
   words as gaps and fill them with a plausible assumption and state the reason; rate the learner's
   answer against the selected level. The feedback fields (`explanation`, `issues`,
   `assumptions[].reason`) are written in an **objective coach voice** (FR-061): addressed to the
   learner directly ("your answer", "you say"), never in the partner's first person and never
   reporting the partner's own feelings or opinions; the partner is referenced in the third person.
   `interpretation` keeps the learner's voice and `translation` keeps the partner's voice — the
   rule never applies to them. The opening turn has no learner answer, so its `explanation` is
   `null`.
8. **Personality and reactions** — the partner is a real person with feelings, dignity and
   boundaries, not a servile assistant. They react authentically and proportionately to what the
   learner says and how they say it, remember how they have been treated so far, push back against
   rudeness or mockery, and may threaten to end — or actually end — the conversation after repeated
   disrespect (the final line then closes the exchange instead of inviting an answer).

**Request history = the dialogue only.** The message list sent to the model contains the complete
correspondence — every partner line (assistant) and every learner answer (user), plus the system
prompt — but **none of the stored feedback** (no previous `correctedText`, `interpretation`,
`assumptions`, `badge` or `issues`). Storing a previous turn's ratings in the context would anchor
the model's next rating to the previous answer instead of the latest one ("lag by one"). The same
minimal history is rebuilt from the stored turns when a session is resumed after a reload, so a
continued conversation is consistent. Every learner message is labelled: the latest answer is the
one to assess ("this is the answer you assess"), every earlier answer is context that was already
assessed ("already assessed — context only"). The feedback fields assess **only the answer in the
latest user message** — never an earlier answer, the partner's lines or a previous turn's feedback;
earlier answers may be used to understand the conversation, never to re-rate or re-correct them.

Only the learner's **perceivable traits** are part of the dialogue prompt by default (FR-059). The
name and the personal details leave the device only when the per-session option is enabled
(FR-060) or in the picture context of §5. The privacy notes and the pseudonym tip in the app say
so.

The situation description is written from the learner's perspective ("you are queuing…"); the
prompt therefore resolves the ambiguity once: in the situation text, "you" refers to the learner,
not to the partner.

## 5. On-demand illustration prompts (FR-028 as amended)

Pictures are generated only when the learner requests them (button beside the composer) and never
automatically — an explicit user action is required by the constitution (Principle IV). One
request produces the finished scene, a second renders it:

1. **Scene narration** — a small chat completion against the configured chat model. The whole
   context travels in ONE request:

   ```text
   System: You are a visual director … narrate the CURRENT moment of the role-play … plain
           English, at most 60 words, only what is visible — no speech bubbles, no text. If the
           situation means the two cannot see each other (a phone call), show both sides of the
           call as one split scene — two panels, one shared moment — so both people appear.

   User:   Situation: {situation.name} — {situation.setting}
           Note: in the situation description, "you" refers to the learner.
           Partner: {name} — {age} years old, {gender}, {occupation}. {description}
           Learner: {settings.name} — {age band}, {gender}, {appearance}; details: {settings.details}
           Conversation so far:
           {partner.name}: {last partner line}
           {learner.name}: {last learner answer}
           …
   ```

   The Learner line is the **full** context the learner allowed in Settings — perceivable traits,
   name and details — because a picture renders the scene; the stricter dialogue rules of §4 do
   not apply to the visual director.

   The answer is the strict object `{"scene": "<current moment>"}` (`embrollado_scene` schema) —
   e.g. *"A man in his late twenties hands a coin to a woman in her late thirties in front of a
   small campsite washroom building at dusk."* The dialogue is part of the request context; stored
   feedback (badge, issues, corrections) is never sent.

2. **Picture** — the image endpoint renders exactly that narration:

   ```text
   A warm, friendly illustration of {scene}.
   Soft daylight, simple composition, no text.
   ```

- The model is asked for a `webp` image where supported; the bytes are stored locally.
- The picture is bound to the turn it was requested on (`Turn.illustrationId`,
  `Illustration.turnId`) and shown inline in the dialogue; a second request replaces it. The
  binding survives export/import (export v2 keeps stable turn ids).
- The button is only offered when an image model is configured, the provider profile exposes an
  images path, illustrations are enabled, and the endpoint has not already declined.
- A failure of either request never affects the turn (FR-030): only a short hint is shown, and on
  a provider rejection (`404`/`405`) the button disappears and the app continues without pictures.
