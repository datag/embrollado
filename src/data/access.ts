/**
 * Local "access granted" marker for the optional build-time access code (APP_ACCESS_CODE, see
 * src/config/app.ts). Once a valid code was entered, the marker is stored under the app-prefixed
 * key `embrollado.access.v1` so the prompt is not shown again on later visits.
 *
 * Storage failures (private mode, quota) never throw into the UI: a failed write means the code
 * only unlocks the current session, a failed read falls back to "not granted".
 */

export const ACCESS_KEY = 'embrollado.access.v1'

export interface AccessDocument {
  granted: boolean
  at: string
}

export function readAccessGrant(): boolean {
  try {
    const raw = localStorage.getItem(ACCESS_KEY)
    if (!raw) return false
    const doc = JSON.parse(raw) as Partial<AccessDocument>
    return doc?.granted === true
  } catch {
    return false
  }
}

export function grantAccess(): { ok: boolean; error: string | null } {
  try {
    const doc: AccessDocument = { granted: true, at: new Date().toISOString() }
    localStorage.setItem(ACCESS_KEY, JSON.stringify(doc))
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
