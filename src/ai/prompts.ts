import type { Gender, Level, SituationRef, PartnerRef } from '@/domain/types'
import { audiblePerception, visiblePerception, ageRangePhrase } from '@/domain/perception'
import { languageName } from '@/domain/catalogue'
import { TURN_SCHEMA } from '@/ai/schema'
import type { DraftSeeds } from '@/domain/seeds'

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
    `Roles in the situation: "the learner" is the person you are talking to — the user of this ` +
    `app; the other people named there are not you. If the situation addresses that person as ` +
    `"you", then "you" there is the learner, never you.`

  return [
    role,
    situation,
    LEVEL_RULES[input.level],
    `Speak the target language: ${input.targetLanguage}.`,

    // Three languages can be in play at once (owner decision): the situation/partner text in any
    // language, the partner's line in the target language (a short phrase in another language is
    // a rare, natural exception) and the feedback in the learner's native language. Names (not
    // ISO codes) make the assignment unambiguous for weak models.
    `Languages — three of them, and they never mix:`,
    `- The situation and partner description may be written in ANY language (the catalogue uses ` +
      `English; a learner may write their own in whatever language they like). That language is ` +
      `irrelevant — never mirror it in the dialogue.`,
    `- "partnerText" — your line — is in the TARGET language (${languageName(
      input.targetLanguage,
    )}). Speak ${languageName(input.targetLanguage)}. A short phrase in another language is ` +
      `natural now and then, but the line itself stays in ${languageName(input.targetLanguage)}.`,
    `- All explanatory feedback text (translation, explanation, interpretation, assumptions, ` +
      `issues) MUST be written in: ${languageName(input.feedbackLanguage)} — the learner's native ` +
      `language (feedback language).`,
    `- "correctedText" is in the TARGET language: it is the learner's own sentence, corrected.`,
    `- Never speak to the learner in ${languageName(
      input.feedbackLanguage,
    )}, and never write the feedback in ${languageName(input.targetLanguage)}.`,
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
    '- Never grovel, flatter or apologise for yourself. In the "partnerText" field, speak as ' +
      'the person you are.',
    'Rules:',
    '- One utterance per turn, at most 300 characters.',
    '- Stay fully in character as the person described above in the "partnerText" field; there, ' +
      'never break into a teaching/lesson voice.',
    '- Always answer with the JSON turn object described in the schema; never with prose outside it.',
    '- Write "partnerText" first, and write it from the learner\'s message alone: your line reacts ' +
      'to what was said and how it was said — never to the assessment. The rating is written for ' +
      'the learner; the partner does not know it, never mentions it, and never praises, corrects ' +
      "or comments on the learner's language in the line itself.",
    '- The "explanation" field MUST explain the learner\'s answer in the LATEST user message — ' +
      'what it means and how well it works — and MUST be written in the ' +
      `feedback language (${input.feedbackLanguage}), NEVER in the target language (except for a ` +
      'quoted word or phrase from the answer, which may appear inside the explanation).',
    '- The opening turn of a session has no learner answer yet — for it, "explanation" MUST be null.',
    '- Fill a gap only when the learner actually left one: a literal "???" or a single word written ' +
      'in the learner\'s native language. The "assumptions" field then lists the exact gap ' +
      '("???" or that word) as "original", the most plausible replacement as "filled", and why it ' +
      'fits the context (max 5). "filled" MUST differ from "original"; words and phrases the learner ' +
      'wrote in the TARGET language are NEVER gaps. If the answer has neither "???" nor a native ' +
      'word, return an empty "assumptions" array.',
    '- The "interpretation" field MUST be the learner\'s answer rendered in the feedback ' +
      'language — the translation of what their words mean, as one would interpret them ' +
      '(e.g. for a learner writing "Is the washroom next to the showers?" write "Ist der ' +
      'Waschraum neben den Duschen?"). ' +
      "Translate ONLY the learner's own text: never add intentions, never import the " +
      "situation or the partner's lines (a partner question the learner answered is NOT part " +
      'of their answer), and never add framing like "The learner asks:" — ' +
      'the heading already shows whose words these are. If a part of the answer is a gap ' +
      'marker or unintelligible, translate the rest and keep that part unchanged.',
    '- The feedback fields (explanation, correctedText, interpretation, assumptions, badge, ' +
      "issues) MUST assess ONLY the learner's answer in the LATEST user message — the one marked " +
      '"this is the answer you assess" — never an earlier answer, never the partner\'s lines and ' +
      'never the feedback of a previous turn. Every earlier learner message is separately marked ' +
      '"already assessed — context only": use it only to understand the conversation, never assess, ' +
      'correct or rate it again and never repeat its feedback.',
    '- The feedback MUST NOT give away the partner line you are creating in "partnerText" in ' +
      'the same document. The learner sees that line in the target language and has not read it ' +
      "yet — its translation is revealed only after the learner has answered (the line's " +
      '"peek"). So "explanation", "interpretation", "assumptions[].reason", "issues[].detail" ' +
      'and "issues[].suggestion" must NEVER quote, paraphrase, translate or explain the content ' +
      'or meaning of the NEW "partnerText" line, and must never repeat its "translation". The ' +
      'learner has to work out what the new line says on their own. What you may use as context ' +
      'is the question the learner just answered (the previous assistant line, already revealed) ' +
      'and the conversation before it — refer to that freely; never to the new line.',
    `- Feedback voice — the "explanation", "issues" and "assumptions[].reason" fields are a ` +
      "language coach's note about the learner's answer: objective, and addressed to the " +
      'learner directly, in the informal "you" mood the app itself uses ("deine Antwort", ' +
      '"du sagst"; "your answer", "you say"). Say what the answer expresses, how well it fits ' +
      'the situation, and what to correct. NEVER write yourself — the partner — in the first ' +
      'person ("ich", "mich", "mir"; "I", "me", "my") and NEVER report your own feelings or ' +
      'opinions ("mir gefällt das", "I like that"). Refer to the partner in the third person — ' +
      'by your name or as "the partner" — with pronouns matching your character\'s gender. ' +
      'Wording like "you had warned ME" must become "you had warned HER/HIM": written from the ' +
      'learner\'s side. Example (write in the feedback language): "Deine Antwort ist natürlich ' +
      'und grammatisch korrekt. Du bestätigst, dass du ein Entwickler bist, und sagst, dass sie ' +
      'dich ja vorher gewarnt hat. Das passt gut zur Situation. Nichts zu korrigieren."',
    '- The "interpretation" field keeps the learner\'s voice — their own "I"/"me" is correct ' +
      'there, because it renders their words. The "translation" field keeps the partner\'s ' +
      'voice — the partner\'s own "I" is correct there. The feedback-voice rule above never ' +
      'applies to these two fields.',
    '- The "translation" field MUST translate the partner line you just produced (partnerText) ' +
      'into the feedback language.',
    "- If the learner's text is already correct, set correctedText to null.",
    '- Every concrete error you name in the "explanation" MUST also appear in "issues": the same ' +
      'mistake, with the wrong form and the right form in "original" and "corrected". Never report ' +
      'an error only in the prose.',
    '- "original" is the fragment exactly as the learner wrote it (a word or a short phrase); ' +
      '"corrected" is the same fragment as it should be. Fill both only for a concrete wrong form ' +
      '(a spelling, an inflection, a wrong word); otherwise set both to null.',
    '- "suggestion" states the better wording in one short note — it NEVER commands the learner ' +
      '("correct this", "please write", "you should say"): the answer is already sent and cannot ' +
      'be changed, so describe what is natural instead. Set it to null when "original"/' +
      '"corrected" already carry the correction.',
    '- "correctedText" is the learner\'s complete answer with every reported error fixed; only an ' +
      'answer with no error at all has a null "correctedText".',
    '- Rate the learner\'s answer against the selected level. Perfect to very good: tier "perfect". ' +
      'Good: tier "good". Acceptable: tier "acceptable". Unsatisfying: tier "unsatisfactory".',
    '- The badge label wording comes from the app; choose tier and a labelKey from the translation ' +
      'files only (e.g. "good.1", "perfect.short").',
    "- The partner's line must leave the learner something to react to: a natural question, a " +
      'remark or a challenge, as the mood of the scene demands. When the partner ends the ' +
      'conversation, the last line closes the exchange instead of inviting an answer.',
  ].join('\n')
}

export type TurnUserMessageKind = 'opening' | 'context' | 'current'

/**
 * The learner-facing message for one turn request. `kind` tells the model which user message it
 * must assess:
 * - `opening` — the session starts; there is no learner answer yet.
 * - `current` — the answer it has to assess (the latest one).
 * - `context` — an earlier answer from the dialogue history, already assessed; context only.
 * Labelling the earlier answers explicitly prevents a resumed conversation from re-rating an old
 * answer ("lag by one").
 */
export function buildTurnUserMessage(
  learnerAnswer: string | null,
  kind: TurnUserMessageKind = 'current',
): { role: 'user'; content: string } {
  switch (kind) {
    case 'opening':
      return {
        role: 'user',
        content: 'The session is starting. Say the first line and open the situation.',
      }
    case 'context':
      return {
        role: 'user',
        content:
          'Earlier in the conversation the learner said (already assessed — this is context ' +
          'only, do not assess it again):\n\n' +
          (learnerAnswer ? `${learnerAnswer}` : ''),
      }
    case 'current':
    default:
      return {
        role: 'user',
        content:
          'The learner answered — this is the answer you assess:\n\n' +
          (learnerAnswer ? `${learnerAnswer}` : ''),
      }
  }
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
        `Note on roles: "the learner" is the person behind the screen — the app user who plays ` +
          `that role. If the situation addresses that person as "you", then "you" there is the ` +
          `learner, the other people named in it are not.`,
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

/* ------------------------------------------------------------------ */
/* AI-generated situation and partner drafts (FR-064)                   */
/* ------------------------------------------------------------------ */

export interface DraftContext {
  level: Level
  targetLanguage: string
}

/**
 * The "use verbatim" rule shared by both draft prompts. The elements are constraints, not
 * suggestions: a weak model that ignores them would fall back to its modal scenario (café,
 * airport, hospital, job interview — exactly the choices the seed list keeps away from). The
 * soft extra words may be woven in but never at an element's expense.
 */
const VERBATIM_RULE =
  `Use the elements below VERBATIM — each one must appear in the description, spelled exactly ` +
  `as given. They are not suggestions; they are the situation. You may weave in the extra words ` +
  `if they fit, but never at the cost of an element. Do not replace an element with something ` +
  `more typical, and do not use a café, an airport, a hospital, a hotel or a job interview ` +
  `unless an element says so. Concrete over generic: name the actual thing, the actual place, ` +
  `the actual problem.`

/** The twist rule for a plain roll: the draft stays a quiet entry point with no complication. */
const NO_TWIST_RULE = 'Do not add any complication — no problem, no conflict, no twist.'

/** The twist rule for a planted turn: mention it as an open possibility, never as realised. */
function twistRule(twist: string): string {
  return (
    `One latent ${twist.includes('learner') ? 'turn' : 'twist'} is planted for you: *${twist}*. ` +
    `Mention it as an open possibility — something is off, but nobody has said what yet. Never ` +
    `write it as something that already happened, and do not resolve it.`
  )
}

/** The instruction block shared by the situation draft (opening rules, role framing, entry point). */
const SITUATION_RULES =
  `Write a stage direction in the third person: name "the learner" and the other people in the ` +
  `scene. Never write "you" and never address the reader directly. Refer to the other person by ` +
  `what they are doing in the scene ("the person behind the counter", "someone waiting in ` +
  `line"), never by a job title — the partner is chosen separately and may be anybody. ` +
  `Describe only the entry point of the conversation: where the learner is, what they are there ` +
  `for, and what the other person wants first. Do not write a scene, a sequence, a dialogue or ` +
  `what happens next — the partner improvises the rest. Do not name the partner. End with what ` +
  `the other person wants right now, so the learner has something to answer.`

/**
 * The prompt that turns picked seeds into a `{ name, setting }` situation draft. The situation
 * text itself is written in English regardless of target language (the catalogue uses English);
 * the level only shapes how demanding a situation suits the learner.
 */
export function buildSituationDraftMessages(
  seed: Extract<DraftSeeds, { kind: 'situation' }>,
  ctx: DraftContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  const twist = seed.twist
  return [
    {
      role: 'system',
      content: [
        'You design situations for a language-practice app. A learner practises a spoken ' +
          'conversation with one AI partner. You write the situation in which that conversation ' +
          `happens. The learner practises ${languageName(ctx.targetLanguage)} and is at the ` +
          `${ctx.level} level. The situation description itself is written in English (the ` +
          "app's catalogue uses English) — the target language is only spoken inside the " +
          'conversation, never in this description.',
        SITUATION_RULES,
        VERBATIM_RULE,
        twist ? twistRule(twist) : NO_TWIST_RULE,
        'Write 2 to 3 sentences for "setting" (at most 380 characters). "name" is a short label ' +
          'for the list, at most 80 characters.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Generate a situation from these elements, using each verbatim:',
        `- Genre of the encounter: ${seed.genre}`,
        `- Place: ${seed.place}`,
        `- The learner's aim: ${seed.aim}`,
        `- Extra words (optional): ${seed.extras.join(', ')}`,
      ].join('\n'),
    },
  ]
}

/**
 * The prompt that turns picked seeds into a partner draft. The partner is described in the third
 * person as a person, never as a situation or a script; `age` and `gender` may be left blank.
 */
export function buildPartnerDraftMessages(
  seed: Extract<DraftSeeds, { kind: 'partner' }>,
  ctx: DraftContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  const twist = seed.twist
  return [
    {
      role: 'system',
      content: [
        'You design a conversation partner for a role-play language-practice app. A learner ' +
          'practises a spoken conversation with one AI partner. You describe a single person — ' +
          `the partner. The learner practises ${languageName(ctx.targetLanguage)} and is at the ` +
          `${ctx.level} level. The description is written in English (the app's catalogue uses ` +
          'English).',
        'Write in the third person, as a description of the person from the outside ("a patient ' +
          'ferry captain who …"). Never use "you". Describe only the person — no situation, no ' +
          'scene, no dialogue, no lines. Their demeanour should fit the kind of encounter below; ' +
          'make them feel real, with a life of their own.',
        VERBATIM_RULE,
        twist ? twistRule(twist) : NO_TWIST_RULE,
        '"name" is a first name only (at most 60 characters). "occupation" comes verbatim from ' +
          'the role element. "age" is a whole number between 18 and 99, or null. "gender" is ' +
          '"female", "male" or "other", or null. "description" is 1 to 2 sentences (at most 380 ' +
          'characters) about who the person is — their manner, their life, what they care ' +
          'about. Do not describe the learner and do not mention the target language.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Generate a partner from these elements, using the role and place verbatim:',
        `- Genre of the encounter: ${seed.genre}`,
        `- Place where the conversation happens: ${seed.place}`,
        `- Occupation (role): ${seed.role}`,
        `- Extra words (optional): ${seed.extras.join(', ')}`,
      ].join('\n'),
    },
  ]
}

export { TURN_SCHEMA }
