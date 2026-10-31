import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_KEY, grantAccess, readAccessGrant } from '@/data/access'

/**
 * Access-granted marker (build/dev.commit-5): stored only after a valid code was entered, under
 * the app-prefixed localStorage key `embrollado.access.v1`; storage failures are surfaced instead
 * of thrown. Tests stay deterministic (localStorage is reset per test, never the network).
 */
describe('access marker', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is false before any code was entered', () => {
    expect(getStoredKey()).toBeNull()
    expect(readAccessGrant()).toBe(false)
  })

  it('stores the marker under the app-prefixed key after a valid code', () => {
    const result = grantAccess()
    expect(result.ok).toBe(true)
    expect(localStorage.getItem(ACCESS_KEY)).not.toBeNull()
    expect(getStoredKey()).toBe('embrollado.access.v1')
    expect(readAccessGrant()).toBe(true)
  })

  it('tolerates a malformed stored document', () => {
    localStorage.setItem(ACCESS_KEY, 'not json')
    expect(readAccessGrant()).toBe(false)
  })

  it('returns false when the document denies the grant', () => {
    localStorage.setItem(ACCESS_KEY, JSON.stringify({ granted: false }))
    expect(readAccessGrant()).toBe(false)
  })

  it('reports a storage failure instead of throwing', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const result = grantAccess()
    vi.restoreAllMocks()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/denied/)
    // A failed write must not be observable as granted.
    expect(readAccessGrant()).toBe(false)
  })
})

function getStoredKey(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) return key
  }
  return null
}
