import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ONE_SHOTS_KEY, readOneShots, writeOneShots } from '@/data/oneShots'
import type { Persona, Situation } from '@/domain/types'

function persona(id: string): Persona {
  return {
    id,
    name: `Person ${id}`,
    age: null,
    gender: null,
    occupation: 'occupation',
    description: 'description',
    origin: 'learner',
    visibility: 'session-only',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function situation(id: string): Situation {
  return {
    id,
    name: `Situation ${id}`,
    setting: 'setting',
    keyMoments: [],
    suggestedPartners: [],
    origin: 'learner',
    visibility: 'session-only',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('one-off (session-only) entries in sessionStorage (FR-046)', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips entries and the in-progress selection', () => {
    writeOneShots({
      personas: [persona('p1')],
      situations: [situation('s1')],
      selectedSituationId: 's1',
      selectedPartnerId: 'p1',
    })
    const read = readOneShots()
    expect(read.personas.map((p) => p.id)).toEqual(['p1'])
    expect(read.situations.map((s) => s.id)).toEqual(['s1'])
    expect(read.selectedSituationId).toBe('s1')
    expect(read.selectedPartnerId).toBe('p1')
  })

  it('returns a fresh empty state clone when nothing is stored', () => {
    const a = readOneShots()
    const b = readOneShots()
    expect(a.personas).toEqual([])
    expect(a.situations).toEqual([])
    expect(a.selectedSituationId).toBeNull()
    // Mutating one result must not leak into the next read.
    a.personas.push(persona('x'))
    expect(b.personas).toEqual([])
  })

  it('tolerates a corrupt document', () => {
    sessionStorage.setItem(ONE_SHOTS_KEY, '{"schema": "not-a-number')
    expect(readOneShots().personas).toEqual([])
    expect(readOneShots().situations).toEqual([])
  })

  it('ignores a document from a newer app version', () => {
    sessionStorage.setItem(
      ONE_SHOTS_KEY,
      JSON.stringify({ schema: 99, data: { personas: [persona('p1')], situations: [] } }),
    )
    expect(readOneShots().personas).toEqual([])
  })

  it('does not throw when sessionStorage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      get length() {
        return 0
      },
    }
    vi.stubGlobal('sessionStorage', blocked)
    try {
      expect(() =>
        writeOneShots({
          personas: [persona('p1')],
          situations: [],
          selectedSituationId: null,
          selectedPartnerId: null,
        }),
      ).not.toThrow()
      expect(readOneShots().personas).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
