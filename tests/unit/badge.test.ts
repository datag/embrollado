import { describe, expect, it } from 'vitest'
import { buildBadge, isTier, sanitizeTier, variantsFor, TIERS } from '@/domain/badge'
import { assembleFeedback } from '@/domain/session'

describe('badge tiers (T042, T049)', () => {
  it('recognises exactly the four rating tiers', () => {
    const tiers: string[] = ['perfect', 'good', 'acceptable', 'unsatisfactory']
    for (const tier of tiers) {
      expect(isTier(tier)).toBe(true)
    }
    expect(isTier('excellent')).toBe(false)
    expect(isTier('unknown')).toBe(false)
    expect(isTier(42)).toBe(false)
  })

  it('rates an invalid or missing tier as unknown, never an invented rating', () => {
    expect(sanitizeTier('excellent')).toBe('unknown')
    expect(sanitizeTier(undefined)).toBe('unknown')
    expect(sanitizeTier('')).toBe('unknown')
  })

  it('has at least two label variants per tier per locale', () => {
    const locales: string[] = ['en', 'de']
    for (const locale of locales) {
      for (const tier of TIERS) {
        expect(variantsFor(tier, locale).length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('respects a valid labelKey from the model', () => {
    const { badge, index } = buildBadge({ tier: 'good', labelKey: 'good.1' }, 'en', 0)
    expect(badge.tier).toBe('good')
    expect(index).toBe(1)
    expect(badge.labelKey).toBe('good.1')
  })

  it('rotates to the next variant when the key is missing', () => {
    const first = buildBadge({ tier: 'good', labelKey: 'nonsense' }, 'en', 0)
    expect(first.index).toBe(1)
    expect(first.badge.labelKey).toBe('good.1')
    const second = buildBadge({ tier: 'good', labelKey: undefined }, 'en', first.index)
    expect(second.index).toBe(2)
  })

  it('rotates through every variant without repeating within a full cycle', () => {
    const variants = variantsFor('good', 'en')
    let prev = 0
    const labels: string[] = []
    for (let i = 0; i < variants.length; i++) {
      const { badge, index } = buildBadge({ tier: 'good', labelKey: undefined }, 'en', prev)
      labels.push(badge.label)
      prev = index
    }
    expect(new Set(labels).size).toBe(variants.length)
  })

  it('stores the rendered label with the badge', () => {
    const { badge } = buildBadge({ tier: 'perfect', labelKey: 'perfect.0' }, 'en', 0)
    expect(badge.label).toBe('Perfect!')
  })

  it('never produces an empty assessment (missing badge shows as unknown)', () => {
    // The json_object fallback lets weak models omit `badge` entirely (or set it to null).
    const missing = assembleFeedback(
      { partnerText: 'Hi' },
      { learnerText: 'Hello!', locale: 'en', previousBadgeIndex: 0 },
    )
    const nullBadge = assembleFeedback(
      { badge: null },
      { learnerText: 'Hello!', locale: 'en', previousBadgeIndex: 0 },
    )
    // No invented rating: the grey "unknown" state, never `acceptable`.
    expect(missing.badge?.tier).toBe('unknown')
    expect(nullBadge.badge?.tier).toBe('unknown')
    expect(missing.badge?.label).toBe('No assessment')
  })

  it('keeps a valid badge from the model', () => {
    const feedback = assembleFeedback(
      { badge: { tier: 'perfect', labelKey: 'perfect.0' } },
      { learnerText: 'Hello!', locale: 'en', previousBadgeIndex: 0 },
    )
    expect(feedback.badge?.tier).toBe('perfect')
    expect(feedback.badge?.label).toBe('Perfect!')
  })

  it('provides an unknown label in both locales (grey state)', () => {
    expect(variantsFor('unknown', 'en')).toContain('No assessment')
    expect(variantsFor('unknown', 'de')).toContain('Keine Bewertung')
    const built = buildBadge({ tier: 'unknown' }, 'en', 0)
    expect(built.badge.tier).toBe('unknown')
    expect(built.badge.label).toBe('No assessment')
  })
})
