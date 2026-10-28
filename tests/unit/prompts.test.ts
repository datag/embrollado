import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  buildTurnUserMessage,
  buildExplanationMessages,
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

  it('builds a user message that opens the session', () => {
    const msg = buildTurnUserMessage(null)
    expect(msg.role).toBe('user')
    expect(msg.content).toContain('starting')
  })

  it('builds a generic prompt when the learner gives no name', () => {
    const prompt = buildSystemPrompt({ ...base, learnerName: null, learnerDetails: null })
    expect(prompt).toContain('has not shared personal details')
  })

  it("builds the explanation messages focused on the learner's answer", () => {
    const messages = buildExplanationMessages('system', {
      partnerLine: { text: '¿Dónde está el lavadero?', translation: 'Where is the washroom?' },
      learnerAnswer: 'Is the washroom near???',
      correctedText: 'Is the washroom nearby?',
      interpretation: 'You asked about the washroom.',
      issues: [],
    })
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'user'])
    // The context carries the learner's answer and the line it responded to —
    // never the partner's NEXT line.
    expect(messages[1].content).toContain('Is the washroom near???')
    expect(messages[1].content).toContain('Where is the washroom?')
    expect(messages[2].content).toContain("the LEARNER's answer")
    expect(messages[2].content).toContain('NEVER in the target language')
    expect(messages[2].content).not.toContain("partner's next line")
  })

  it('builds an illustration prompt without text', () => {
    const prompt = buildIllustrationPrompt(base.situation, 'at the start')
    expect(prompt).toContain('washroom')
    expect(prompt).toContain('no text')
  })
})
