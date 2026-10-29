import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  buildTurnUserMessage,
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
    expect(prompt).toContain('Translate ONLY the learner\'s own text')
    expect(prompt).toContain('never import the situation or the partner\'s lines')
    expect(prompt).toContain('never add framing like "The learner asks:"')
    // Gap markers survive the translation unchanged.
    expect(prompt).toContain('gap marker or unintelligible')
  })

  it('anchors the feedback to the latest learner answer, never earlier turns', () => {
    const prompt = buildSystemPrompt(base)
    expect(prompt).toContain('ONLY the learner\'s answer in the LATEST user message')
    expect(prompt).toContain('never the feedback of a previous turn')
    expect(prompt).toContain("never the partner's lines")
    // The explanation is part of that bundle: it clarifies the learner's own latest answer.
    expect(prompt).toContain('explain the learner\'s answer in the LATEST user message')
    expect(prompt).toContain('which may appear inside the explanation')
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

  it('builds an illustration prompt without text', () => {
    const prompt = buildIllustrationPrompt(base.situation, 'at the start')
    expect(prompt).toContain('washroom')
    expect(prompt).toContain('no text')
  })
})
