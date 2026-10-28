import type { BadgeTier } from '@/domain/types'

/**
 * Badge label variants (T027, FR-041/FR-042). Each tier has at least two wordings per locale;
 * the app rotates through them so consecutive turns rarely repeat the same wording. The model
 * returns a `labelKey` (`"<tier>.<index>"`); unknown keys fall back per tier.
 */

export const BADGE_VARIANTS: Record<string, Record<BadgeTier, string[]>> = {
  en: {
    perfect: ['Perfect!', 'Very good!', 'Flawless!'],
    good: ['Good!', 'Well done!', 'Nice!'],
    acceptable: ['Acceptable', 'That works', 'Okay'],
    unsatisfactory: ['Not quite', 'What?', 'Almost'],
  },
  de: {
    perfect: ['Perfekt!', 'Sehr gut!', 'Großartig!'],
    good: ['Gut!', 'Gut gemacht!', 'Prima!'],
    acceptable: ['Akzeptabel', 'Das geht', 'In Ordnung'],
    unsatisfactory: ['Noch nicht ganz', 'Wie bitte?', 'Fast'],
  },
}

/** Parse a labelKey like `good.1` into a tier + variant index, or null. */
export function parseLabelKey(
  labelKey: string,
  tier: BadgeTier,
): { tier: BadgeTier; index: number } | null {
  const parts = labelKey.split('.')
  if (parts.length !== 2) return null
  const [maybeTier, maybeIndex] = parts
  if (maybeTier !== tier) return null
  const index = Number(maybeIndex)
  if (!Number.isInteger(index) || index < 0) return null
  return { tier, index }
}
