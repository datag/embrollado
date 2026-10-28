import type { AuthMode, Persona, ServiceConfig, Situation } from '@/domain/types'
import { getDB, STORE } from '@/data/db'

/**
 * Service configuration + learner-defined templates (T020, data-model.md §6).
 *
 * The service document lives in `localStorage` under `embrollado.service.v1` and is **never**
 * part of an export or a log (FR-022, FR-032). Learner-defined templates (saved entries with
 * `visibility: "template"`), which are small and few, live in the IndexedDB meta store under a
 * single key so `localStorage` stays limited to the two small documents.
 */

export const SERVICE_KEY = 'embrollado.service.v1'
export const SERVICE_SCHEMA = 1
const TEMPLATES_META_KEY = 'embrollado:templates'

export const DEFAULT_SERVICE: ServiceConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  authMode: 'bearer',
  chatModel: 'gpt-4o-mini',
  speechModel: null,
  imageModel: null,
  providerProfile: 'openai',
}

export interface ServiceDocument {
  schema: number
  data: ServiceConfig
}

export interface TemplateCollection {
  personas: Persona[]
  situations: Situation[]
}

export function readService(): ServiceConfig {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SERVICE_KEY)
  } catch {
    return { ...DEFAULT_SERVICE }
  }
  if (!raw) return { ...DEFAULT_SERVICE }
  try {
    const doc = JSON.parse(raw) as Partial<ServiceDocument>
    const schema = Number(doc?.schema ?? 0)
    if (!Number.isInteger(schema) || schema > SERVICE_SCHEMA) return { ...DEFAULT_SERVICE }
    return { ...DEFAULT_SERVICE, ...(doc.data as Partial<ServiceConfig>) }
  } catch {
    return { ...DEFAULT_SERVICE }
  }
}

export function writeService(data: ServiceConfig): { ok: boolean; error: string | null } {
  try {
    const doc: ServiceDocument = { schema: SERVICE_SCHEMA, data }
    localStorage.setItem(SERVICE_KEY, JSON.stringify(doc))
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Sanitised service view for in-app display — the key is redacted. */
export function redactService(data: ServiceConfig): ServiceConfig {
  return { ...data, apiKey: '***' }
}

/** Validate an absolute http(s) base URL. */
export function isValidBaseUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateAuthMode(v: string): AuthMode {
  return v === 'x-api-key' || v === 'api-key' ? v : 'bearer'
}

/* ------------------------------------------------------------------ */
/* Learner-defined templates (personas and situations)                 */
/* ------------------------------------------------------------------ */

export async function readTemplates(): Promise<TemplateCollection> {
  const db = await getDB()
  const row = await db.get(STORE.meta, TEMPLATES_META_KEY)
  if (!row?.value) return { personas: [], situations: [] }
  try {
    const parsed = JSON.parse(row.value) as Partial<TemplateCollection>
    return {
      personas: Array.isArray(parsed.personas) ? (parsed.personas as Persona[]) : [],
      situations: Array.isArray(parsed.situations) ? (parsed.situations as Situation[]) : [],
    }
  } catch {
    return { personas: [], situations: [] }
  }
}

export async function writeTemplates(templates: TemplateCollection): Promise<void> {
  const db = await getDB()
  await db.put(STORE.meta, { key: TEMPLATES_META_KEY, value: JSON.stringify(templates) })
}

export async function addPersonaTemplate(persona: Persona): Promise<void> {
  const t = await readTemplates()
  const next = {
    personas: [...t.personas.filter((p) => p.id !== persona.id), persona],
    situations: t.situations,
  }
  await writeTemplates(next)
}

export async function addSituationTemplate(situation: Situation): Promise<void> {
  const t = await readTemplates()
  const next = {
    personas: t.personas,
    situations: [...t.situations.filter((s) => s.id !== situation.id), situation],
  }
  await writeTemplates(next)
}