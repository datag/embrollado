import type { Gender, Level, SituationRef, PartnerRef } from '@/domain/types'
import { audiblePerception, visiblePerception, ageRangePhrase } from '@/domain/perception'
import { TURN_SCHEMA } from '@/ai/schema'

/**
 * System-prompt assembly (T039; turn-payload.md §4). Only the learner's perceivable traits
 * (appearance, voice, approximate age, gender) are part of the normal prompt. The learner's name
 * and details travel only when the per-session option "the AI partner already knows you" is
 * enabled — otherwise the partner must learn them during the conversation. The scene prompt for
 * the picture generation keeps the full learner context, because a picture of the situation is a
 * rendering, not the partner's knowledge.
 */

export interface PromptInput {
  partner: PartnerRef
  situation: SituationRef
  level: Level
  targetLanguage: string
  feedbackLanguage: string
  /** The per-session option: the partner knows the learner (releases name + details). */
  knowsLearner: boolean
  /** Perceivable traits — always part of the context. */
  appearance: string | null
  voice: string | null
  age: number | null
  gender: Gender | null
  /** Only sent when `knowsLearner` is true (the caller filters it). */
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

/**
 * What the partner may know about the learner at the start of the conversation: the perceivable
 * blocks (driven by the situation — face to face vs. a phone call) plus, depending on the
 * per-session option, either the "first meeting" knowledge rules or the already-known details.
 */
function buildLearnerContext(input: PromptInput): string {
  const contact =
    'Contact: read the situation to decide what you can perceive of the learner: face to face ' +
    'you see them; in a phone call you only hear them. Never claim to perceive something the ' +
    'situation does not let you perceive.'
  const parts: string[] = [contact]

  const visible = visiblePerception(input.age, input.gender, input.appearance)
  const audible = audiblePerception(input.age, input.gender, input.voice)
  if (visible.length) {
    parts.push(
      'Visible (only if the situation lets you see them):\n' +
        visible.map((l) => `- ${l}`).join('\n'),
    )
  }
  if (audible.length) {
    parts.push(
      'Audible (only if the situation lets you hear them):\n' +
        audible.map((l) => `- ${l}`).join('\n'),
    )
  }

  if (input.knowsLearner) {
    if (input.learnerName || input.learnerDetails) {
      const lines = ['- You already know the learner from before this conversation.']
      if (input.learnerName)
        lines.push(`- Their name is ${input.learnerName}; you may address them by it.`)
      if (input.learnerDetails) lines.push(`- What you know about them: ${input.learnerDetails}.`)
      parts.push('What you already know about the learner:\n' + lines.join('\n'))
    } else {
      parts.push(
        'What you already know about the learner:\n' +
          '- You already know the learner from before this conversation.',
      )
    }
  } else {
    parts.push(
      'Rules about what you know:\n' +
        '- You are meeting the learner for the first time. Do not act as if you already know them.\n' +
        '- You know nothing about the learner beyond what you can perceive, what the situation ' +
        'establishes, and what they tell you during the conversation. Do not fill the gaps with ' +
        'invented facts: no invented name, no assumed job, age, origin or personal history.\n' +
        '- Once the learner tells you something — their name, for example — you may refer to it ' +
        'from that moment on.\n' +
        '- Use "you" or whatever role the situation gives the learner; there is no name yet.',
    )
  }
  return parts.join('\n\n')
}

export function buildSystemPrompt(input: PromptInput): string {
  const role = [
    `You are ${input.partner.name}${input.partner.age != null ? `, ${input.partner.age}` : ''}, ` +
      `${input.partner.occupation}. ${input.partner.description}`,
  ].join('')
  const situation =
    `Situation: ${input.situation.name}. ${input.situation.setting} ` +
    `In the situation description, "you" refers to the learner, not to you.`

  return [
    role,
    situation,
    LEVEL_RULES[input.level],
    `Speak the target language: ${input.targetLanguage}.`,
    `All explanatory feedback text (translation, explanation, interpretation, assumptions, ` +
      `gaps, assessment, issues) MUST be written in: ${input.feedbackLanguage} — the learner's ` +
      `native language. The corrected answer MUST stay in the target language.`,
    buildLearnerContext(input),
    'Personality and reactions:',
    '- You are a real person with your own feelings, dignity and boundaries — not a servile ' +
      'assistant and never a teacher. You have a life, opinions and moods of your own.',
    '- React authentically and proportionately to the learner — to what they say and how they ' +
      'say it. You can be warm, dry-humoured, reserved, impatient or annoyed, depending on the ' +
      'situation and on how the learner treats you.',
    '- You have self-respect. If the learner is rude, mocking, condescending or dismissive, ' +
      'push back: call it out, become cool or sarcastic. You are not obliged to be agreeable ' +
      'or to keep a conversation going at any cost.',
    '- Remember how the learner has treated you so far in this conversation and let it show. ' +
      'You do not instantly forgive or forget.',
    '- If the learner keeps disrespecting you, threaten to end the conversation — and if it ' +
      'continues, actually end it: say a final goodbye and leave. That final line closes the ' +
      'exchange instead of inviting an answer.',
    "- Never grovel, flatter or apologise for yourself. In the \"partnerText\" field, speak as " +
      'the person you are.',
    'Rules:',
    '- One utterance per turn, at most 300 characters.',
    '- Stay fully in character as the person described above in the "partnerText" field; there, ' +
      'never break into a teaching/lesson voice.',
    '- Always answer with the JSON turn object described in the schema; never with prose outside it.',
    '- The "explanation" field MUST explain the learner\'s answer in the LATEST user message — ' +
      'what it means and how well it works — and MUST be written in the ' +
      `feedback language (${input.feedbackLanguage}), NEVER in the target language (except for a ` +
      'quoted word or phrase from the answer, which may appear inside the explanation).',
    '- The opening turn of a session has no learner answer yet — for it, "explanation" MUST be null.',
    '- Fill a gap only when the learner actually left one: a literal "???" or a single word written ' +
      "in the learner's native language. The \"assumptions\" field then lists the exact gap " +
      '("???" or that word) as "original", the most plausible replacement as "filled", and why it ' +
      'fits the context (max 5). "filled" MUST differ from "original"; words and phrases the learner ' +
      'wrote in the TARGET language are NEVER gaps. If the answer has neither "???" nor a native ' +
      'word, return an empty "assumptions" array.',
    '- The "interpretation" field MUST be the learner\'s answer rendered in the feedback ' +
      'language — the translation of what their words mean, as one would interpret them ' +
      '(e.g. for "Hey buddy, are you lost?" write "Hey Kumpel, bist du verloren?"). ' +
      "Translate ONLY the learner's own text: never add intentions, never import the " +
      'situation or the partner\'s lines, and never add framing like "The learner asks:" — ' +
      'the heading already shows whose words these are. If a part of the answer is a gap ' +
      'marker or unintelligible, translate the rest and keep that part unchanged.',
    '- The feedback fields (explanation, correctedText, interpretation, assumptions, badge, ' +
      "issues) MUST assess ONLY the learner's answer in the LATEST user message — never an " +
      "earlier answer, never the partner's lines, and never the feedback of a previous turn.",
    `- Feedback voice — the "explanation", "issues" and "assumptions[].reason" fields are a ` +
      "language coach's note about the learner's answer: objective, and addressed to the " +
      'learner directly, in the informal "you" mood the app itself uses ("deine Antwort", ' +
      '"du sagst"; "your answer", "you say"). Say what the answer expresses, how well it fits ' +
      'the situation, and what to correct. NEVER write yourself — the partner — in the first ' +
      'person ("ich", "mich", "mir"; "I", "me", "my") and NEVER report your own feelings or ' +
      'opinions ("mir gefällt das", "I like that"). Refer to the partner in the third person — ' +
      "by your name or as \"the partner\" — with pronouns matching your character's gender. " +
      'Wording like "you had warned ME" must become "you had warned HER/HIM": written from the ' +
      "learner's side. Example (write in the feedback language): \"Deine Antwort ist natürlich " +
      'und grammatisch korrekt. Du bestätigst, dass du ein Entwickler bist, und sagst, dass sie ' +
      'dich ja vorher gewarnt hat. Das passt gut zur Situation. Nichts zu korrigieren."',
    '- The "interpretation" field keeps the learner\'s voice — their own "I"/"me" is correct ' +
      'there, because it renders their words. The "translation" field keeps the partner\'s ' +
      'voice — the partner\'s own "I" is correct there. The feedback-voice rule above never ' +
      'applies to these two fields.',
    '- The "translation" field MUST translate the partner line you just produced (partnerText) ' +
      'into the feedback language.',
    "- If the learner's text is already correct, set correctedText to null.",
    '- Rate the learner\'s answer against the selected level. Perfect to very good: tier "perfect". ' +
      'Good: tier "good". Acceptable: tier "acceptable". Unsatisfying: tier "unsatisfactory".',
    '- The badge label wording comes from the app; choose tier and a labelKey from the translation ' +
      'files only (e.g. "good.1", "perfect.short").',
    "- The partner's line must leave the learner something to react to: a natural question, a " +
      'remark or a challenge, as the mood of the scene demands. When the partner ends the ' +
      'conversation, the last line closes the exchange instead of inviting an answer.',
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

/* ------------------------------------------------------------------ */
/* On-demand illustration (FR-028 as amended; turn-payload.md §5).     */
/* ------------------------------------------------------------------ */

export interface SceneContext {
  partner: PartnerRef
  situation: SituationRef
  learnerName: string | null
  learnerDetails: string | null
  /** Perceivable traits of the person behind the screen, for the picture. */
  appearance: string | null
  age: number | null
  gender: Gender | null
  /** The complete correspondence so far — every partner line and every learner answer. */
  dialogue: Array<{ partnerText: string; learnerText: string | null }>
}

/** A partner's gender as a plain English noun for the narration ("a woman", "a man"). */
function genderNoun(g: Gender | null | undefined): string {
  if (g === 'female') return 'a woman'
  if (g === 'male') return 'a man'
  if (g === 'other') return 'a person'
  return ''
}

function describePartner(p: PartnerRef): string {
  const parts: string[] = []
  if (p.age != null) parts.push(`${p.age} years old`)
  const gender = genderNoun(p.gender)
  if (gender) parts.push(gender)
  if (p.occupation) parts.push(p.occupation)
  const head = `Partner: ${p.name}${parts.length ? ` — ${parts.join(', ')}` : ''}.`
  return p.description ? `${head} ${p.description}` : head
}

/**
 * The learner as the picture shows them: the full context the learner allowed in Settings —
 * perceivable traits, and name and details. A picture is a rendering of the scene, not the
 * partner's knowledge, so the stricter dialogue rules do not apply here.
 */
function describeLearnerInScene(ctx: SceneContext): string {
  const traits: string[] = []
  const range = ageRangePhrase(ctx.age)
  if (range) traits.push(range)
  const gender = genderNoun(ctx.gender)
  if (gender) traits.push(gender)
  if (ctx.appearance) traits.push(ctx.appearance)

  if (!ctx.learnerName && !ctx.learnerDetails && traits.length === 0) {
    return 'Learner: the app user has not shared personal details.'
  }
  const name = ctx.learnerName ?? 'the learner'
  const bits: string[] = []
  if (traits.length) bits.push(traits.join(', '))
  if (ctx.learnerDetails) bits.push(`details: ${ctx.learnerDetails}`)
  return bits.length ? `Learner: ${name} — ${bits.join('; ')}.` : `Learner: ${name}.`
}

/**
 * The scene-narration context (turn-payload.md §5). The whole situation, the people and the
 * conversation so far travel in ONE request — the request keeps the dialogue first, and the person
 * behind the learner's screen (perceivable traits + name + details from Settings) is part of the
 * people present. The model answers with `{"scene": "…"}`, a short English description of the
 * CURRENT moment that the image endpoint renders verbatim.
 */
export function buildSceneMessages(
  ctx: SceneContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  const learnerSpeaker = ctx.learnerName ?? 'The learner'
  const lines: string[] = []
  for (const t of ctx.dialogue) {
    if (t.learnerText) lines.push(`${learnerSpeaker}: ${t.learnerText}`)
    if (t.partnerText) lines.push(`${ctx.partner.name}: ${t.partnerText}`)
  }
  const transcript = lines.length
    ? lines.join('\n')
    : `No conversation has happened yet — depict the two meeting for the first time at ${ctx.situation.name}.`

  return [
    {
      role: 'system',
      content:
        'You are a visual director for a private illustration tool. Your job is to narrate the ' +
        'CURRENT moment of a role-play conversation as plain input for an image-generation model. ' +
        'Describe the situation first — where the scene happens and who is present — and only then ' +
        'the concrete now: what the two people are doing at this exact moment and which objects are ' +
        'exchanged or pointed at. Rules: the scene MUST depict the moment of the LAST exchange — ' +
        'earlier lines are background context only, never show several moments at once; if the ' +
        'situation means the two cannot see each other (a phone call), show both sides of the call ' +
        'as one split scene — two panels, one shared moment — so both people appear; write plain ' +
        'English in at most 60 words (image models read English best); describe only what is ' +
        'visible — no speech bubbles, no dialogue text, no captions, no logos; keep it warm and ' +
        'realistic, suitable for a language-practice app for adults.',
    },
    {
      role: 'user',
      content: [
        `Situation: ${ctx.situation.name} — ${ctx.situation.setting}`,
        `Note: in the situation description, "you" refers to the learner — the person behind the screen.`,
        ``,
        describePartner(ctx.partner),
        describeLearnerInScene(ctx),
        ``,
        `Conversation so far:`,
        transcript,
        ``,
        `Depict the current moment: the very last exchange above.`,
      ].join('\n'),
    },
  ]
}

/** Illustration prompt (FR-028 as amended; turn-payload.md §5). The finished scene only. */
export function buildIllustrationPrompt(scene: string): string {
  return (
    `A warm, friendly illustration of ${scene}. ` + `Soft daylight, simple composition, no text.`
  )
}

export function buildConnectionUserMessage(): { role: 'user'; content: string } {
  return {
    role: 'user',
    content: 'Reply with the JSON object {"reply": "ok"}.',
  }
}

export { TURN_SCHEMA }
