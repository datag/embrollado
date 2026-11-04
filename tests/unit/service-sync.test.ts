import { beforeEach, describe, expect, it } from 'vitest'
import { useServiceConfig, useSettings, reloadService } from '@/composables/useSettings'
import { DEFAULT_SERVICE, SERVICE_KEY, readService } from '@/data/profile'

/**
 * The reactive service singleton stays in sync with the document in localStorage (T127 follow-up:
 * "a localStorage write only takes effect after a reload"). `reloadService()` re-reads the
 * document explicitly, and the `storage` event reloads it automatically when another tab of the
 * same browser profile changes it — so a tab never keeps a stale configuration nor overwrites the
 * other tab's edit with its old copy on the next update.
 */

function writeDoc(patch: Partial<typeof DEFAULT_SERVICE>) {
  localStorage.setItem(
    SERVICE_KEY,
    JSON.stringify({ schema: 1, data: { ...DEFAULT_SERVICE, ...patch } }),
  )
}

describe('service configuration sync across tabs (useServiceConfig)', () => {
  beforeEach(() => {
    localStorage.clear()
    writeDoc({}) // put a known document in place
    // The singleton is module-scoped — re-sync it to the fresh document so tests stay isolated.
    reloadService()
  })

  it('reloadService picks up a document written externally', () => {
    const { service } = useServiceConfig()
    expect(service.baseUrl).toBe(DEFAULT_SERVICE.baseUrl)

    writeDoc({ baseUrl: 'http://localhost:8787/v1', chatModel: 'mock-chat' })
    reloadService()
    expect(service.baseUrl).toBe('http://localhost:8787/v1')
    expect(service.chatModel).toBe('mock-chat')
  })

  it('a storage event for the service key reloads the singleton', () => {
    const { service } = useServiceConfig()
    writeDoc({ chatModel: 'mock-streaming-chat' })
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SERVICE_KEY,
        newValue: localStorage.getItem(SERVICE_KEY),
      }),
    )
    expect(service.chatModel).toBe('mock-streaming-chat')
  })

  it('a storage clear (key === null) also reloads the singleton', () => {
    const { service } = useServiceConfig()
    localStorage.clear()
    writeDoc({ authMode: 'api-key' })
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(service.authMode).toBe('api-key')
  })

  it('an unrelated storage event leaves the singleton untouched', () => {
    const { service } = useServiceConfig()
    expect(service.chatModel).toBe(DEFAULT_SERVICE.chatModel)
    writeDoc({ chatModel: 'other' })
    window.dispatchEvent(new StorageEvent('storage', { key: 'embrollado.settings.v1' }))
    // The settings key is not the service key — nothing reloads, the wipe stays invisible.
    expect(service.chatModel).toBe(DEFAULT_SERVICE.chatModel)
  })

  it('update persists and the stored document round-trips through readService', () => {
    const { update } = useServiceConfig()
    const result = update({
      baseUrl: 'http://localhost:8787/v1',
      authMode: 'api-key',
      chatModel: 'mock-chat',
    })
    expect(result.ok).toBe(true)
    expect(readService()).toMatchObject({
      baseUrl: 'http://localhost:8787/v1',
      authMode: 'api-key',
      chatModel: 'mock-chat',
    })
  })

  it('explicit reloadService is a no-op when the document is unchanged', () => {
    const { service } = useServiceConfig()
    const before = { ...service }
    reloadService()
    expect(service).toEqual(before)
  })

  it('keeps useSettings intact (the settings singleton is separate)', () => {
    const { settings, update } = useSettings()
    update({ name: 'Sam' })
    expect(settings.name).toBe('Sam')
    const { service } = useServiceConfig()
    expect(service.chatModel).toBe(DEFAULT_SERVICE.chatModel)
  })
})
