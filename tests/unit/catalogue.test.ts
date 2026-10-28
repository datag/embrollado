import { describe, expect, it } from 'vitest'
import { LEVELS, PARTNERS, SITUATIONS, LANGUAGES } from '@/domain/catalogue'

describe('catalogue (T031)', () => {
  it('exposes 12 target languages', () => {
    expect(LANGUAGES).toHaveLength(12)
  })

  it('exposes the three levels', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['beginner', 'intermediate', 'expert'])
    for (const level of LEVELS) {
      expect(level.description.length).toBeGreaterThan(0)
    }
  })

  it('exposes 12 predefined situations', () => {
    expect(SITUATIONS).toHaveLength(12)
    for (const s of SITUATIONS) {
      expect(s.id).toMatch(/^builtin:/)
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.setting.length).toBeLessThanOrEqual(400)
      expect(s.keyMoments.length).toBeGreaterThan(0)
    }
  })

  it('exposes 5 predefined partners', () => {
    expect(PARTNERS).toHaveLength(5)
    for (const p of PARTNERS) {
      expect(p.id).toMatch(/^builtin:/)
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.age).toBeGreaterThanOrEqual(0)
      expect(p.age).toBeLessThanOrEqual(120)
      expect(p.description.length).toBeLessThanOrEqual(400)
    }
  })

  it('combines every situation with every partner', () => {
    for (const s of SITUATIONS) {
      for (const p of PARTNERS) {
        expect(s.id).toBeTruthy()
        expect(p.id).toBeTruthy()
      }
    }
  })
})
