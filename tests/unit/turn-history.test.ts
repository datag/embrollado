import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession } from '@/data/sessions'
import { useSession } from '@/composables/useSession'

/**
 * Only ONE learner message may be marked as "the answer you assess" — the one that was sent
 * last. Every earlier answer is "already assessed — context only". The system prompt demands
 * exactly that ("assess ONLY the learner's answer in the LATEST user message"), and the resumed
 * session already labels its stored answers that way — the live session must not differ.
 */

const mockChatCompletion = vi.hoisted(() => vi.fn())

vi.mock('@/ai/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/ai/aiService')>()
  return { ...actual, chatCompletion: mockChatCompletion }
})

const TURN = {
  partnerText: 'Hello! Nice to meet you.',
  translation: 'Hallo!',
  explanation: 'Klar verständlich.',
  correctedText: null,
  interpretation: 'Hallo.',
  assumptions: [],
  badge: { tier: 'good', labelKey: 'good.1' },
  issues: [],
}

/** The mark of the message the model has to assess. */
const CURRENT = 'The learner answered — this is the answer you assess:'
/** The mark of an answer that was assessed already. */
const CONTEXT = 'already assessed — this is context only'

interface Captured {
  messages: Array<{ role: string; content: string }>
}

function answer(content: unknown) {
  return {
    content: JSON.stringify(content),
    finishReason: 'stop',
    refusal: null,
    unstreamed: false,
  }
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

describe('the assessment target in the model history', () => {
  beforeEach(() => {
    mockChatCompletion.mockReset()
  })

  it('marks only the pending answer as the one to assess', async () => {
    const { st } = await openSession()

    mockChatCompletion.mockResolvedValueOnce(answer(TURN))
    await st.sendAnswer('ERSTE ANTWORT')
    expect(st.turns.value).toHaveLength(2)

    let payload: Captured | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      payload = opts
      return answer(TURN)
    })
    await st.sendAnswer('ZWEITE ANTWORT')
    expect(st.phase.value).toBe('waiting-answer')

    const messages = payload!.messages
    const current = messages.filter((m) => m.content.startsWith(CURRENT))
    const context = messages.filter((m) => m.content.includes(CONTEXT))
    // Exactly one answer is up for assessment — the one that was sent last.
    expect(current).toHaveLength(1)
    expect(current[0].content).toContain('ZWEITE ANTWORT')
    // The answer before it is context only.
    expect(context).toHaveLength(1)
    expect(context[0].content).toContain('ERSTE ANTWORT')
  })

  it('builds the same history as a resumed session', async () => {
    const { id, st } = await openSession()

    mockChatCompletion.mockResolvedValueOnce(answer(TURN))
    await st.sendAnswer('ERSTE ANTWORT')
    mockChatCompletion.mockResolvedValueOnce(answer(TURN))
    await st.sendAnswer('ZWEITE ANTWORT')

    // A resumed session rebuilds its history from the stored turns.
    const resumed = useSession()
    await resumed.load(id)

    // The live session sends the next answer with its own history …
    let live: Captured | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      live = opts
      return answer(TURN)
    })
    await st.sendAnswer('DRITTE ANTWORT')

    // … and the resumed session sends the same answer with the history it rebuilt.
    let reloaded: Captured | null = null
    mockChatCompletion.mockImplementationOnce(async (opts: { messages: never }) => {
      reloaded = opts
      return answer(TURN)
    })
    await resumed.sendAnswer('DRITTE ANTWORT')

    // Both histories are the same — without the pending answer, which is the last message.
    expect(live!.messages.slice(0, -1)).toEqual(reloaded!.messages.slice(0, -1))
  })
})
