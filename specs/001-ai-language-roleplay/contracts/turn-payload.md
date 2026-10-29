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
  "explanation": "«¿Puede decirse?» is a polite request; «el lavadero» is the washroom.",
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
| `explanation`    | no                 | native   | Optional explanation of the partner's line (FR-008)                                  |
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

- `badge.tier` outside the four values ⇒ the badge is shown as `acceptable` and the turn is flagged
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

- The model returns the **tier** and a **label key**. The wording itself comes from the
  translation files (FR-041), so the same tier can be shown with different wordings on different
  turns (FR-042) without the model choosing the wording.
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

The learner profile is **sent to the model** and therefore leaves the device — it is part of the
prompt. The privacy text in the app says so.

## 5. "Explain to me" (FR-010)

A second, separate request with the same turn in context:

```json
{
  "model": "…",
  "messages": [
    { "role": "system", "content": "<the same system prompt>" },
    {
      "role": "user",
      "content": "<the learner's answer + the partner line it responded to, as JSON>"
    },
    {
      "role": "user",
      "content": "Explain the LEARNER's answer — what they meant, how correct it was, and the most useful thing to improve."
    }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "embrollado_explanation",
      "strict": true,
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["kind", "content"],
        "properties": {
          "kind": { "type": "string", "enum": ["semantics", "error", "both"] },
          "content": { "type": "string" }
        }
      }
    }
  }
}
```

- The request explains **the learner's answer**, not the partner's next line: the context JSON
  carries the partner line the learner responded to, the learner's own answer, the corrected
  text, the interpretation and the issues.

- The response is stored on the turn (`turn.explain`) and shown **in addition to** the existing
  feedback, which stays visible (FR-010).
- The explanation is written in the native language.
- The request is made only when the learner presses the button — never automatically (FR-023).

## 6. Illustration prompts (FR-028)

Separate from the turn, a short visual prompt is built from the situation and the moment:

```text
A warm, friendly illustration of {situation.setting}, {moment description}.
Soft daylight, simple composition, no text.
```

- The model is asked for a `webp` image where supported; the bytes are stored locally.
- `moment` is `start`, `key` (one of the situation's `keyMoments`) or `end`.
- A failure here never affects the turn (FR-030).
