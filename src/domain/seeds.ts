/**
 * Seed vocabulary for the AI-generated situation and partner drafts (FR-064). The app picks a
 * structured combination of elements — a genre, a place, a concrete aim, an optional latent twist,
 * a role for the partner, plus two soft extra words — and the generation prompt forces the model to
 * use those elements verbatim. That makes the scrap value of the built-in choices (café, airport,
 * job interview) structurally unavailable and the variety guaranteed and testable, instead of
 * leaving "randomness" to the model's taste.
 *
 * The RNG is injected so unit tests are deterministic (constitution Principle V) — no test depends
 * on `Math.random`. A twist is drawn for roughly one third of the rolls so that most drafts are a
 * plain entry point and only sometimes a latent turn is planted.
 */

export type DraftKind = 'situation' | 'partner'

export interface SituationSeeds {
  kind: 'situation'
  /** The kind of encounter (first meeting, routine errand, small conflict, …). */
  genre: string
  /** Where the scene is set — a concrete, deliberately untypical place. */
  place: string
  /** What the learner is there for — the entry point of the conversation. */
  aim: string
  /** A latent turn that may later come into play, or null when the draft stays plain. */
  twist: string | null
  /** Two soft extra words the model may weave in, but never at the cost of an element. */
  extras: [string, string]
}

export interface PartnerSeeds {
  kind: 'partner'
  genre: string
  place: string
  /** The partner's occupation. */
  role: string
  twist: string | null
  extras: [string, string]
}

export type DraftSeeds = SituationSeeds | PartnerSeeds

const GENRES = [
  'a first meeting',
  'a routine errand',
  'a small conflict',
  'a request for help',
  'an unexpected encounter',
  'a negotiation',
  'a celebration',
  'a problem to solve',
] as const

const PLACES = [
  'a laundromat in Vienna',
  'the lost-property office of a railway station',
  'a bicycle repair workshop',
  'the rooftop terrace of a co-op building',
  'a small harbour at low tide',
  'a village carnival at dusk',
  'a night bus stop in the rain',
  'a second-hand bookstall on a market square',
  'a community vegetable garden',
  'an airport departure lounge, late',
  'a municipal sports-hall foyer',
  'a radio store that repairs vintage sets',
  'a campsite by a lake in the morning',
  'a ferry terminal ticket window',
  'a laundromat in Porto',
  'a dental surgery waiting room',
  'a small-town post office just after lunch',
  'a chess club in a community centre',
  'a stationery shop before the school year',
  'a photo lab in a side street',
  'a jam stand at a farmers market',
  'a hotel lift that keeps stopping',
  'a public library reading room',
  'a shoe-repair kiosk by the tram stop',
  'an old anatomical theatre used for concerts',
  'a bakery in Oslo before opening',
  'a canal-boat mooring',
  'a dry cleaner on a busy corner',
  'a small train platform late at night',
  'a garden gnome wholesale warehouse',
  'a rooftop beehive on an office block',
  'a second-floor walk-up with a piano',
  'a lighthouse visitor room',
  "a potter's workshop by the river",
  'a bus depot cafeteria',
  'a municipal swimming-pool kiosk',
  'a language-school notice board',
  'a vintage sewing-machine repair shop',
  'a greenhouse at a plant nursery',
  'a rooftop plant nursery over a parking garage',
] as const

const AIMS = [
  'to exchange a parcel that was sent to the wrong street',
  'to find out whether a repaired bicycle is finally ready',
  'to ask whether the last dryer is free before closing time',
  'to hand over a birthday cake that must survive the rain',
  'to pick up a ticket that was supposed to be held',
  'to get a watch repaired that stopped at an odd hour',
  'to return a borrowed tool before the owner leaves',
  'to request a room change because the heater is broken',
  'to clarify a bill that was paid twice',
  'to collect a framed photo that was ordered, then forgotten',
  'to arrange a swap for a pair of shoes one size off',
  'to cancel a subscription face to face',
  'to ask whether a lost jacket has been handed in',
  'to deliver a forgotten lunch box to a young relative',
  'to have a key copied for a new roommate',
  'to book a table for a quiet celebration',
  'to ask whether a batch of jam from last month is still unsold',
  'to retrieve a package left at the wrong door',
  'to explain that a rented camera came back with a scratch',
  'to find out whether the early ferry really leaves at dawn',
  'to settle which of two neighbours gets the shared garage space',
  'to return a library book that is long overdue',
  'to ask a favour aside from the crowd',
  'to sign a delivery receipt for something never received',
  'to confirm an order that changed at the last minute',
  'to ask someone to look after a houseplant while away',
  'to buy a single roll of film that is usually sold only by the box',
  'to question a price that seems oddly high',
  'to volunteer for a job nobody else wants',
  'to ask directions to a street the maps cannot find',
  'to return a scarf that was dropped and now smells of rain',
  'to negotiate a better time for a shared chore',
  'to ask whether a found wallet was turned in intact',
  'to pick up a custom-made tool that is slightly different from what was ordered',
  'to see whether a repair shop can still fix an heirloom radio',
  'to fetch a home-baked loaf ordered for tomorrow morning',
  'to exchange a doorbell that does not match the advertised one',
  'to ask for help lifting a heavy box up two flights of stairs',
  'to return half of a bulk order bought on a whim',
  'to ask whether the portrait studio can do urgent headshots today',
] as const

const TWISTS = [
  'the place is about to close and the clock is ticking',
  'the learner has left the wallet at home',
  'the other person has just had a very bad day',
  'there is a misunderstanding about who is supposed to do what',
  'something the learner needs is no longer where it was promised',
  'the other person is in a hurry and the learner is not',
  'a third person is waiting and silently impatient',
  'the item at the centre of the errand is fragile',
  'the learner has to say no to something the other person wants',
  'nosey voices have already said this cannot be done',
  'the other person remembers the learner, but wrongly',
  'the learner arrives far too early for the real time',
  'a small favour is asked in exchange that the learner would rather not do',
  'the wrong person has been fetched',
  'the learner has to admit to having done something careless',
  'there is only one of the items left and two people want it',
  'the other person finds the whole thing funny, which is not helping',
  'the learner is expected to know something they do not know',
  'the payment method is not accepted here',
  'the learner has been given the wrong name of the place',
  'a real storm is gathering outside',
  'the other person keeps checking a phone that will not stop ringing',
  'the learner needs a signature that only the owner can give',
  'a heavy rain has just flooded the way back',
  'the item has a hidden fault the other person does not know about',
  'the learner has a train to catch and time is short',
  'the other person is waiting for a phone call that changes everything',
  "the learner lost something of the other person's and has to confess",
  'there is almost no money left and the price is higher than expected',
  'the learner is not actually allowed to be here at this hour',
] as const

const ROLES = [
  'a lighthouse keeper',
  'a driving instructor',
  'a dental technician',
  'a ferry captain',
  'a locksmith',
  'a piano teacher',
  'a night-shift nurse',
  'a map conservator',
  'a beekeeper on a city roof',
  'a dry cleaner who also mends',
  'a radio repair technician',
  'a market gardener',
  'a tile setter',
  'a working-life counsellor',
  'a puppet maker',
  'a bus inspector near retirement',
  'a sewer and knitter',
  'a small-town tax consultant',
  'a rehearsal pianist',
  'a park ranger',
  'a postal worker who knows every street',
  'a portrait photographer',
  'a welder who builds greenhouse frames',
  'a folk-dance teacher',
  'a cemetery keeper',
  'a bread delivery driver',
  'a course instructor for adults',
  'a mechanical typewriter restorer',
  'a glass blower',
  'a night janitor at a concert hall',
  'a sign painter',
  'a sailing coach',
  'a seed collector for a seed bank',
  'a railway signal technician',
  'a chimney sweep',
  'an opera prompter',
  'a lathe operator in a small machine shop',
  'a community hall caretaker',
  'a bookbinder and restorer',
  'a fishmonger at the morning market',
] as const

const EXTRAS = [
  'Lisbon',
  'Marrakesh',
  'Reykjavík',
  'a night-shift nurse',
  'a firefighter',
  'Marisol',
  'Idris',
  'a violinist',
  'apricot jam',
  'a wool blanket',
  'a tamarind tree',
  'a bicycle lock',
  'train delays',
  'a stray cat',
  'a flooded basement',
  'a birthday',
  'a cancelled flight',
  'a mix-up with the keys',
  'a much-loved book',
  'shellfish',
  'a football match',
  'a colder-than-usual winter',
  'a wedding gift',
  'a letter that was never sent',
  'a rusty gate',
  'warmer weather',
  'a recipe for rye bread',
  'an old accordion',
  'a lost button',
  'a physics experiment',
  'a second-hand coat',
  'a long wait',
  'a misunderstanding',
  'a shared umbrella',
  'the smell of fresh coffee',
  'a stubborn door',
  'a flat tire',
  'a borrowed umbrella',
  "a neighbours' dispute",
  'a bus that never comes',
  'a surprise guest',
  'a much-planned holiday',
  'a cheap guitar',
  'an unfamiliar accent',
  'a rusty bicycle pump',
  'tomato seedlings',
  'a load of laundry',
  'an overfull shelf',
  'a kindly offered seat',
  'a security guard with a clipboard',
  'a cup of peppermint tea',
  'a mostly empty cash register',
  'an unclaimed parcel',
  'a framed diploma',
  'a window box of geraniums',
  'a radio playing softly',
  'an old leather satchel',
  'a summons in the mail',
  'a cat that has to be let in',
] as const

/** Draw one element from a list via the injected RNG. */
function one<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)]
}

/** Draw `n` distinct elements (different positions) from a list. */
function distinct<T>(list: readonly T[], n: number, rng: () => number): T[] {
  const picked = new Set<number>()
  const out: T[] = []
  while (out.length < n) {
    const idx = Math.floor(rng() * list.length)
    if (picked.has(idx)) continue
    picked.add(idx)
    out.push(list[idx])
  }
  return out
}

/**
 * Pick the seeds for a draft. `rng` defaults to `Math.random`; pass a seeded function for
 * deterministic tests. A twist is drawn ~1/3 of the time so that most drafts are a plain, quiet
 * entry point and only sometimes a latent turn is planted (FR-064). The returned type narrows on
 * the `kind` literal so `pickSeeds('situation')` is a `SituationSeeds`.
 */
export function pickSeeds<K extends DraftKind>(
  kind: K,
  rng: () => number = Math.random,
): Extract<DraftSeeds, { kind: K }> {
  const genre = one(GENRES, rng)
  const place = one(PLACES, rng)
  const twist = rng() < 1 / 3 ? one(TWISTS, rng) : null
  const extras = distinct(EXTRAS, 2, rng) as [string, string]
  if (kind === 'partner') {
    return {
      kind,
      genre,
      place,
      role: one(ROLES, rng),
      twist,
      extras,
    } as Extract<DraftSeeds, { kind: K }>
  }
  return {
    kind,
    genre,
    place,
    aim: one(AIMS, rng),
    twist,
    extras,
  } as Extract<DraftSeeds, { kind: K }>
}
