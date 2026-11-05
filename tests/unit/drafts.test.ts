import { describe, expect, it } from 'vitest'
import { generatePartnerDraft, generateSituationDraft } from '@/ai/aiService'
import type { ServiceConfig } from '@/domain/types'
import { AiError } from '@/domain/types'
import type { SituationSeeds, PartnerSeeds } from '@/domain/seeds'

/**
 * Validation of the AI-generated situation/partner drafts (FR-064). The adapter must only ever
 * return a draft that fits the form's limits and shapes; a malformed, empty or non-JSON answer
 * must be rejected with an error — never returned — so the form's fields are never overwritten
 * with garbage.
 */

const SERVICE: ServiceConfig = {
  baseUrl: 'http://localhost:8787/v1',
  apiKey: 'test',
  authMode: 'bearer',
  chatModel: 'mock-chat',
  speechModel: null,
  speechVoice: null,
  imageModel: null,
  providerProfile: 'openai',
}

const CTX = { level: 'intermediate' as const, targetLanguage: 'es' }

const SITUATION_SEED: SituationSeeds = {
  kind: 'situation',
  genre: 'a small conflict',
  place: 'a laundromat in Vienna',
  aim: 'to exchange a parcel that was sent to the wrong street',
  twist: null,
  extras: ['Lisbon', 'apricot jam'],
}

const PARTNER_SEED: PartnerSeeds = {
  kind: 'partner',
  genre: 'a first meeting',
  place: 'a ferry terminal ticket window',
  role: 'a ferry captain',
  twist: null,
  extras: ['Marisol', 'a wool blanket'],
}

/** An OpenAI-compatible non-streamed completion whose message content is `payload`. */
function completion(payload: unknown): Response {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function stubFetch(handler: () => Response | Promise<Response>) {
  const original = globalThis.fetch
  globalThis.fetch = (async () => handler()) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

describe('situation draft validation (T134 / FR-064)', () => {
  it('validates and truncates a well-formed situation draft', async () => {
    const restore = stubFetch(() =>
      completion({ name: 'At the harbour loft', setting: 'The learner needs a signed receipt.' }),
    )
    try {
      const draft = await generateSituationDraft(SERVICE, SITUATION_SEED, CTX)
      expect(draft.name).toBe('At the harbour loft')
      expect(draft.setting).toBe('The learner needs a signed receipt.')
    } finally {
      restore()
    }
  })

  it('rejects a non-JSON answer', async () => {
    const restore = stubFetch(() => completion('not json at all'))
    try {
      await expect(generateSituationDraft(SERVICE, SITUATION_SEED, CTX)).rejects.toThrow(AiError)
    } finally {
      restore()
    }
  })

  it('rejects a draft with missing or empty fields', async () => {
    for (const bad of [{ name: '' }, { setting: '' }, { name: '', setting: '' }]) {
      const restore = stubFetch(() => completion(bad))
      try {
        await expect(generateSituationDraft(SERVICE, SITUATION_SEED, CTX)).rejects.toThrow(AiError)
      } finally {
        restore()
      }
    }
  })

  it('propagates a refusal', async () => {
    const restore = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            choices: [{ index: 0, message: { refusal: 'declined' }, finish_reason: 'stop' }],
          }),
          { status: 200 },
        ),
    )
    try {
      await expect(generateSituationDraft(SERVICE, SITUATION_SEED, CTX)).rejects.toThrow(AiError)
    } finally {
      restore()
    }
  })
})

describe('partner draft validation (T134 / FR-064)', () => {
  it('normalises age, gender and truncates a well-formed partner draft', async () => {
    const long = 'x'.repeat(90)
    const restore = stubFetch(() =>
      completion({
        name: long, // longer than the 60-char limit
        age: 46.7,
        gender: 'xeno', // unknown → falls back to "other"
        occupation: long,
        description: long,
      }),
    )
    try {
      const draft = await generatePartnerDraft(SERVICE, PARTNER_SEED, CTX)
      expect(draft.name).toHaveLength(60)
      expect(draft.age).toBe(47) // rounded
      expect(draft.gender).toBe('other') // unknown string → usable "other"
      // Truncated to the form limits (60 / 60 / 400).
      expect(draft.occupation).toHaveLength(60)
      expect(draft.description).toHaveLength(90) // shorter than the 400 limit stays as-is
    } finally {
      restore()
    }
  })

  it('turns an out-of-range age and a missing gender into null', async () => {
    const restore = stubFetch(() =>
      completion({
        name: 'Idris',
        age: 250,
        gender: null,
        occupation: 'a nurse',
        description: 'Calm.',
      }),
    )
    try {
      const draft = await generatePartnerDraft(SERVICE, PARTNER_SEED, CTX)
      expect(draft.age).toBeNull()
      expect(draft.gender).toBeNull()
    } finally {
      restore()
    }
  })

  it('rejects a partner draft missing free-text fields', async () => {
    const restore = stubFetch(() =>
      completion({ name: 'Idris', age: null, gender: null, occupation: '', description: '' }),
    )
    try {
      await expect(generatePartnerDraft(SERVICE, PARTNER_SEED, CTX)).rejects.toThrow(AiError)
    } finally {
      restore()
    }
  })
})
