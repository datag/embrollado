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
  learnerName: 'Sam',
  learnerDetails: null,
}

describe('prompt builder (T045, T039)', () => {
  it('includes role, situation, level, languages and learner', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('Nicole')
    expect(prompt).toContain('confectioner')
    expect(prompt).toContain('At the campsite washroom')
    expect(prompt).toContain('target language: en')
    expect(prompt).toContain('MUST be written in: de')
    expect(prompt).toContain('Sam')
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

  it('builds a generic prompt when the learner gives no name', () => {
    const prompt = buildSystemPrompt({ ...base, learnerName: null, learnerDetails: null })
    expect(prompt).toContain('has not shared personal details')
  })

  it('narrates the scene from the situation, the people and the whole dialogue in one request', () => {
    const messages = buildSceneMessages({
      partner: { ...base.partner, gender: 'female' },
      situation: base.situation,
      learnerName: 'Sam',
      learnerDetails: '27, gothic music fan',
      dialogue: [
        { partnerText: 'Where do you have to pay for the shower?', learnerText: null },
        { partnerText: 'All out. But here, take mine.', learnerText: 'Thanks a lot!' },
      ],
    })
    expect(messages).toHaveLength(2)
    const system = messages[0].content
    const user = messages[1].content
    // Situation first, then what was said — and the people, incl. the learner's settings.
    expect(user).toContain('Situation:')
    expect(user).toContain('At the campsite washroom')
    expect(user).toContain('Nicole')
    expect(user).toContain('a woman')
    expect(user).toContain('Sam')
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
