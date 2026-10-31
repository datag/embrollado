import { describe, expect, it } from 'vitest'
import { sessionActivityAt, sortSessionsByActivity } from '@/data/sessions'
import type { Session } from '@/domain/types'

/**
 * The conversation list is ordered by the last activity, newest first: the conversation the
 * learner touched last comes first. The activity is the newest of the last turn, the last update
 * (rename, end) and the creation.
 */
function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    title: 'Conversation',
    language: 'es',
    level: 'intermediate',
    situation: { id: 'builtin:bakery-queue', name: 'Bakery', setting: 'Queue', custom: false },
    partner: {
      id: 'builtin:nicole',
      name: 'Nicole',
      age: 38,
      occupation: 'confectioner',
      custom: false,
      description: 'A confectioner.',
    },
    options: { knowsLearner: false },
    state: 'active',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    turnCount: 0,
    lastTurnAt: null,
    ...overrides,
  }
}

describe('session list order (FR-015, FR-016)', () => {
  it('takes the newest of the last turn, the last update and the creation', () => {
    const s = makeSession({
      id: 'a',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
      lastTurnAt: '2026-10-03T10:00:00.000Z',
    })
    expect(sessionActivityAt(s)).toBe('2026-10-03T10:00:00.000Z')
  })

  it('falls back to the creation date for a session without any activity', () => {
    const s = makeSession({
      id: 'a',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      lastTurnAt: null,
    })
    expect(sessionActivityAt(s)).toBe('2026-10-01T10:00:00.000Z')
  })

  it('sorts by the last activity, newest first', () => {
    const older = makeSession({
      id: 'older',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      lastTurnAt: '2026-10-02T10:00:00.000Z',
    })
    const newer = makeSession({
      id: 'newer',
      createdAt: '2026-10-05T10:00:00.000Z',
      updatedAt: '2026-10-05T10:00:00.000Z',
      lastTurnAt: '2026-10-06T10:00:00.000Z',
    })
    const untouched = makeSession({
      id: 'untouched',
      createdAt: '2026-10-04T10:00:00.000Z',
      updatedAt: '2026-10-04T10:00:00.000Z',
      lastTurnAt: null,
    })

    const sorted = sortSessionsByActivity([older, untouched, newer])
    // newer (10-06) → untouched (created 10-04, no turns) → older (last turn 10-02)
    expect(sorted.map((s) => s.id)).toEqual(['newer', 'untouched', 'older'])
  })

  it('does not change the order of sessions with the same activity', () => {
    const a = makeSession({ id: 'a', createdAt: '2026-10-01T10:00:00.000Z' })
    const b = makeSession({ id: 'b', createdAt: '2026-10-01T10:00:00.000Z' })
    expect(sortSessionsByActivity([a, b]).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the given list', () => {
    const list = [
      makeSession({ id: 'a', createdAt: '2026-10-01T10:00:00.000Z' }),
      makeSession({ id: 'b', createdAt: '2026-10-05T10:00:00.000Z' }),
    ]
    sortSessionsByActivity(list)
    expect(list.map((s) => s.id)).toEqual(['a', 'b'])
  })
})
