import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  readSettings,
  updateSettings,
  writeSettings,
  SETTINGS_KEY,
} from '@/data/settings'

describe('settings store (T070, T019)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is stored', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('persists and reads back a patch', () => {
    updateSettings({ name: 'Sam', cachedSpeechLines: 5 })
    const read = readSettings()
    expect(read.name).toBe('Sam')
    expect(read.cachedSpeechLines).toBe(5)
    expect(read.theme).toBe('auto')
  })

  it('migrates an older schema on read and writes it back', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ schema: 1, data: { ...DEFAULT_SETTINGS, interfaceLanguage: 'de' } }),
    )
    const read = readSettings()
    expect(read.interfaceLanguage).toBe('de')
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    expect(stored.schema).toBe(1)
  })

  it('ignores a document from a newer app version (forward compatibility)', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ schema: 99, data: { interfaceLanguage: 'de', secret: 'x' } }),
    )
    expect(readSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('swallows quota failures and reports them instead of throwing', () => {
    // Simulate a private-mode localStorage by replacing setItem on the instance.
    Object.defineProperty(localStorage, 'setItem', {
      value: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      },
      configurable: true,
    })
    const result = writeSettings(DEFAULT_SETTINGS)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
