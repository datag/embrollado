import { describe, expect, it } from 'vitest'
import { createSession, saveTurn, listSessions, getTurns } from '@/data/sessions'
import {
  createExportBlob,
  exportDownloadName,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  validateImportText,
  importSessions,
  type ExportDoc,
} from '@/data/exportImport'
import { createOpeningTurn } from '@/domain/session'
import type { Session } from '@/domain/types'

async function seedSession(): Promise<Session> {
  const session = await createSession({
    language: 'es',
    level: 'intermediate',
    situation: {
      id: 'builtin:bakery-queue',
      name: 'In the bakery queue',
      setting: 'You are queuing at a bakery.',
      custom: false,
    },
    partner: {
      id: 'builtin:nicole',
      name: 'Nicole',
      age: 38,
      gender: 'female',
      occupation: 'confectioner',
      custom: false,
      description: 'A confectioner.',
    },
    options: { knowsLearner: false },
  })
  const opening = createOpeningTurn(session, 'Hola, ¿qué tal?', 'Hi, how are you?', null, 'en')
  // An on-demand picture bound to this turn — the round trip must keep both the turn id and
  // the illustration binding stable (export v2).
  opening.illustrationId = 'illustration:1'
  await saveTurn(opening)
  return session
}

describe('export envelope (T057, T064)', () => {
  it('produces the embrollado.export magic with an integer version', async () => {
    await seedSession()
    const blob = await createExportBlob()
    const doc = JSON.parse(await blob.text()) as ExportDoc
    expect(doc.format).toBe(EXPORT_FORMAT)
    expect(Number.isInteger(doc.version)).toBe(true)
    expect(doc.version).toBe(EXPORT_VERSION)
    expect(doc.app.name).toBe('embrollado')
  })

  it('never contains the API key or the service configuration', async () => {
    await seedSession()
    const blob = await createExportBlob()
    const text = await blob.text()
    expect(text).not.toContain('sk-')
    expect(text).not.toContain('baseUrl')
    expect(text).not.toContain('apiKey')
  })

  it('round-trips a session with its turn', async () => {
    const session = await seedSession()
    const blob = await createExportBlob()
    const doc = JSON.parse(await blob.text()) as ExportDoc
    expect(doc.sessions).toHaveLength(1)
    const exported = doc.sessions[0]
    expect(exported.id).toBe(session.id)
    expect(exported.turns).toHaveLength(1)
    expect(exported.turns[0].position).toBe(1)
    expect(exported.turns[0].partnerText).toBe('Hola, ¿qué tal?')
  })

  it('keeps the turn id and the on-demand illustration binding stable across a round trip', async () => {
    await seedSession()
    const blob = await createExportBlob()
    const doc = JSON.parse(await blob.text()) as ExportDoc
    const firstTurnId = doc.sessions[0].turns[0].id

    await importSessions(doc)
    const restored = (await listSessions())[0]
    const turns = await getTurns(restored.id)
    expect(turns).toHaveLength(1)
    expect(turns[0].id).toBe(firstTurnId)
    expect(turns[0].illustrationId).toBe('illustration:1')

    // Re-exporting keeps the same ids — the picture binding survives repeated round trips.
    const again = await createExportBlob()
    const second = JSON.parse(await again.text()) as ExportDoc
    expect(second.sessions[0].turns[0].id).toBe(firstTurnId)
    expect(second.sessions[0].turns[0].illustrationId).toBe('illustration:1')
  })

  it('round-trips the per-session conversation options (export v3)', async () => {
    await createSession({
      language: 'es',
      level: 'intermediate',
      situation: {
        id: 'builtin:phone-call',
        name: 'On the phone',
        setting: 'You are on the phone.',
        custom: false,
      },
      partner: {
        id: 'builtin:nicole',
        name: 'Nicole',
        age: 38,
        gender: 'female',
        occupation: 'confectioner',
        custom: false,
        description: 'A confectioner.',
      },
      options: { knowsLearner: true },
    })
    const blob = await createExportBlob()
    const doc = JSON.parse(await blob.text()) as ExportDoc
    expect(doc.sessions[0].options).toEqual({ knowsLearner: true })

    await importSessions(doc)
    const restored = (await listSessions())[0]
    expect(restored.options).toEqual({ knowsLearner: true })
  })

  it('names the file Windows-safe without colons', () => {
    const name = exportDownloadName(new Date(2026, 9, 28, 14, 5))
    expect(name).toMatch(/^embrollado-export-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
    expect(name).not.toContain(':')
  })
})

describe('import validation (T065)', () => {
  it('refuses a random file', async () => {
    const validation = await validateImportText('{"hello":"world"}')
    expect(validation.ok).toBe(false)
    expect(validation.error).toBe('bad-file')
  })

  it('refuses a version newer than the app supports', async () => {
    const text = JSON.stringify({
      format: 'embrollado.export',
      version: 999,
      sessions: [],
    })
    const validation = await validateImportText(text)
    expect(validation.ok).toBe(false)
    expect(validation.error).toBe('newer-version')
  })

  it('validates a correct document and lists the ids present on the device', async () => {
    const session = await seedSession()
    const blob = await createExportBlob()
    const validation = await validateImportText(await blob.text())
    expect(validation.ok).toBe(true)
    expect(validation.sessionCount).toBe(1)
    expect(validation.existingIds).toContain(session.id)
  })

  it('replaces the conversations after validation', async () => {
    await seedSession()
    const blob = await createExportBlob()
    const doc = JSON.parse(await blob.text()) as ExportDoc
    const result = await importSessions(doc)
    expect(result.count).toBe(1)
    const sessions = await listSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe(doc.sessions[0].id)
  })
})
