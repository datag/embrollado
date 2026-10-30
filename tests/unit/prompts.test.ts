import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  buildTurnUserMessage,
  buildSceneMessages,
  buildIllustrationPrompt,
} from '@/ai/prompts'
import type { Level } from '@/domain/types'

const base = {
  partner: {
    id: 'builtin:nicole',
    name: 'Nicole',
    age: 38,
    occupation: 'confectioner',
    custom: false,
    description: 'A warm, patient confectioner.',
  },
  situation: {
    id: 'builtin:campsite-washroom',
    name: 'At the campsite washroom',
    setting: 'You meet a fellow camper in front of the washroom building.',
    custom: false,
  },
  level: 'intermediate' as Level,
  targetLanguage: 'en',
  feedbackLanguage: 'de',
  knowsLearner: false,
  appearance: 'dark curly hair, a red rain jacket',
  voice: 'warm, quick laugh',
  age: 31,
  gender: 'female' as const,
  learnerName: null,
  learnerDetails: null,
}

describe('prompt builder (T045, T039, T112)', () => {
  it('includes role, situation, level, languages and the learner context', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('Nicole')
    expect(prompt).toContain('confectioner')
    expect(prompt).toContain('At the campsite washroom')
    expect(prompt).toContain('target language: en')
    expect(prompt).toContain('MUST be written in: de')
  })

  it('keeps the learner name and details out of the prompt by default (knowsLearner off)', () => {
    const prompt = buildSystemPrompt({ ...base, learnerName: 'Sam', learnerDetails: 'gothic' })
    // The option is off, so the stored name and details must never appear in the prompt —
    // regardless of what the profile holds. The partner has to learn them during the talk.
    expect(prompt).not.toContain('Sam')
    expect(prompt).not.toContain('gothic')
  })

  it('sends the perceivable traits and the first-meeting rules when the option is off', () => {
    const prompt = buildSystemPrompt(base)
    // Visible and audible blocks, split by channel.
    expect(prompt).toContain('they look somewhere in their thirties')
    expect(prompt).toContain('they appear to be a woman')
    expect(prompt).toContain('dark curly hair, a red rain jacket')
    expect(prompt).toContain('their voice sounds somewhere in their thirties')
    expect(prompt).toContain('their voice sounds female')
    expect(prompt).toContain('warm, quick laugh')
    // The first-meeting rules replace any profile knowledge.
    expect(prompt).toContain('You are meeting the learner for the first time')
    expect(prompt).toContain('Do not fill the gaps with invented facts')
    expect(prompt).toContain('no invented name')
    expect(prompt).toContain('there is no name yet')
    expect(prompt).not.toContain('already know the learner')
  })

  it('releases name and details when the per-session option is enabled', () => {
    const prompt = buildSystemPrompt({
      ...base,
      learnerName: 'Sam',
      learnerDetails: 'gothic',
      knowsLearner: true,
    })
    expect(prompt).toContain('Their name is Sam')
    expect(prompt).toContain('What you know about them: gothic')
    expect(prompt).toContain('You already know the learner from before this conversation')
    // The first-meeting rules are replaced, not duplicated.
    expect(prompt).not.toContain('There is no name yet')
    expect(prompt).not.toContain('no invented name')
  })

  it('gives the partner an option not to perceive what the situation does not allow', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('read the situation to decide what you can perceive')
    expect(prompt).toContain('in a phone call you only hear them')
  })

  it('resolves the ambiguous "you" in the situation text to the learner', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('"you" refers to the learner, not to you')
  })

  it('uses the level-specific rules', () => {
    const beginner = buildSystemPrompt({ ...base, level: 'beginner' })
    expect(beginner).toContain('beginner')
    const expert = buildSystemPrompt({ ...base, level: 'expert' })
    expect(expert).toContain('expert')
  })

  it('gives the gap-filling rules', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('???')
    expect(prompt).toContain('assumptions')
  })

  it('requires the interpretation as a translation of the learner answer into the feedback language', () => {
    const prompt = buildSystemPrompt(base)
    // It renders the learner's words in the feedback language — a translation, not a retelling.
    expect(prompt).toContain('rendered in the feedback language')
    expect(prompt).toContain('as one would interpret them')
    // Only the learner's own text is translated; no intentions, no partner lines, no framing.
    expect(prompt).toContain("Translate ONLY the learner's own text")
    expect(prompt).toContain("never import the situation or the partner's lines")
    expect(prompt).toContain('never add framing like "The learner asks:"')
    // Gap markers survive the translation unchanged.
    expect(prompt).toContain('gap marker or unintelligible')
  })

  it('anchors the feedback to the latest learner answer, never earlier turns', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain("ONLY the learner's answer in the LATEST user message")
    expect(prompt).toContain('never the feedback of a previous turn')
    expect(prompt).toContain("never the partner's lines")
    // The explanation is part of that bundle: it clarifies the learner's own latest answer.
    expect(prompt).toContain("explain the learner's answer in the LATEST user message")
    expect(prompt).toContain('which may appear inside the explanation')
  })

  it('gives the partner a human personality with dignity and boundaries, not servility', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('feelings, dignity and boundaries')
    expect(prompt).toContain('not a servile assistant')
    expect(prompt).toContain('push back')
    expect(prompt).toContain('Remember how the learner has treated you')
    expect(prompt).toContain('You do not instantly forgive or forget')
    expect(prompt).toContain('Never grovel, flatter or apologise for yourself')
  })

  it('lets the partner react proportionately and threaten or end the conversation', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('React authentically and proportionately')
    expect(prompt).toContain('threaten to end the conversation')
    expect(prompt).toContain('actually end it')
    // The line must leave something to react to — but a closing line may end the exchange.
    expect(prompt).toContain('leave the learner something to react to')
    expect(prompt).toContain('closes the exchange instead of inviting an answer')
  })

  it('builds a user message that opens the session', () => {
    const msg = buildTurnUserMessage(null)
    expect(msg.role).toBe('user')
    expect(msg.content).toContain('starting')
  })

  it('keeps the learner context minimal when nothing is perceivable or revealed', () => {
    const prompt = buildSystemPrompt({
      ...base,
      appearance: null,
      voice: null,
      age: null,
      gender: null,
    })
    expect(prompt).not.toContain('Visible (only if')
    expect(prompt).not.toContain('Audible (only if')
    expect(prompt).toContain('Rules about what you know')
    expect(prompt).toContain('there is no name yet')
  })

  it('narrates the scene from the situation, the people and the whole dialogue in one request', () => {
    const messages = buildSceneMessages({
      partner: { ...base.partner, gender: 'female' },
      situation: base.situation,
      learnerName: 'Sam',
      learnerDetails: '27, gothic music fan',
      appearance: 'dark curly hair',
      age: 31,
      gender: 'female',
      dialogue: [
        { partnerText: 'Where do you have to pay for the shower?', learnerText: null },
        { partnerText: 'All out. But here, take mine.', learnerText: 'Thanks a lot!' },
      ],
    })
    expect(messages).toHaveLength(2)
    const system = messages[0].content
    const user = messages[1].content
    // Situation first, then what was said — and the people, incl. the learner's settings.
    // The picture keeps the full learner context (name, details and perceivable traits).
    expect(user).toContain('Situation:')
    expect(user).toContain('At the campsite washroom')
    expect(user).toContain('Nicole')
    expect(user).toContain('a woman')
    expect(user).toContain('Sam')
    expect(user).toContain('somewhere in their thirties')
    expect(user).toContain('dark curly hair')
    expect(user).toContain('27, gothic music fan')
    // The complete correspondence is part of the request.
    expect(user).toContain('Where do you have to pay for the shower?')
    expect(user).toContain('take mine')
    expect(user).toContain('Thanks a lot!')
    // The current moment is the frame, the narration stays visible-only and English-only.
    expect(system).toContain('CURRENT moment')
    expect(system).toContain('no speech bubbles')
    expect(system).toContain('no dialogue text')
    expect(system).toContain('at most 60 words')
    expect(system).toContain('English')
    // When the two cannot see each other, the director may render both sides as one split scene.
    expect(system).toContain('split scene')
    // The dialogue-only context never leaks stored feedback into the picture prompt.
    expect(user).not.toContain('badge')
    expect(user).not.toContain('correctedText')
    expect(user).not.toContain('interpretation')
  })

  it('omits gender wording for snapshots without one and handles an empty transcript', () => {
    const messages = buildSceneMessages({
      partner: { ...base.partner, gender: null },
      situation: base.situation,
      learnerName: null,
      learnerDetails: null,
      appearance: null,
      age: null,
      gender: null,
      dialogue: [],
    })
    const user = messages[1].content
    expect(user).not.toContain('a woman')
    expect(user).not.toContain('a man')
    expect(user).toContain('has not shared personal details')
    expect(user).toContain('meeting for the first time')
  })

  it('builds the image prompt from the finished scene only', () => {
    const prompt = buildIllustrationPrompt(
      'A man in his late twenties hands a coin to a woman in front of a washroom.',
    )
    expect(prompt).toContain('hands a coin')
    expect(prompt).toContain('no text')
  })
})
