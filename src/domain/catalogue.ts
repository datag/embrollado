import type { Level, Persona, Situation } from '@/domain/types'

/**
 * The static catalogue (T025): 12 target languages, 3 levels, 13 built-in situations, 5 built-in
 * partners (FR-002/003). Built-in entries carry `builtin:` ids; learner-defined ones live in the
 * profile store and combine with these lists in the Setup screen.
 */

export interface CatalogueLanguage {
  code: string
  nameEn: string
  /** The name written in its own language, shown next to the English name. */
  nativeName: string
}

export const LANGUAGES: CatalogueLanguage[] = [
  { code: 'en', nameEn: 'English', nativeName: 'English' },
  { code: 'de', nameEn: 'German', nativeName: 'Deutsch' },
  { code: 'es', nameEn: 'Spanish', nativeName: 'Español' },
  { code: 'fr', nameEn: 'French', nativeName: 'Français' },
  { code: 'it', nameEn: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', nameEn: 'Portuguese', nativeName: 'Português' },
  { code: 'nl', nameEn: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', nameEn: 'Polish', nativeName: 'Polski' },
  { code: 'tr', nameEn: 'Turkish', nativeName: 'Türkçe' },
  { code: 'sv', nameEn: 'Swedish', nativeName: 'Svenska' },
  { code: 'da', nameEn: 'Danish', nativeName: 'Dansk' },
  { code: 'no', nameEn: 'Norwegian', nativeName: 'Norsk' },
]

export interface CatalogueLevel {
  id: Level
  name: string
  description: string
}

export const LEVELS: CatalogueLevel[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Simple words and short sentences; a slow, forgiving conversation.',
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Everyday vocabulary and natural sentences; room for the usual mistakes.',
  },
  {
    id: 'expert',
    name: 'Expert',
    description: 'Idiomatic, fluent conversation — as with a native speaker.',
  },
]

const sit = (
  id: string,
  name: string,
  setting: string,
  keyMoments: string[],
  suggestedPartners: string[] = [],
): Situation => ({
  id: `builtin:${id}`,
  name,
  setting,
  keyMoments,
  suggestedPartners,
  origin: 'builtin',
  visibility: 'template',
  createdAt: null,
})

export const SITUATIONS: Situation[] = [
  sit(
    'campsite-washroom',
    'At the campsite washroom',
    'You meet a fellow camper in front of the washroom building at a small campsite in the evening and end up in conversation.',
    ['the first encounter', 'asking where people come from', 'saying goodbye for the night'],
    ['builtin:nicole'],
  ),
  sit(
    'bakery-queue',
    'In the bakery queue',
    'You are queuing at a local bakery; the person behind you starts talking about the weather and the freshly baked bread.',
    ['the queue chat', 'the order', 'the walk-out together'],
  ),
  sit(
    'train-tickets',
    'At the station ticket window',
    'You approach the ticket counter to buy a day ticket and ask about the platform and departure times.',
    ['the request', 'the fare discussion', 'the thanks'],
  ),
  sit(
    'restaurant-order',
    'Ordering dinner',
    'You sit down in a neighbourhood restaurant and order dinner; your companion helps you pick dishes.',
    ['the menu debate', 'the order', 'the bill'],
    ['builtin:sofia'],
  ),
  sit(
    'hotel-checkin',
    'Late check-in at the hotel',
    'You arrive late at a hotel; the receptionist checks you in and points out the breakfast times and the Wi-Fi.',
    ['the check-in', 'the practical questions', 'the room'],
  ),
  sit(
    'pharmacy-visit',
    'At the pharmacy',
    'You need something for a headache and describe your symptoms at the pharmacy counter.',
    ['the symptoms', 'the advice', 'the payment'],
    ['builtin:elif'],
  ),
  sit(
    'job-interview',
    'The job interview',
    'You are interviewed for a position you are excited about; the interviewer wants to know you beyond your CV.',
    ['the introduction', 'the experience talk', 'the closing'],
    ['builtin:tom'],
  ),
  sit(
    'house-party',
    "A friend's house party",
    "At a friend's house party you get talking to someone who seems to know everyone in the room.",
    ['the introduction', 'the small talk', 'the parting'],
    ['builtin:marc'],
  ),
  sit(
    'supermarket-aisle',
    'In the supermarket aisle',
    'You reach for the same product as a stranger and start a light-hearted chat about cooking.',
    ['the first comment', 'the recipe exchange', 'the checkout farewell'],
  ),
  sit(
    'post-office',
    'Sending a parcel',
    'You queue at the post office to send a parcel abroad and the clerk asks a few questions.',
    ['the parcel', 'the customs talk', 'the receipt'],
  ),
  sit(
    'directions-park',
    'Asking for directions',
    'You are looking for the city park and ask a friendly passer-by near the main square for directions.',
    ['the question', 'the explanation', 'the thanks'],
  ),
  sit(
    'bookstore',
    'Browsing the bookstore',
    'You browse in a bookshop and start talking with someone who is also looking at the language-learning shelf.',
    ['the shared shelf', 'the recommendations', 'the stay in touch'],
    ['builtin:sofia'],
  ),
  sit(
    'phone-call',
    'On the phone',
    'You are on the phone with the person at the other end — you can hear each other but cannot see each other. You called to ask about and sort out something.',
    ['the greeting', 'the question', 'the goodbye'],
  ),
]

const pers = (
  id: string,
  name: string,
  age: number,
  gender: Persona['gender'],
  occupation: string,
  description: string,
): Persona => ({
  id: `builtin:${id}`,
  name,
  age,
  gender,
  occupation,
  description,
  origin: 'builtin',
  visibility: 'template',
  createdAt: null,
})

export const PARTNERS: Persona[] = [
  pers(
    'nicole',
    'Nicole',
    38,
    'female',
    'confectioner',
    'A warm, patient confectioner who owns a small bakery and loves to talk about her craft, the village and her weekends hiking.',
  ),
  pers(
    'marc',
    'Marc',
    29,
    'male',
    'tour guide',
    'An energetic tour guide who has shown visitors around for six years and enjoys telling stories and asking what his guests think.',
  ),
  pers(
    'elif',
    'Elif',
    34,
    'female',
    'doctor',
    'A calm, attentive doctor who asks careful questions and explains things clearly, friends teasing her for taking notes at parties.',
  ),
  pers(
    'tom',
    'Tom',
    41,
    'male',
    'engineer',
    'A quick-witted engineer who is curious about how things work and about the people he meets; practical and a little dry in humour.',
  ),
  pers(
    'sofia',
    'Sofia',
    27,
    'female',
    'university student',
    'A cheerful literature student who reads a lot, is always up for a debate and switches instantly between joke and sincerity.',
  ),
]

export function languageByCode(code: string): CatalogueLanguage | undefined {
  return LANGUAGES.find((l) => l.code === code)
}

/**
 * The human-readable name of a language code for prompts ("Spanish", "German"). Pitch-perfect
 * names beat ambiguous ISO codes with weak models; unknown codes pass through unchanged.
 */
export function languageName(code: string): string {
  return languageByCode(code)?.nameEn ?? code
}

export function isKnownLanguage(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code)
}

export function levelById(id: string): CatalogueLevel | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function situationById(id: string): Situation | undefined {
  return SITUATIONS.find((s) => s.id === id)
}

export function partnerById(id: string): Persona | undefined {
  return PARTNERS.find((p) => p.id === id)
}
