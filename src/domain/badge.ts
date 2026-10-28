import type { Badge, BadgeTier } from '@/domain/types'
import { BADGE_VARIANTS, parseLabelKey } from '@/i18n/badges'

/**
 * Badge logic (T049; FR-040…FR-043). The model returns the tier (judged relative to the selected
 * level) and a label key; the wording itself lives in the translation files (FR-041). The app
 * validates the tier and rotates through the variants so consecutive turns rarely repeat.
 */
export const TIERS: BadgeTier[] = ['perfect', 'good', 'acceptable', 'unsatisfactory']

export function isTier(value: unknown): value is BadgeTier {
  return typeof value === 'string' && (TIERS as string[]).includes(value)
}

/** Invalid tiers fall back to `acceptable` (FR-025) — a malformed answer never breaks the layout. */
export function sanitizeTier(value: unknown): BadgeTier {
  return isTier(value) ? value : 'acceptable'
}

export function variantsFor(tier: BadgeTier, locale: string): string[] {
  const byLocale = (BADGE_VARIANTS as Record<string, Record<BadgeTier, string[]>>)[locale]
  const list = (byLocale?.[tier] ?? BADGE_VARIANTS.en[tier]) as string[]
  return list.length > 0 ? list : ['Good!']
}

export interface BuiltBadge {
  badge: Badge
  /** The variant index used — the caller keeps it so the next turn can rotate away. */
  index: number
}

/**
 * Build a final, stored badge from the model's answer:
 *  - the tier is sanitised (fallback `acceptable`);
 *  - a valid key the model supplied is respected;
 *  - otherwise the next variant index after the previous turn's is chosen.
 */
export function buildBadge(
  input: { tier?: unknown; labelKey?: unknown },
  locale: string,
  previousIndex: number,
): BuiltBadge {
  const tier = sanitizeTier(input.tier)
  const variants = variantsFor(tier, locale)

  let index: number
  const parsed =
    typeof input.labelKey === 'string' ? parseLabelKey(input.labelKey, tier) : null
  if (parsed && parsed.index >= 0 && parsed.index < variants.length) {
    index = parsed.index
  } else {
    index = (previousIndex + 1) % variants.length
  }

  const labelKey = `${tier}.${index}`
  return {
    badge: { tier, labelKey, label: variants[index] },
    index,
  }
}