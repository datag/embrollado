import { reactive } from 'vue'
import type { LearnerProfile, ServiceConfig } from '@/domain/types'
import { readSettings, updateSettings, DEFAULT_SETTINGS } from '@/data/settings'
import { readService, writeService, SERVICE_KEY } from '@/data/profile'
import { setInterfaceLanguage } from '@/i18n'

/**
 * Settings composable (T030): reactive state persisted to `embrollado.settings.v1`.
 * Quota/private-mode failures are swallowed with a warning, never thrown into a render.
 * The service document is kept separate and is never exported (T077).
 */

export interface UseSettings {
  settings: LearnerProfile
  update: (patch: Partial<LearnerProfile>) => { ok: boolean; error: string | null }
  reset: () => void
}

const settings = reactive<LearnerProfile>({ ...readSettings() })

setInterfaceLanguage(settings.interfaceLanguage)

function persist(): { ok: boolean; error: string | null } {
  const result = updateSettings({ ...settings })
  if (!result.ok) console.warn('embrollado: could not persist settings.', result.error)
  return result
}

export function useSettings(): UseSettings {
  function update(patch: Partial<LearnerProfile>) {
    Object.assign(settings, patch)
    setInterfaceLanguage(settings.interfaceLanguage)
    return persist()
  }

  function reset() {
    Object.assign(settings, DEFAULT_SETTINGS)
    setInterfaceLanguage(settings.interfaceLanguage)
    return persist()
  }

  return { settings, update, reset }
}

/* ------------------------------------------------------------------ */
/* Service configuration (reactive singleton)                          */
/* ------------------------------------------------------------------ */

const service = reactive<ServiceConfig>({ ...readService() })

/**
 * Re-read the service document from localStorage into the singleton. Needed after an external
 * write — in particular a change made in another tab of the same browser profile, which arrives
 * as a `storage` event. Without it, a stale tab would keep using its old configuration and would
 * overwrite the other tab's edit with its stale copy on the next update (last-writer-wins on the
 * whole document).
 */
export function reloadService() {
  Object.assign(service, readService())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // A `storage` event fires in every OTHER tab of the same origin (never in the one that
    // changed the value). `key === null` covers `localStorage.clear()`. No tab is touched by its
    // own write, so there is no loop.
    if (event.key === SERVICE_KEY || event.key === null) reloadService()
  })
}

export function useServiceConfig() {
  function update(patch: Partial<ServiceConfig>) {
    Object.assign(service, patch)
    const result = writeService({ ...service })
    if (!result.ok) console.warn('embrollado: could not persist service config.', result.error)
    return result
  }
  return { service, update }
}

export function reloadSettings() {
  Object.assign(settings, readSettings())
  setInterfaceLanguage(settings.interfaceLanguage)
}
