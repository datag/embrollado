import type { Gender } from '@/domain/types'

/**
 * How the AI partner perceives the learner (T112). Only what is perceivable (appearance, voice,
 * approximate age, gender) is part of the normal model context; the rest (name, details) is only
 * released when the learner enables the per-session "the AI partner already knows you" option or
 * reveals it during the conversation. The public contract between profile values and the prompt
 * wording lives here so the prompts and their tests share one source of truth.
 */

/**
 * The phrase for an exact age as an approximate band ("somewhere in their thirties"), so the
 * partner speaks naturally without knowing the exact figure. `null` when no age is given.
 */
export function ageRangePhrase(age: number | null): string | null {
  if (age == null) return null
  if (age < 13) return 'a child'
  if (age < 20) return 'a teenager'
  if (age >= 100) return 'over a hundred years old'
  const decade = Math.max(20, Math.floor(age / 10) * 10)
  const words: Record<number, string> = {
    20: 'twenties',
    30: 'thirties',
    40: 'forties',
    50: 'fifties',
    60: 'sixties',
    70: 'seventies',
    80: 'eighties',
    90: 'nineties',
  }
  const word = words[decade]
  return word ? `somewhere in their ${word}` : 'elderly'
}

/** The perceived visible presence of the learner — the lines under "Visible". */
export function visiblePerception(
  age: number | null,
  gender: Gender | null,
  appearance: string | null,
): string[] {
  const lines: string[] = []
  const range = ageRangePhrase(age)
  if (range) lines.push(`they look ${range}`)
  if (gender === 'female') lines.push('they appear to be a woman')
  else if (gender === 'male') lines.push('they appear to be a man')
  if (appearance) lines.push(appearance)
  return lines
}

/** The perceived audible presence of the learner — the lines under "Audible". */
export function audiblePerception(
  age: number | null,
  gender: Gender | null,
  voice: string | null,
): string[] {
  const lines: string[] = []
  const range = ageRangePhrase(age)
  if (range) lines.push(`their voice sounds ${range}`)
  if (gender === 'female') lines.push('their voice sounds female')
  else if (gender === 'male') lines.push('their voice sounds male')
  if (voice) lines.push(voice)
  return lines
}
