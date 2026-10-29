import { describe, expect, it } from 'vitest'
import { translationVisible } from '@/domain/session'

/**
 * FR-057: the partner-line translation is hidden by default (cheat protection), revealable per
 * line via a toggle, and auto-revealed once the line has been answered.
 */
describe('translationVisible (FR-057)', () => {
  it('stays hidden while the line is open and unanswered', () => {
    expect(translationVisible(null, false, false)).toBe(false)
  })

  it('reveals a line once it has been answered', () => {
    expect(translationVisible(null, true, false)).toBe(true)
  })

  it('shows every line of an ended session (re-read after the conversation)', () => {
    expect(translationVisible(null, false, true)).toBe(true)
    expect(translationVisible(null, true, true)).toBe(true)
  })

  it('lets an explicit toggle decision win over the derived default', () => {
    // Peeked at an unanswered line → visible despite the default.
    expect(translationVisible(true, false, false)).toBe(true)
    // Explicitly hidden although answered.
    expect(translationVisible(false, true, false)).toBe(false)
    // Explicitly hidden even in an ended session.
    expect(translationVisible(false, false, true)).toBe(false)
  })
})
