import { describe, expect, it } from 'vitest'
import { buildBadge, isTier, sanitizeTier, variantsFor, TIERS } from '@/domain/badge'

describe('badge tiers (T042, T049)', () => {
  it('recognises exactly the four tiers', () => {
    const tiers: string[] = ['perfect', 'good', 'acceptable', 'unsatisfactory']
    for (const tier of tiers) {
      expect(isTier(tier)).toBe(true)
    }
    expect(isTier('excellent')).toBe(false)
    expect(isTier(42)).toBe(false)
  })

  it('falls back to acceptable for an invalid tier (FR-025)', () => {
    expect(sanitizeTier('excellent')).toBe('acceptable')
    expect(sanitizeTier(undefined)).toBe('acceptable')
    expect(sanitizeTier('')).toBe('acceptable')
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
})
