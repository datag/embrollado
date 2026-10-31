import { describe, expect, it } from 'vitest'
import { assembleFeedback } from '@/domain/session'

/**
 * The concrete error fix (FR-062): when the explanation names a wrong word or spelling, the same
 * mistake must also appear in the issues — with the wrong form ("original") and the right form
 * ("corrected"). The app validates the pair against the learner's actual answer, the same
 * last-line-of-defence it applies to assumptions (FR-009).
 */
function feedbackFor(raw: Record<string, unknown>, learnerText: string) {
  return assembleFeedback(raw, { learnerText, locale: 'en', previousBadgeIndex: 0 })
}

describe('issue error pairs (FR-062)', () => {
  it('keeps a valid pair: the original appears in the answer and the correction differs', () => {
    const feedback = feedbackFor(
      {
        issues: [
          {
            category: 'vocabulary',
            detail: 'Wrong spelling of "receive".',
            suggestion: 'Spelling',
            original: 'recieve',
            corrected: 'receive',
          },
        ],
      },
      'I will recieve the package.',
    )
    expect(feedback.issues).toHaveLength(1)
    expect(feedback.issues[0].original).toBe('recieve')
    expect(feedback.issues[0].corrected).toBe('receive')
    expect(feedback.issues[0].detail).toBe('Wrong spelling of "receive".')
    expect(feedback.issues[0].suggestion).toBe('Spelling')
  })

  it('matches the original case-insensitively against the answer', () => {
    const feedback = feedbackFor(
      {
        issues: [
          {
            category: 'grammar',
            detail: 'Capitalisation of the city name.',
            suggestion: null,
            original: 'spain',
            corrected: 'Spain',
          },
        ],
      },
      'I went to spain last summer.',
    )
    expect(feedback.issues).toHaveLength(1)
    expect(feedback.issues[0].original).toBe('spain')
    expect(feedback.issues[0].corrected).toBe('Spain')
  })

  it('drops the pair when the original does not appear in the answer (phantom fix)', () => {
    const feedback = feedbackFor(
      {
        issues: [
          {
            category: 'grammar',
            detail: 'The model invented a wrong form.',
            suggestion: null,
            original: 'recieve',
            corrected: 'receive',
          },
        ],
      },
      'I will receive the parcel tomorrow.',
    )
    expect(feedback.issues).toHaveLength(1)
    expect(feedback.issues[0].original).toBeNull()
    expect(feedback.issues[0].corrected).toBeNull()
    // The descriptive fields stay — only the fabricated fix is dropped.
    expect(feedback.issues[0].detail).toBe('The model invented a wrong form.')
  })

  it('drops the pair when correction equals the original (no real fix)', () => {
    const feedback = feedbackFor(
      {
        issues: [
          {
            category: 'usage',
            detail: 'No-op pair.',
            suggestion: null,
            original: 'recieve',
            corrected: 'recieve',
          },
        ],
      },
      'I recieve your letter.',
    )
    expect(feedback.issues[0].original).toBeNull()
    expect(feedback.issues[0].corrected).toBeNull()
  })

  it('keeps an issue without a pair (old model payload) untouched', () => {
    const feedback = feedbackFor(
      {
        issues: [
          { category: 'completeness', detail: 'The answer stops mid-sentence.', suggestion: null },
        ],
      },
      'I wanted to',
    )
    expect(feedback.issues).toHaveLength(1)
    expect(feedback.issues[0].original).toBeNull()
    expect(feedback.issues[0].corrected).toBeNull()
  })

  it('drops a whitespace-only pair', () => {
    const feedback = feedbackFor(
      {
        issues: [
          {
            category: 'grammar',
            detail: 'Empty forms.',
            suggestion: null,
            original: '   ',
            corrected: '',
          },
        ],
      },
      'Anything at all.',
    )
    expect(feedback.issues[0].original).toBeNull()
    expect(feedback.issues[0].corrected).toBeNull()
  })
})
