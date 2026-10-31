import type { Assumption, Badge, Issue, Session, Turn } from '@/domain/types'
import { buildBadge } from '@/domain/badge'

/**
 * Session domain logic (T053): the last line of defence against a malformed model answer. Runs on
 * the raw parsed turn JSON before anything is persisted or rendered.
 */

/**
 * Whether a partner line's translation may be shown (FR-057). An explicit decision (the learner's
 * toggle or the auto-reveal when an answer is sent) always wins; without one, an answered line —
 * or every line of an ended session — is shown by default, so a re-read after a reload is not
 * degraded. The currently open, unanswered line stays hidden (the "cheat" is per line).
 */
export function translationVisible(
  override: boolean | null,
  answered: boolean,
  sessionEnded: boolean,
): boolean {
  if (override !== null) return override
  return sessionEnded || answered
}

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

/**
 * Gaps are only shown when the learner actually left one (FR-009): the explicit "???" marker, or a
 * single word written in the learner's native language that the model filled in. A phrase the
 * learner wrote in the TARGET language is never a gap — the model sometimes lists one anyway, so
 * the app drops it here (the defence must not rely on the model alone).
 */
export function validateAssumptions(value: unknown, learnerText: string | null): Assumption[] {
  if (!Array.isArray(value)) return []
  const cleaned: Assumption[] = []
  const hasMarker = learnerText != null && learnerText.includes('???')
  for (const item of value) {
    if (cleaned.length >= 5) break // capped at 5 (data-model §2)
    if (typeof item !== 'object' || item === null) continue
    const raw = item as Record<string, unknown>
    const original = typeof raw.original === 'string' ? raw.original : ''
    const filled = typeof raw.filled === 'string' ? raw.filled : ''
    const reason = typeof raw.reason === 'string' ? raw.reason : ''
    if (!original || !filled || original === filled) continue
    if (learnerText && !learnerText.includes(original)) continue
    // Without an explicit "???" marker, only a single (native) word can plausibly be a gap —
    // never a phrase the learner wrote in the target language.
    if (!hasMarker && /\s/.test(original)) continue
    cleaned.push({ original, filled, reason })
  }
  return cleaned
}

const ISSUE_CATEGORIES = ['grammar', 'vocabulary', 'usage', 'completeness']

/**
 * Validate one error pair. The concrete fix is only trustworthy when the fragment the model
 * claims is wrong actually appears in the learner's answer (case-insensitive) and the correction
 * really differs from it — otherwise the pair is dropped so the UI never shows a phantom
 * correction (the same defence as for gaps, FR-009).
 */
function sanitizeIssuePair(
  raw: Record<string, unknown>,
  learnerText: string | null,
): { original: string | null; corrected: string | null } {
  const original = typeof raw.original === 'string' ? raw.original.trim() : ''
  const corrected = typeof raw.corrected === 'string' ? raw.corrected.trim() : ''
  const appearsInAnswer =
    original.length > 0 &&
    learnerText != null &&
    learnerText.toLowerCase().includes(original.toLowerCase())
  // A capitalisation or accent fix ("spain" → "Spain") is a real fix; only a byte-identical pair
  // (after trimming) is a no-op.
  const isRealFix = original.length > 0 && corrected.length > 0 && corrected !== original
  if (!appearsInAnswer || !isRealFix) {
    return { original: null, corrected: null }
  }
  return { original, corrected }
}

function sanitizeIssues(value: unknown, learnerText: string | null): Issue[] {
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
      ...sanitizeIssuePair(raw, learnerText),
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
  const issues = sanitizeIssues(value.issues, learnerText)

  let badge: Badge | null = null
  let badgeIndex = ctx.previousBadgeIndex
  // Every answer must receive a rating (FR-040, SC-003). The strict schema enforces `badge`, but
  // in the json_object fallback weak models often omit it — a missing or malformed rating then
  // shows as `unknown` (grey), never an invented `acceptable` (owner decision).
  const badgeInput =
    value.badge && typeof value.badge === 'object'
      ? (value.badge as { tier?: unknown; labelKey?: unknown })
      : {}
  const built = buildBadge(badgeInput, ctx.locale, ctx.previousBadgeIndex)
  badge = built.badge
  badgeIndex = built.index

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
    illustrationId: null,
    audioId: null,
    createdAt: now,
    feedbackLanguage,
  }
}
