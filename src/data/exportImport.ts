import type { Session, Turn, Illustration } from '@/domain/types'
import { getDB, STORE, metaSet } from '@/data/db'
import { listSessions, getTurns } from '@/data/sessions'
import { getIllustrationsBySession } from '@/data/media'

/**
 * Export / import (T064, T065; storage-export.md §4-6).
 *
 * - Export: one versioned JSON envelope, assembled from chunked `BlobPart`s (one
 *   `JSON.stringify` per session) so the whole file is never one giant in-memory string.
 * - Import: size cap, format/version validation, migration chain, a warning that names the
 *   affected conversations, then a replace over all four stores in ONE transaction.
 * - The API key, the endpoint and the settings are never part of an export (FR-022).
 */

export const EXPORT_FORMAT = 'embrollado.export'
export const EXPORT_VERSION = 1
export const MAX_IMPORT_BYTES = 250 * 1024 * 1024

export interface ExportSession {
  id: string
  schema: number
  title: string
  language: string
  level: Session['level']
  situation: Session['situation']
  partner: Session['partner']
  learnerName: string | null
  state: Session['state']
  createdAt: string
  updatedAt: string
  turns: ExportTurn[]
  images?: ExportImage[]
}

export interface ExportTurn {
  position: number
  partnerText: string
  translation: string
  explanation: string | null
  learnerText: string | null
  correctedText: string | null
  interpretation: string | null
  assumptions: Turn['assumptions']
  badge: Turn['badge']
  issues: Turn['issues']
  explain: Turn['explain']
  feedbackLanguage: string
  createdAt: string
}

export interface ExportImage {
  id: string
  sessionId: string
  turnId: string | null
  moment: Illustration['moment']
  mimeType: string
  bytes: string // base64
}

export interface ExportDoc {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  app: { name: string; schema: number }
  sessions: ExportSession[]
}

function toExportTurn(turn: Turn): ExportTurn {
  return {
    position: turn.position,
    partnerText: turn.partnerText,
    translation: turn.translation,
    explanation: turn.explanation,
    learnerText: turn.learnerText,
    correctedText: turn.correctedText,
    interpretation: turn.interpretation,
    assumptions: turn.assumptions,
    badge: turn.badge,
    issues: turn.issues,
    explain: turn.explain,
    feedbackLanguage: turn.feedbackLanguage,
    createdAt: turn.createdAt,
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** Assemble one session record (without pictures) for the envelope. */
export async function buildExportSessions(includePictures: boolean): Promise<ExportSession[]> {
  const sessions = await listSessions()
  const out: ExportSession[] = []
  for (const session of sessions) {
    const turns = await getTurns(session.id)
    const record: ExportSession = {
      id: session.id,
      schema: 1,
      title: session.title,
      language: session.language,
      level: session.level,
      situation: session.situation,
      partner: session.partner,
      learnerName: session.learnerName,
      state: session.state,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turns: turns.map(toExportTurn),
    }
    if (includePictures) {
      const illustrations = await getIllustrationsBySession(session.id)
      record.images = []
      for (const illu of illustrations) {
        record.images.push({
          id: illu.id,
          sessionId: illu.sessionId,
          turnId: illu.turnId,
          moment: illu.moment,
          mimeType: illu.mimeType,
          bytes: await blobToBase64(illu.bytes),
        })
      }
    }
    out.push(record)
  }
  return out
}

/** Build the export Blob from chunked parts so peak memory stays around one session (D8). */
export async function createExportBlob(opts: { includePictures?: boolean } = {}): Promise<Blob> {
  const sessions = await buildExportSessions(opts.includePictures === true)
  const header: Omit<ExportDoc, 'sessions'> = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: 'embrollado', schema: 1 },
  }
  const parts: BlobPart[] = []
  parts.push(`${JSON.stringify(header).slice(0, -1)},"sessions":[`)
  for (let i = 0; i < sessions.length; i++) {
    if (i > 0) parts.push(',')
    parts.push(JSON.stringify(sessions[i]))
  }
  parts.push(']}')
  return new Blob(parts, { type: 'application/json' })
}

/** `embrollado-export-YYYY-MM-DD-HHmm.json` — no `:` (Windows-safe). */
export function exportDownloadName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `embrollado-export-${stamp}.json`
}

/* ------------------------------------------------------------------ */
/* Migration chain                                                     */
/* ------------------------------------------------------------------ */

export const migrations: Record<number, (doc: ExportDoc) => ExportDoc> = {
  // 1 → 2: add "learnerName" to every session — reserved for the next breaking change.
}

export function migrateExportDoc(doc: ExportDoc): ExportDoc {
  let current = doc
  for (let v = doc.version; v < EXPORT_VERSION; v++) {
    const step = migrations[v + 1]
    if (step) current = step(current)
  }
  return current
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export type ImportErrorKind = 'bad-file' | 'too-large' | 'newer-version' | 'unknown'

export interface ImportValidation {
  ok: boolean
  error?: ImportErrorKind
  doc?: ExportDoc
  sessionCount: number
  /** Sessions whose id already exists on this device → will overwrite. */
  existingIds: string[]
}

export async function validateImportText(text: string): Promise<ImportValidation> {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'too-large', sessionCount: 0, existingIds: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'bad-file', sessionCount: 0, existingIds: [] }
  }
  const doc = parsed as Partial<ExportDoc>
  if (
    typeof doc !== 'object' ||
    doc === null ||
    doc.format !== EXPORT_FORMAT ||
    !Number.isInteger(doc.version) ||
    (doc.version as number) < 1 ||
    !Array.isArray(doc.sessions)
  ) {
    return { ok: false, error: 'bad-file', sessionCount: 0, existingIds: [] }
  }
  if ((doc.version as number) > EXPORT_VERSION) {
    return { ok: false, error: 'newer-version', sessionCount: doc.sessions.length, existingIds: [] }
  }
  const migrated = migrateExportDoc(doc as ExportDoc)
  if (migrated.sessions.some((s) => typeof s.id !== 'string' || s.id.length === 0)) {
    return { ok: false, error: 'bad-file', sessionCount: 0, existingIds: [] }
  }

  const db = await getDB()
  const existing: string[] = []
  const turnStore = db.transaction(STORE.sessions).objectStore(STORE.sessions)
  for (const s of migrated.sessions) {
    const found = (await turnStore.getKey(s.id)) !== undefined
    if (found) existing.push(s.id)
  }
  return { ok: true, doc: migrated, sessionCount: migrated.sessions.length, existingIds: existing }
}

export interface ImportResult {
  count: number
  replaced: string[]
}

function toStoredTurn(exportTurn: ExportTurn, sessionId: string, language: string): Turn {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    sessionId,
    position: exportTurn.position,
    partnerText: exportTurn.partnerText,
    partnerTextLanguage: language,
    translation: exportTurn.translation,
    explanation: exportTurn.explanation,
    learnerText: exportTurn.learnerText,
    correctedText: exportTurn.correctedText,
    interpretation: exportTurn.interpretation,
    assumptions: exportTurn.assumptions,
    badge: exportTurn.badge,
    issues: exportTurn.issues,
    explain: exportTurn.explain,
    illustrationId: null,
    audioId: null,
    createdAt: exportTurn.createdAt || now,
    feedbackLanguage: exportTurn.feedbackLanguage,
  }
}

function toStoredSession(exportSession: ExportSession): Session {
  return {
    id: exportSession.id,
    title: exportSession.title,
    language: exportSession.language,
    level: exportSession.level,
    situation: exportSession.situation,
    partner: exportSession.partner,
    learnerName: exportSession.learnerName,
    state: exportSession.state,
    createdAt: exportSession.createdAt,
    updatedAt: exportSession.updatedAt,
    turnCount: exportSession.turns.length,
    lastTurnAt: exportSession.turns.length
      ? exportSession.turns[exportSession.turns.length - 1].createdAt
      : null,
  }
}

/**
 * Replace the device's conversations with the file's — one transaction (FR-054).
 * Illustrations from `images` are imported; cached audio is never exported so none is touched.
 */
export async function importSessions(doc: ExportDoc): Promise<ImportResult> {
  const db = await getDB()
  const replaced: string[] = []
  const tx = db.transaction(
    [STORE.sessions, STORE.turns, STORE.illustrations, STORE.audio],
    'readwrite',
  )

  // Clear the four stores in the same transaction.
  await Promise.all([
    tx.objectStore(STORE.sessions).clear(),
    tx.objectStore(STORE.turns).clear(),
    tx.objectStore(STORE.illustrations).clear(),
    tx.objectStore(STORE.audio).clear(),
  ])

  const imageById = new Map<string, ExportImage>()
  for (const s of doc.sessions) {
    for (const img of s.images ?? []) imageById.set(img.id, img)
  }

  for (const exportSession of doc.sessions) {
    const existing = (await tx.objectStore(STORE.sessions).getKey(exportSession.id)) !== undefined
    if (existing) replaced.push(exportSession.title)
    await tx.objectStore(STORE.sessions).put(toStoredSession(exportSession))

    for (const exportTurn of exportSession.turns) {
      const stored = toStoredTurn(exportTurn, exportSession.id, exportSession.language)
      await tx.objectStore(STORE.turns).put(stored)
    }

    // Imported pictures are restored as Illustration records (storage-export.md §4).
    for (const img of exportSession.images ?? []) {
      const bytes = Uint8Array.from(atob(img.bytes), (c) => c.charCodeAt(0))
      const illustration: Illustration = {
        id: img.id,
        sessionId: img.sessionId,
        turnId: img.turnId,
        moment: img.moment,
        prompt: '',
        mimeType: img.mimeType,
        bytes: new Blob([bytes as BlobPart], { type: img.mimeType }),
        width: 0,
        height: 0,
        createdAt: new Date().toISOString(),
      }
      await tx.objectStore(STORE.illustrations).put(illustration)
    }
  }

  await tx.done
  await metaSet('embrollado:lastImportAt', new Date().toISOString())
  return { count: doc.sessions.length, replaced }
}
