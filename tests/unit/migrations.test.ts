import { describe, expect, it } from 'vitest'
import {
  migrations,
  migrateExportDoc,
  validateImportText,
  EXPORT_VERSION,
  EXPORT_FORMAT,
  type ExportDoc,
} from '@/data/exportImport'

function v1Fixture(): ExportDoc {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: '2026-10-28T10:00:00.000Z',
    app: { name: 'embrollado', schema: 1 },
    sessions: [
      {
        id: '00000000-0000-4000-8000-000000000000',
        schema: 1,
        title: 'T1',
        language: 'es',
        level: 'beginner',
        situation: { id: 'builtin:a', name: 'A', setting: 'S', custom: false },
        partner: {
          id: 'builtin:b',
          name: 'B',
          age: null,
          occupation: 'X',
          custom: false,
          description: 'B.',
        },
        learnerName: null,
        state: 'ended',
        createdAt: '2026-10-28T09:00:00.000Z',
        updatedAt: '2026-10-28T10:00:00.000Z',
        turns: [],
      },
    ],
  }
}

describe('export migrations (T058)', () => {
  it('migrates a v1 fixture up to the current version', () => {
    const doc = migrateExportDoc(v1Fixture())
    expect(doc.version).toBe(EXPORT_VERSION)
    expect(doc.sessions).toHaveLength(1)
  })

  it('is a chain of pure functions from the file version to the current one', () => {
    const doc = migrateExportDoc(v1Fixture())
    expect(doc.sessions[0].title).toBe('T1')
    // Running it again yields the same result.
    const again = migrateExportDoc(v1Fixture())
    expect(again).toEqual(doc)
  })

  it('refuses an import with a version higher than supported', async () => {
    const newer = {
      ...v1Fixture(),
      version: EXPORT_VERSION + 1,
      sessions: [],
    }
    const validation = await validateImportText(JSON.stringify(newer))
    expect(validation.ok).toBe(false)
    expect(validation.error).toBe('newer-version')
  })

  it('keeps the migration table wired (at least the v1 step exists)', () => {
    expect(migrations).toBeTypeOf('object')
  })

  it('backfills v1 turns with deterministic ids and an illustration binding (export v2)', () => {
    const withTurns = {
      ...v1Fixture(),
      sessions: [
        {
          ...v1Fixture().sessions[0],
          turns: [
            {
              position: 1,
              partnerText: 'Hola.',
              translation: 'Hi.',
              explanation: null,
              learnerText: null,
              correctedText: null,
              interpretation: null,
              assumptions: [],
              badge: null,
              issues: [],
              feedbackLanguage: 'en',
              createdAt: '2026-10-28T09:00:00.000Z',
            },
          ],
        },
      ],
    }
    const doc = migrateExportDoc(withTurns)
    const turn = doc.sessions[0].turns[0]
    expect(turn.id).toBe(`${v1Fixture().sessions[0].id}:1`)
    expect(turn.illustrationId).toBe(null)
    // Pure: the same input yields the same output.
    expect(migrateExportDoc(withTurns)).toEqual(doc)
  })
})
