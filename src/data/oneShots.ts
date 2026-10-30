import type { Persona, Situation } from '@/domain/types'

/**
 * One-off (session-only) entries lived in the tab. They are written to `sessionStorage` so they
 * survive a reload of the Setup screen, but are gone as soon as the tab closes (FR-046). The
 * in-progress selection is stored with them: a reload halfway through the setup restores the
 * chosen situation and partner; starting a conversation clears the selection but not the entries.
 * Entries are small and few, so a single JSON document is enough.
 */

export const ONE_SHOTS_KEY = 'embrollado.oneshot.v1'
export const ONE_SHOTS_SCHEMA = 1

export interface OneShotsData {
  personas: Persona[]
  situations: Situation[]
  selectedSituationId: string | null
  selectedPartnerId: string | null
}

export interface OneShotsDocument {
  schema: number
  data: OneShotsData
}

export const EMPTY_ONE_SHOTS: OneShotsData = {
  personas: [],
  situations: [],
  selectedSituationId: null,
  selectedPartnerId: null,
}

function clone(data: OneShotsData): OneShotsData {
  return {
    personas: data.personas.map((p) => ({ ...p })),
    situations: data.situations.map((s) => ({ ...s })),
    selectedSituationId: data.selectedSituationId,
    selectedPartnerId: data.selectedPartnerId,
  }
}

export function readOneShots(): OneShotsData {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(ONE_SHOTS_KEY)
  } catch {
    // sessionStorage can be blocked (e.g. Safari private mode) — behave as if empty.
    return clone(EMPTY_ONE_SHOTS)
  }
  if (!raw) return clone(EMPTY_ONE_SHOTS)
  try {
    const doc = JSON.parse(raw) as Partial<OneShotsDocument>
    const schema = Number(doc?.schema ?? 0)
    if (!Number.isInteger(schema) || schema > ONE_SHOTS_SCHEMA) return clone(EMPTY_ONE_SHOTS)
    const data = doc?.data
    if (!data || typeof data !== 'object') return clone(EMPTY_ONE_SHOTS)
    return clone({
      personas: Array.isArray(data.personas) ? (data.personas as Persona[]) : [],
      situations: Array.isArray(data.situations) ? (data.situations as Situation[]) : [],
      selectedSituationId:
        typeof data.selectedSituationId === 'string' ? data.selectedSituationId : null,
      selectedPartnerId: typeof data.selectedPartnerId === 'string' ? data.selectedPartnerId : null,
    })
  } catch {
    return clone(EMPTY_ONE_SHOTS)
  }
}

export function writeOneShots(data: OneShotsData): { ok: boolean; error: string | null } {
  try {
    const doc: OneShotsDocument = { schema: ONE_SHOTS_SCHEMA, data: clone(data) }
    sessionStorage.setItem(ONE_SHOTS_KEY, JSON.stringify(doc))
    return { ok: true, error: null }
  } catch (err) {
    // sessionStorage can be blocked — never throw into the UI, report back.
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
