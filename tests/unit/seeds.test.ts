import { describe, expect, it } from 'vitest'
import { pickSeeds } from '@/domain/seeds'

/**
 * Seed rolls for the AI-generated drafts (FR-064). The RNG is injected so the picks are
 * deterministic — a fixed seed function must produce the same roll every time (constitution
 * Principle V). A twist is drawn ~1/3 of the time so that most drafts are a plain, quiet entry
 * point and only sometimes a latent turn is planted.
 */

/** A tiny deterministic PRNG so the tests never depend on `Math.random`. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('seed picker (T133 / FR-064)', () => {
  it('picks a full situation roll with the required slots', () => {
    const seed = pickSeeds('situation', rng(1))
    expect(seed.kind).toBe('situation')
    expect(seed.genre.length).toBeGreaterThan(0)
    expect(seed.place.length).toBeGreaterThan(0)
    expect(seed.aim.length).toBeGreaterThan(0)
    expect(seed.extras).toHaveLength(2)
    // The two extra words are distinct positions, so they differ.
    expect(seed.extras[0]).not.toBe(seed.extras[1])
  })

  it('picks a full partner roll with an occupation (role)', () => {
    const seed = pickSeeds('partner', rng(2))
    expect(seed.kind).toBe('partner')
    expect(seed.genre.length).toBeGreaterThan(0)
    expect(seed.place.length).toBeGreaterThan(0)
    expect(seed.role.length).toBeGreaterThan(0)
    expect(seed.extras).toHaveLength(2)
  })

  it('is deterministic for a fixed RNG', () => {
    expect(pickSeeds('situation', rng(42))).toEqual(pickSeeds('situation', rng(42)))
    expect(pickSeeds('partner', rng(7))).toEqual(pickSeeds('partner', rng(7)))
  })

  it('draws a twist for roughly a third of rolls', () => {
    // Fixed stream of 600 rolls through a generator seeded per call — deterministic count.
    let twists = 0
    const total = 600
    for (let i = 0; i < total; i++) {
      const seed = pickSeeds('situation', rng(i))
      if (seed.twist != null) twists++
    }
    // ~1/3 drawn; allow for a sensible band to avoid a brittle exact ratio.
    expect(twists / total).toBeGreaterThan(0.15)
    expect(twists / total).toBeLessThan(0.6)
  })

  it('returns null twist on a non-twist roll (plain entry point)', () => {
    // Find a roll without a twist and assert it is explicitly null, not the old value.
    for (let i = 0; i < 40; i++) {
      const seed = pickSeeds('situation', rng(i))
      if (seed.twist == null) {
        expect(seed.twist).toBeNull()
        return
      }
    }
    // Unreachable in practice, but satisfy the "always returns" shape.
    expect(true).toBe(true)
  })
})
