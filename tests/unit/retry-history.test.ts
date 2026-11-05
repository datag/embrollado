import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession } from '@/data/sessions'
import { useSession } from '@/composables/useSession'

/**
 * A failed turn must leave nothing behind — neither in the transcript nor in the model-side
 * history (T129). The history is what the service sees: a failed attempt that stayed in it
 * would send the learner's answer a second time, and the persona and the assessment would
 * react to a repetition that never happened ("Du wiederholst aber exakt deinen vorherigen
 * Satz").
 */

const mockChatCompletion = vi.hoisted(() => vi.fn())
/** Lets a test make the next turn write fail (a storage error after a valid model answer). */
const storage = vi.hoisted(() => ({ failNextSave: false }))

vi.mock('@/ai/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/ai/aiService')>()
  return { ...actual, chatCompletion: mockChatCompletion }
})

vi.mock('@/data/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/sessions')>()
  return {
    ...actual,
    saveTurn: async (turn: Parameters<typeof actual.saveTurn>[0]) => {
      if (storage.failNextSave) {
        storage.failNextSave = false
        throw new Error('QuotaExceededError')
      }
      return actual.saveTurn(turn)
    },
  }
})

const TURN = {
  partnerText: '¿Dónde estás?',
  translation: 'Wo bist du?',
  explanation: 'Klar verständlich.',
  correctedText: null,
  interpretation: 'Hallo.',
  assumptions: [],
  badge: { tier: 'good', labelKey: 'good.1' },
  issues: [],
}

const LEARNER_TEXT = 'Wo ist der Waschraum?'

/** A completed answer from the service. */
function answer(content: unknown) {
  return {
    content: JSON.stringify(content),
    finishReason: 'stop',
    refusal: null,
    unstreamed: false,
  }
}

/** The messages of a request payload that carry the learner's answer. */
function learnerMessages(payload: {
  messages: Array<{ role: string; content: string }>
}): Array<{ role: string; content: string }> {
  return payload.messages.filter((m) => m.content.includes(LEARNER_TEXT))
}

async function seedSession(): Promise<string> {
  const session = await createSession({
    language: 'es',
    level: 'intermediate',
    situation: {
      id: 'builtin:bakery-queue',
      name: 'In the bakery queue',
      setting: 'You are queuing at a bakery.',
      custom: false,
    },
    partner: {
      id: 'builtin:nicole',
      name: 'Nicole',
      age: 38,
      occupation: 'confectioner',
      custom: false,
      description: 'A confectioner.',
    },
    options: { knowsLearner: false },
  })
  return session.id
}

/** Open a session whose opening line was accepted. */
async function openSession(): Promise<{ id: string; st: ReturnType<typeof useSession> }> {
  const id = await seedSession()
  const st = useSession()
  mockChatCompletion.mockResolvedValueOnce(answer(TURN))
  await st.load(id)
  expect(st.phase.value).toBe('waiting-answer')
  return { id, st }
}

describe('a failed turn leaves the model history clean', () => {
  beforeEach(() => {
    mockChatCompletion.mockReset()
    storage.failNextSave = false
  })

  it('does not keep a rejected answer in the history — the retry sends it once', async () => {
    const { st } = await openSession()

    // The service answers, but without a usable partnerText → "unexpected format" (FR-025).
    mockChatCompletion.mockResolvedValueOnce(answer({ translation: 'irgendwas' }))
    await st.sendAnswer(LEARNER_TEXT)
    expect(st.phase.value).toBe('failed')
    // The failed turn is not part of the conversation.
    expect(st.turns.value).toHaveLength(1)

    let payload: { messages: Array<{ role: string; content: string }> } | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      payload = opts
      return answer(TURN)
    })
    await st.retry()
    expect(st.phase.value).toBe('waiting-answer')
    expect(st.turns.value).toHaveLength(2)

    // The answer is sent exactly once — the failed attempt left nothing behind.
    expect(learnerMessages(payload!)).toHaveLength(1)
  })

  it('does not keep an answer whose turn could not be stored — the retry sends it once', async () => {
    const { st } = await openSession()

    // The model answers, but the write fails (quota/private mode).
    mockChatCompletion.mockResolvedValueOnce(answer(TURN))
    storage.failNextSave = true
    await st.sendAnswer(LEARNER_TEXT)
    expect(st.phase.value).toBe('failed')
    expect(st.turns.value).toHaveLength(1)

    let payload: { messages: Array<{ role: string; content: string }> } | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      payload = opts
      return answer(TURN)
    })
    await st.retry()
    expect(st.phase.value).toBe('waiting-answer')
    expect(st.turns.value).toHaveLength(2)

    expect(learnerMessages(payload!)).toHaveLength(1)
  })

  it('does not keep an answer whose request failed outright — the retry sends it once', async () => {
    const { st } = await openSession()

    mockChatCompletion.mockRejectedValueOnce({ kind: 'network', message: 'offline' })
    await st.sendAnswer(LEARNER_TEXT)
    expect(st.phase.value).toBe('failed')

    let payload: { messages: Array<{ role: string; content: string }> } | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      payload = opts
      return answer(TURN)
    })
    await st.retry()
    expect(st.phase.value).toBe('waiting-answer')

    expect(learnerMessages(payload!)).toHaveLength(1)
  })

  it('sends a stored answer exactly once in the next request', async () => {
    const { st } = await openSession()

    mockChatCompletion.mockResolvedValueOnce(answer(TURN))
    await st.sendAnswer(LEARNER_TEXT)
    expect(st.turns.value).toHaveLength(2)

    let payload: { messages: Array<{ role: string; content: string }> } | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      payload = opts
      return answer(TURN)
    })
    await st.sendAnswer('Und der Ausgang?')
    expect(st.phase.value).toBe('waiting-answer')

    expect(learnerMessages(payload!)).toHaveLength(1)
  })
})
