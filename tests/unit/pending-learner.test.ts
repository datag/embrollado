import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession } from '@/data/sessions'
import { useSession } from '@/composables/useSession'

/**
 * The learner's answer is rendered the moment they send it — the app already holds the exact text
 * ("1:1"), so it must not wait for the AI request to complete (TODO: "User-Message sofort
 * rendern"). The composable exposes the pending learner text synchronously when the request
 * starts; this test drives the real composable with a mocked chat completion to prove both the
 * immediate exposure and the cleanup after success.
 */

/* The mock is created in vi.hoisted so the vi.mock factory (hoisted above the const) can see it. */
const mockChatCompletion = vi.hoisted(() => vi.fn())

vi.mock('@/ai/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/ai/aiService')>()
  return { ...actual, chatCompletion: mockChatCompletion }
})

const TURN = {
  partnerText: '¿Dónde estás?',
  translation: 'Wo bist du?',
  explanation: 'Klar verständlich.',
  correctedText: null,
  interpretation: 'Hallo, ich suche den Waschraum.',
  assumptions: [],
  badge: { tier: 'good', labelKey: 'good.1' },
  issues: [],
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

describe('pending learner message (immediate render)', () => {
  beforeEach(() => {
    mockChatCompletion.mockReset()
    mockChatCompletion.mockResolvedValue({
      content: JSON.stringify(TURN),
      finishReason: 'stop',
      refusal: null,
      unstreamed: false,
    })
  })

  it('exposes the typed answer synchronously, before the AI request resolves', async () => {
    const id = await seedSession()
    const st = useSession()
    await st.load(id) // opens the session with the opening turn (mocked completion)
    expect(st.turns.value).toHaveLength(1)
    expect(st.phase.value).toBe('waiting-answer')

    // Call sendAnswer and do NOT await it first — while the (unresolved) request is pending, the
    // learner's text must already be available for the view to render "1:1".
    const sendPromise = st.sendAnswer('Hello there, are you open?')
    expect(st.pendingLearnerText.value).toBe('Hello there, are you open?')

    await sendPromise
    expect(st.pendingLearnerText.value).toBeNull()
    expect(st.turns.value).toHaveLength(2)
    expect(st.turns.value[1].learnerText).toBe('Hello there, are you open?')
  })

  it('keeps the pending text on failure so the sent message stays on screen', async () => {
    const id = await seedSession()
    const st = useSession()
    await st.load(id)

    mockChatCompletion.mockRejectedValueOnce({ kind: 'network', message: 'offline' })
    await st.sendAnswer('Hello?')
    expect(st.phase.value).toBe('failed')
    // The learner's message must remain visible even though the request failed.
    expect(st.pendingLearnerText.value).toBe('Hello?')
  })
})