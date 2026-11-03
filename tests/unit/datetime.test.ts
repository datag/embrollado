import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '@/utils/datetime'

describe('formatTimestamp (debug panel)', () => {
  it('formats ISO-like YYYY-MM-DD HH:MM:SS in local time', () => {
    const d = new Date(2026, 10, 3, 9, 5, 7) // Nov 3 2026, 09:05:07 local
    expect(formatTimestamp(d.getTime())).toBe('2026-11-03 09:05:07')
  })

  it('zero-pads single-digit months, days, hours, minutes and seconds', () => {
    const d = new Date(2026, 0, 5, 9, 5, 7) // Jan 5 2026, 09:05:07 local
    expect(formatTimestamp(d.getTime())).toBe('2026-01-05 09:05:07')
  })

  it('returns an empty string for an invalid input', () => {
    expect(formatTimestamp(NaN)).toBe('')
  })
})
