import type { Level, SituationRef, PartnerRef } from '@/domain/types'
import { TURN_SCHEMA, EXPLANATION_SCHEMA } from '@/ai/schema'

/**
 * System-prompt assembly (T039; turn-payload.md §4). The learner profile is part of the prompt
 * and therefore leaves the device — the privacy text says so explicitly.
 */

export interface PromptInput {
  partner: PartnerRef
  situation: SituationRef
  level: Level
  targetLanguage: string
  feedbackLanguage: string
  learnerName: string | null
  learnerDetails: string | null
}

const LEVEL_RULES: Record<Level, string> = {
  beginner:
    'Level: beginner. Use simple, everyday vocabulary, short sentences and clear grammar. Speak ' +
    'a little slower than normal, repeat key phrases naturally, and keep each line short.',
  intermediate:
    'Level: intermediate. Use everyday vocabulary and natural sentence structures. Occasionally ' +
    'use common idioms. The learner can hold a flowing conversation but still makes mistakes.',
  expert:
    'Level: expert. Use advanced, idiomatic vocabulary and complex sentence structures. ' +
    'Treat the learner as fluent; keep the conversation rich and natural.',
}

export function buildSystemPrompt(input: PromptInput): string {
  const role = [
    `You are ${input.partner.name}${input.partner.age != null ? `, ${input.partner.age}` : ''}, ` +
      `${input.partner.occupation}. ${input.partner.description}`,
  ].join('')
  const situation = `Situation: ${input.situation.name}. ${input.situation.setting}`
  const learner =
    input.learnerName || input.learnerDetails
      ? `The learner is ${input.learnerName ? input.learnerName : 'someone who has not given a name'}` +
        (input.learnerDetails ? `; details about them: ${input.learnerDetails}` : '') +
        `. Address them by name when it is natural to do so.`
      : 'The learner has not shared personal details; address them generally.'

  return [
    role,
    situation,
    LEVEL_RULES[input.level],
    `Speak the target language: ${input.targetLanguage}.`,
    `All explanatory feedback text (translation, explanation, interpretation, assumptions, ` +
      `gaps, assessment, issues) MUST be written in: ${input.feedbackLanguage} — the learner's ` +
      `native language. The corrected answer MUST stay in the target language.`,
    learner,
    'Rules:',
    '- One utterance per turn, at most 300 characters.',
    '- Stay fully in character as the person described above; never break into a teaching/lesson voice.',
    '- Always answer with the JSON turn object described in the schema; never with prose outside it.',
    '- The "explanation" field MUST explain the learner\'s answer in the LATEST user message — ' +
      'what it means and how well it works — and MUST be written in the ' +
      `feedback language (${input.feedbackLanguage}), NEVER in the target language (except for a ` +
      'quoted word or phrase from the answer, which may appear inside the explanation).',
    '- When the learner used "???" or a word from the native language as a gap, fill it with the most ' +
      'plausible replacement and explain in the "assumptions" field why that reading fits the context ' +
      '(max 5 assumptions).',
    '- The "interpretation" field MUST be the learner\'s answer rendered in the feedback ' +
      'language — the translation of what their words mean, as one would interpret them ' +
      '(e.g. for "Hey buddy, are you lost?" write "Hey Kumpel, bist du verloren?"). ' +
      'Translate ONLY the learner\'s own text: never add intentions, never import the ' +
      'situation or the partner\'s lines, and never add framing like "The learner asks:" — ' +
      'the heading already shows whose words these are. If a part of the answer is a gap ' +
      'marker or unintelligible, translate the rest and keep that part unchanged.',
    '- The feedback fields (explanation, correctedText, interpretation, assumptions, badge, ' +
      "issues) MUST assess ONLY the learner's answer in the LATEST user message — never an " +
      "earlier answer, never the partner's lines, and never the feedback of a previous turn.",
    '- The "translation" field MUST translate the partner line you just produced (partnerText) ' +
      'into the feedback language.',
    "- If the learner's text is already correct, set correctedText to null.",
    '- Rate the learner\'s answer against the selected level. Perfect to very good: tier "perfect". ' +
      'Good: tier "good". Acceptable: tier "acceptable". Unsatisfying: tier "unsatisfactory".',
    '- The badge label wording comes from the app; choose tier and a labelKey from the translation ' +
      'files only (e.g. "good.1", "perfect.short").',
    "- The partner's line must continue the role-play naturally and end the turn with a clear " +
      'prompt or question that invites the learner to answer.',
  ].join('\n')
}

/** The learner-facing message for one turn request. */
export function buildTurnUserMessage(learnerAnswer: string | null): {
  role: 'user'
  content: string
} {
  const content =
    learnerAnswer == null || learnerAnswer.trim() === ''
      ? 'The session is starting. Say the first line and open the situation.'
      : `The learner answered:\n\n${learnerAnswer}`
  return { role: 'user', content }
}

/** The schema text embedded in the prompt for the `json_object` fallback (ai-service.md §3). */
export function schemaInPrompt(schema: unknown): string {
  try {
    return JSON.stringify(schema, null, 0)
  } catch {
    return ''
  }
}

/** Context for "Explain to me" — the learner's answer plus the partner line it responded to. */
export interface ExplanationContext {
  partnerLine: { text: string; translation: string | null } | null
  learnerAnswer: string | null
  correctedText: string | null
  interpretation: string | null
  issues: Array<{ category: string; detail: string }>
}

/**
 * "Explain to me" message set (turn-payload.md §5). The request explains THE LEARNER's answer —
 * never the partner's next line, which is not part of this context at all.
 */
export function buildExplanationMessages(
  systemPrompt: string,
  context: ExplanationContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `The learner answered this partner line:\n${JSON.stringify(context)}\n`,
    },
    {
      role: 'user',
      content:
        "Explain the LEARNER's answer above — what they meant, how correct it was, and the most " +
        'useful thing to improve. Base your explanation only on the shown learner answer, the ' +
        'correction, the interpretation and the issues; ignore any other context. ' +
        'Answer with the embrollado_explanation JSON object. ' +
        "ALL text MUST be written in the learner's native language (the feedback language declared " +
        'in the system prompt), NEVER in the target language — quoted target-language words may ' +
        'appear inside the explanation.',
    },
  ]
}

/** The explanation schema text, embedded in the prompt on the json_object fallback. */
export const EXPLANATION_SCHEMA_TEXT = schemaInPrompt(EXPLANATION_SCHEMA as unknown as unknown)

export function buildConnectionUserMessage(): { role: 'user'; content: string } {
  return {
    role: 'user',
    content: 'Reply with the JSON object {"reply": "ok"}.',
  }
}

/** Illustration prompt (FR-028; turn-payload.md §6). */
export function buildIllustrationPrompt(
  situation: SituationRef,
  momentDescription: string,
): string {
  return (
    `A warm, friendly illustration of ${situation.setting}, ${momentDescription}. ` +
    `Soft daylight, simple composition, no text.`
  )
}

export { TURN_SCHEMA }
