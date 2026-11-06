import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/data/sessions'
import { getDB, STORE } from '@/data/db'
import { useSession } from '@/composables/useSession'
import { useServiceConfig, useSettings } from '@/composables/useSettings'

/**
 * The context of a conversation is frozen when it starts (FR-065): the learner and the feedback
 * language are stored with the session and travel with it. A later profile edit — a new name, a
 * new age, a new look — MUST NOT change a running conversation, not even after a reload (the
 * system prompt is rebuilt from the stored session then). The service configuration (model,
 * address, key) is the opposite: it stays live.
 */

const mockChatCompletion = vi.hoisted(() => vi.fn())
const mockRequestImage = vi.hoisted(() => vi.fn())

vi.mock('@/ai/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/ai/aiService')>()
  return {
    ...actual,
    chatCompletion: mockChatCompletion,
    requestImage: mockRequestImage,
  }
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

function answer(content: unknown) {
  return {
    content: JSON.stringify(content),
    finishReason: 'stop',
    refusal: null,
    unstreamed: false,
  }
}

/** The profile of "Dominik" — the person a conversation starts with. */
function dominik() {
  useSettings().update({
    name: 'Dominik',
    details: 'works as a developer',
    appearance: 'dark curly hair, a red rain jacket',
    voice: 'warm, quick laugh',
    age: 42,
    gender: 'male',
    nativeLanguage: 'de',
    interfaceLanguage: 'en',
  })
}

/** The same person, ten years younger and someone else entirely. */
function monika() {
  useSettings().update({
    name: 'Monika',
    details: 'studies philosophy',
    appearance: 'blonde ponytail, a summer dress',
    voice: 'high, laughing',
    age: 32,
    gender: 'female',
    nativeLanguage: 'fr',
    interfaceLanguage: 'de',
  })
}

async function seedSession(): Promise<string> {
  return useSession().start({
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
    options: { knowsLearner: true },
  })
}

/** The system prompt of the last request the mock received. */
function lastSystemPrompt(): string {
  const calls = mockChatCompletion.mock.calls
  const last = calls[calls.length - 1][0] as {
    messages: Array<{ role: string; content: string }>
  }
  return last.messages.find((m) => m.role === 'system')?.content ?? ''
}

describe('the context of a conversation is frozen (FR-065)', () => {
  beforeEach(() => {
    mockChatCompletion.mockReset()
    mockChatCompletion.mockResolvedValue(answer(TURN))
  })

  it('keeps the learner of the start after the profile changed and the session was reloaded', async () => {
    dominik()
    const id = await seedSession()

    // The profile changes while the conversation runs.
    monika()

    // A reload rebuilds the system prompt from the stored session.
    const resumed = useSession()
    await resumed.load(id)
    await resumed.sendAnswer('Buenos días')

    const prompt = lastSystemPrompt()
    // The learner is still Dominik — 42, a man, in a red rain jacket.
    expect(prompt).toContain('Their name is Dominik')
    expect(prompt).toContain('they appear to be a man')
    expect(prompt).toContain('somewhere in their forties')
    expect(prompt).toContain('dark curly hair, a red rain jacket')
    // … and definitely not Monika.
    expect(prompt).not.toContain('Monika')
    expect(prompt).not.toContain('philosophy')
    expect(prompt).not.toContain('summer dress')
  })

  it('freezes the feedback language with the conversation', async () => {
    dominik()
    const id = await seedSession()

    monika() // the native language changes from German to French

    const resumed = useSession()
    await resumed.load(id)
    await resumed.sendAnswer('Buenos días')

    const prompt = lastSystemPrompt()
    // German was frozen — not the new French, and not the interface language either.
    expect(prompt).toContain('MUST be written in: German')
    expect(prompt).not.toContain('MUST be written in: French')
    // The stored turn carries the frozen language, not the current one.
    expect(resumed.turns.value[resumed.turns.value.length - 1].feedbackLanguage).toBe('de')
  })

  it('keeps the live service configuration live', async () => {
    dominik()
    const id = await seedSession()

    // A different model — the service configuration is NOT frozen.
    useServiceConfig().update({ chatModel: 'another-model' })

    const resumed = useSession()
    await resumed.load(id)
    await resumed.sendAnswer('Buenos días')

    const calls = mockChatCompletion.mock.calls
    const last = calls[calls.length - 1][0] as { service: { chatModel: string } }
    expect(last.service.chatModel).toBe('another-model')
  })

  it('stores the context with the session', async () => {
    dominik()
    const id = await seedSession()

    const stored = await getSession(id)
    expect(stored?.learner).toEqual({
      name: 'Dominik',
      details: 'works as a developer',
      appearance: 'dark curly hair, a red rain jacket',
      voice: 'warm, quick laugh',
      age: 42,
      gender: 'male',
    })
    expect(stored?.feedbackLanguage).toBe('de')
  })

  it('freezes a session without a context once and never touches its activity time', async () => {
    dominik()
    const id = await seedSession()

    // A session from an older app version: no context in the record, and it is already over.
    const db = await getDB()
    const legacy = await db.get(STORE.sessions, id)
    if (!legacy) throw new Error('the session was not stored')
    delete legacy.learner
    delete legacy.feedbackLanguage
    legacy.state = 'ended'
    await db.put(STORE.sessions, legacy)
    const updatedAt = legacy.updatedAt

    // The profile changes before the conversation is opened again.
    monika()

    const resumed = useSession()
    await resumed.load(id)

    // The conversation takes the current profile as its context — once.
    const after = await getSession(id)
    expect(after?.learner?.name).toBe('Monika')
    expect(after?.feedbackLanguage).toBe('fr')
    // The backfill must not move the conversation to the top of the list.
    expect(after?.updatedAt).toBe(updatedAt)
  })
})

describe('the frozen context reaches the illustration', () => {
  beforeEach(() => {
    mockChatCompletion.mockReset()
    mockChatCompletion.mockResolvedValue(answer(TURN))
    mockRequestImage.mockReset()
    mockRequestImage.mockResolvedValue({
      ok: true,
      bytes: new Uint8Array([1]),
      mimeType: 'image/webp',
    })
  })

  it('describes the learner of the start, not the current profile', async () => {
    dominik()
    const id = await seedSession()
    useServiceConfig().update({ imageModel: 'mock-image', providerProfile: 'openai' })

    monika()

    const resumed = useSession()
    await resumed.load(id)
    mockChatCompletion.mockResolvedValue({
      content: JSON.stringify({ scene: 'A man in a red rain jacket.' }),
      finishReason: 'stop',
      refusal: null,
      unstreamed: false,
    })
    await resumed.generateIllustration()

    const calls = mockChatCompletion.mock.calls
    const scene = calls[calls.length - 1][0] as {
      messages: Array<{ role: string; content: string }>
    }
    const text = scene.messages.map((m) => m.content).join('\n')
    expect(text).toContain('Dominik')
    expect(text).toContain('dark curly hair')
    expect(text).not.toContain('Monika')
  })
})
