import type { InterfaceLanguage, LearnerProfile, ThemeOption } from '@/domain/types'

/**
 * Versioned settings store (T019). One small `localStorage` key, migration on read, defaults
 * when a stored document claims a schema newer than the app knows.
 *
 * Shape (storage-export.md §2):
 *   embrollado.settings.v1 = { schema: 1, data: LearnerProfile }
 */

export const SETTINGS_KEY = 'embrollado.settings.v1'
export const SETTINGS_SCHEMA = 1

export const DEFAULT_SETTINGS: LearnerProfile = {
  name: '',
  details: '',
  nativeLanguage: null,
  interfaceLanguage: 'en',
  theme: 'auto',
  speechEnabled: true,
  illustrationsEnabled: true,
  cachedSpeechLines: 20,
}

export interface SettingsDocument {
  schema: number
  data: LearnerProfile
}

export type SettingsPatch = Partial<LearnerProfile>

/** Migration chain 1 → 2 → …; every step is a pure function. */
const migrations: Record<number, (doc: SettingsDocument) => SettingsDocument> = {
  // 1 → 2: nothing yet — reserved so the pattern stays wired and testable.
}

function clone(v: LearnerProfile): LearnerProfile {
  return { ...v }
}

export function readSettings(): LearnerProfile {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SETTINGS_KEY)
  } catch {
    return clone(DEFAULT_SETTINGS)
  }
  if (!raw) return clone(DEFAULT_SETTINGS)

  try {
    const doc = JSON.parse(raw) as Partial<SettingsDocument>
    if (typeof doc !== 'object' || doc === null) return clone(DEFAULT_SETTINGS)
    const schema = Number(doc.schema ?? 0)
    if (!Number.isInteger(schema) || schema > SETTINGS_SCHEMA) {
      // A document from a newer app version — forward compatibility: ignore it.
      return clone(DEFAULT_SETTINGS)
    }
    let current = {
      schema,
      data: { ...(doc.data as Partial<LearnerProfile>) },
    } as SettingsDocument
    // Run the migration chain up to the current schema.
    for (let v = current.schema; v < SETTINGS_SCHEMA; v++) {
      const step = migrations[v + 1]
      if (step) current = step(current)
    }
    const merged: LearnerProfile = { ...DEFAULT_SETTINGS, ...current.data }
    // Persist the migrated value back.
    writeSettings(merged)
    return merged
  } catch {
    return clone(DEFAULT_SETTINGS)
  }
}

export function writeSettings(data: LearnerProfile): { ok: boolean; error: string | null } {
  try {
    const doc: SettingsDocument = { schema: SETTINGS_SCHEMA, data }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(doc))
    return { ok: true, error: null }
  } catch (err) {
    // Quota or private-mode failure: never throw into the UI, report back.
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function updateSettings(patch: SettingsPatch): { ok: boolean; error: string | null } {
  return writeSettings({ ...readSettings(), ...patch })
}

export function validateInterfaceLanguage(v: string): InterfaceLanguage {
  return v === 'de' ? 'de' : 'en'
}

export function validateTheme(v: string): ThemeOption {
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
}