import { describe, expect, it } from 'vitest'
import { validateAssumptions } from '@/domain/session'

/**
 * FR-009 enforcement: "Filled-in gaps" only ever shows real gaps — the explicit "???" marker, or a
 * single word the learner wrote in their native language. The model sometimes lists arbitrary
 * target-language phrases as gaps anyway; the app must drop those (the reported case: the answer
 * "…proper heads-up…" was shown as an assumption although the learner left no gap).
 */
describe('validateAssumptions (FR-009)', () => {
  it('keeps an assumption for an explicit "???" marker', () => {
    const out = validateAssumptions(
      [{ original: '???', filled: 'the bill', reason: 'The waiter is here.' }],
      'I would like the ??? please.',
    )
    expect(out).toHaveLength(1)
    expect(out[0].filled).toBe('the bill')
  })

  it('keeps an assumption whose original is a phrase when the marker is present', () => {
    const out = validateAssumptions(
      [
        {
          original: 'the ??? from downstairs',
          filled: 'the box from downstairs',
          reason: 'The learner left a marker.',
        },
      ],
      'Please bring me the ??? from downstairs.',
    )
    expect(out).toHaveLength(1)
  })

  it('keeps a single native word that the model filled in (no marker)', () => {
    const out = validateAssumptions(
      [{ original: 'Zeug', filled: 'stuff', reason: 'German word as a gap.' }],
      'Do you have any Zeug I could borrow?',
    )
    expect(out).toHaveLength(1)
    expect(out[0].original).toBe('Zeug')
  })

  it('drops a multi-word phrase when the answer has no marker — the reported bug', () => {
    // The learner wrote a complete target-language sentence without any gap; the model invented
    // an assumption for an ordinary phrase. It must never reach the UI.
    const out = validateAssumptions(
      [
        {
          original: 'proper heads-up',
          filled: 'heads-up',
          reason: 'The phrase means to warn someone.',
        },
      ],
      "Yes, I am. But you couldn't say I didn't give you a proper heads-up, right?",
    )
    expect(out).toEqual([])
  })

  it('drops a no-op assumption (original equals filled)', () => {
    const out = validateAssumptions(
      [{ original: 'heads-up', filled: 'heads-up', reason: 'No change.' }],
      'a proper heads-up',
    )
    expect(out).toEqual([])
  })

  it('drops an assumption whose original does not appear in the answer', () => {
    const out = validateAssumptions(
      [{ original: 'Niemals', filled: 'never', reason: 'Not there.' }],
      'I am fine.',
    )
    expect(out).toEqual([])
  })

  it('caps the assumptions at five', () => {
    const raw = Array.from({ length: 8 }, (_, i) => ({
      original: `Wort${i}`,
      filled: `word${i}`,
      reason: 'x',
    }))
    const out = validateAssumptions(raw, 'Wort0 Wort1 Wort2 Wort3 Wort4 Wort5 Wort6 Wort7')
    expect(out).toHaveLength(5)
  })

  it('keeps the reason and tolerates a missing one', () => {
    const out = validateAssumptions(
      [
        { original: 'Zeug', filled: 'stuff', reason: 'Fits.' },
        { original: 'Kram', filled: 'junk' },
      ],
      'Zeug und Kram',
    )
    expect(out[0].reason).toBe('Fits.')
    expect(out[1].reason).toBe('')
  })

  it('returns an empty list for non-array input', () => {
    expect(validateAssumptions(null, 'hi')).toEqual([])
    expect(validateAssumptions('nope', 'hi')).toEqual([])
  })
})