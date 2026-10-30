import { describe, expect, it } from 'vitest'
import {
  addPersonaTemplate,
  addSituationTemplate,
  readTemplates,
  removePersonaTemplate,
  removeSituationTemplate,
} from '@/data/profile'
import type { Persona, Situation } from '@/domain/types'

function persona(id: string): Persona {
  return {
    id,
    name: `Person ${id}`,
    age: null,
    gender: null,
    occupation: 'occupation',
    description: 'description',
    origin: 'learner',
    visibility: 'template',
    language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function situation(id: string): Situation {
  return {
    id,
    name: `Situation ${id}`,
    setting: 'setting',
    keyMoments: [],
    suggestedPartners: [],
    origin: 'learner',
    visibility: 'template',
    language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('learner-defined templates (FR-045/046/047)', () => {
  it('adds and reads back a persona and a situation template', async () => {
    await addPersonaTemplate(persona('a'))
    await addSituationTemplate(situation('s'))
    const t = await readTemplates()
    expect(t.personas.map((p) => p.id)).toEqual(['a'])
    expect(t.situations.map((s) => s.id)).toEqual(['s'])
  })

  it('replaces an existing template with the same id (id keeps the selection stable)', async () => {
    await addPersonaTemplate(persona('a'))
    await addPersonaTemplate({ ...persona('a'), visibility: 'session-only' })
    const t = await readTemplates()
    expect(t.personas).toHaveLength(1)
    expect(t.personas[0].visibility).toBe('session-only')
  })

  it('removes a template and leaves the other kind untouched', async () => {
    await addPersonaTemplate(persona('a'))
    await addPersonaTemplate(persona('b'))
    await addSituationTemplate(situation('s'))
    await removePersonaTemplate('a')
    const t = await readTemplates()
    expect(t.personas.map((p) => p.id)).toEqual(['b'])
    expect(t.situations).toHaveLength(1)
  })

  it('removing an unknown id is a no-op', async () => {
    await removePersonaTemplate('nope')
    await removeSituationTemplate('nope')
    const t = await readTemplates()
    expect(t.personas).toEqual([])
    expect(t.situations).toEqual([])
  })

  it('serialises concurrent mutations so no entry is lost (regression: the old race)', async () => {
    await Promise.all([
      addPersonaTemplate(persona('a')),
      addPersonaTemplate(persona('b')),
      addPersonaTemplate(persona('c')),
      addSituationTemplate(situation('x')),
      addSituationTemplate(situation('y')),
    ])
    const t = await readTemplates()
    expect(t.personas.map((p) => p.id).sort()).toEqual(['a', 'b', 'c'])
    expect(t.situations.map((s) => s.id).sort()).toEqual(['x', 'y'])
  })

  it('keeps ordering deterministic when adding and removing at the same time', async () => {
    await addPersonaTemplate(persona('a'))
    await addPersonaTemplate(persona('b'))
    await Promise.all([removePersonaTemplate('a'), addPersonaTemplate(persona('c'))])
    const t = await readTemplates()
    expect(t.personas.map((p) => p.id).sort()).toEqual(['b', 'c'])
  })
})
