import type { Assumption, Badge, Issue, Session, Turn } from '@/domain/types'
import { buildBadge } from '@/domain/badge'

/**
 * Session domain logic (T053): the last line of defence against a malformed model answer. Runs on
 * the raw parsed turn JSON before anything is persisted or rendered.
 */

export interface TurnFeedback {
  translation: string
  explanation: string | null
  correctedText: string | null
  interpretation: string | null
  assumptions: Assumption[]
  badge: Badge | null
  issues: Issue[]
  /** The badge variant index used, for the next turn's rotation. */
  badgeIndex: number
}

/** Gaps are only kept when the learner's original text actually appeared in their answer (FR-009). */
export function validateAssumptions(value: unknown, learnerText: string | null): Assumption[] {
  if (!Array.isArray(value)) return []
  const cleaned: Assumption[] = []
  for (const item of value) {
    if (cleaned.length >= 5) break // capped at 5 (data-model §2)
    if (typeof item !== 'object' || item === null) continue
    const raw = item as Record<string, unknown>
    const original = typeof raw.original === 'string' ? raw.original : ''
    const filled = typeof raw.filled === 'string' ? raw.filled : ''
    const reason = typeof raw.reason === 'string' ? raw.reason : ''
    if (!original || !filled) continue
    if (learnerText && !learnerText.includes(original)) continue
    cleaned.push({ original, filled, reason })
  }
  return cleaned
}

const ISSUE_CATEGORIES = ['grammar', 'vocabulary', 'usage', 'completeness']

function sanitizeIssues(value: unknown): Issue[] {
  if (!Array.isArray(value)) return []
  const issues: Issue[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const raw = item as Record<string, unknown>
    const category = (raw.category as string) ?? 'grammar'
    const detail = typeof raw.detail === 'string' ? raw.detail : ''
    if (!detail) continue
    issues.push({
      category: (ISSUE_CATEGORIES as string[]).includes(category)
        ? (category as Issue['category'])
        : 'grammar',
      detail,
      suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : null,
    })
  }
  return issues
}

export interface AssembleContext {
  learnerText: string | null
  locale: string
  previousBadgeIndex: number
}

/**
 * Assemble the trustworthy feedback fields from the raw model JSON. Every field is sanitised —
 * unknown keys are ignored (turn-payload.md §2).
 */
export function assembleFeedback(raw: unknown, ctx: AssembleContext): TurnFeedback {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const learnerText = ctx.learnerText

  const translation = typeof value.translation === 'string' ? value.translation : ''
  const explanation = typeof value.explanation === 'string' ? value.explanation : null
  const correctedText = typeof value.correctedText === 'string' ? value.correctedText : null
  const interpretation = typeof value.interpretation === 'string' ? value.interpretation : null
  const assumptions = validateAssumptions(value.assumptions, learnerText)
  const issues = sanitizeIssues(value.issues)

  let badge: Badge | null = null
  let badgeIndex = ctx.previousBadgeIndex
  if (value.badge && typeof value.badge === 'object') {
    const built = buildBadge(
      value.badge as { tier?: unknown; labelKey?: unknown },
      ctx.locale,
      badgeIndex,
    )
    badge = built.badge
    badgeIndex = built.index
  }

  return {
    translation,
    explanation,
    correctedText,
    interpretation,
    assumptions,
    badge,
    issues,
    badgeIndex,
  }
}

/** The opening turn of a session — no learner answer, so no badge/feedback except translation. */
export function createOpeningTurn(
  session: Session,
  partnerText: string,
  translation: string,
  explanation: string | null,
  feedbackLanguage: string,
  now = new Date().toISOString(),
): Turn {
  return {
    id: crypto.randomUUID(),
    sessionId: session.id,
    position: 1,
    partnerText,
    partnerTextLanguage: session.language,
    translation,
    explanation,
    learnerText: null,
    correctedText: null,
    interpretation: null,
    assumptions: [],
    badge: null,
    issues: [],
    explain: null,
    illustrationId: null,
    audioId: null,
    createdAt: now,
    feedbackLanguage,
  }
}
