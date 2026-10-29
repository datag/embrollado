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
  "explanation": "Die Frage ist höflich; «lavadero» bedeutet Waschraum.",
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
| `explanation`    | no                 | native   | Optional explanation of the learner's answer (FR-008)                                 |
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
4. **Target language** — the language the dialogue is conducted in.
5. **Feedback language** — the language all explanatory text must be written in.
6. **Learner** — the learner's name (if given) and personal details (if given), so the partner can
   address them naturally.
7. **Rules** — one utterance per turn; stay in character; never break into a lesson; always answer
   with the JSON turn object; treat `???` and native-language words as gaps and fill them with a
   plausible assumption and state the reason; rate the learner's answer against the selected level.
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
continued conversation is consistent. The feedback fields must assess **only the answer in the
latest user message**, never an earlier answer, the partner's lines or a previous turn's feedback.

The learner profile is **sent to the model** and therefore leaves the device — it is part of the
prompt. The privacy text in the app says so.

## 5. Illustration prompts (FR-028)

Separate from the turn, a short visual prompt is built from the situation and the moment:

```text
A warm, friendly illustration of {situation.setting}, {moment description}.
Soft daylight, simple composition, no text.
```

- The model is asked for a `webp` image where supported; the bytes are stored locally.
- `moment` is `start`, `key` (one of the situation's `keyMoments`) or `end`.
- A failure here never affects the turn (FR-030).
