import { describe, expect, it } from 'vitest'
import { ageRangePhrase, visiblePerception, audiblePerception } from '@/domain/perception'

describe('learner perception (T112)', () => {
  it('renders an exact age as an approximate band', () => {
    expect(ageRangePhrase(31)).toBe('somewhere in their thirties')
    expect(ageRangePhrase(41)).toBe('somewhere in their forties')
    expect(ageRangePhrase(8)).toBe('a child')
    expect(ageRangePhrase(16)).toBe('a teenager')
    expect(ageRangePhrase(104)).toBe('over a hundred years old')
    expect(ageRangePhrase(null)).toBeNull()
  })

  it('splits perceivable traits into visible and audible lines', () => {
    const visible = visiblePerception(31, 'female', 'dark curly hair')
    expect(visible).toContain('they look somewhere in their thirties')
    expect(visible).toContain('they appear to be a woman')
    expect(visible).toContain('dark curly hair')

    const audible = audiblePerception(31, 'female', 'warm, quick laugh')
    expect(audible).toContain('their voice sounds somewhere in their thirties')
    expect(audible).toContain('their voice sounds female')
    expect(audible).toContain('warm, quick laugh')
  })

  it('keeps silence for an unset gender instead of guessing a term', () => {
    const visible = visiblePerception(31, 'other', null)
    expect(visible).not.toContain('woman')
    expect(visible).not.toContain('man')
  })

  it('returns nothing when the learner has no perceivable traits', () => {
    expect(visiblePerception(null, null, null)).toEqual([])
    expect(audiblePerception(null, null, null)).toEqual([])
  })
})
