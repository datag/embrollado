/**
 * Core domain types. Mirror of specs/001-ai-language-roleplay/data-model.md §2.
 */

export type Level = 'beginner' | 'intermediate' | 'expert'
export type SessionState = 'active' | 'ended'
export type BadgeTier = 'perfect' | 'good' | 'acceptable' | 'unsatisfactory'
export type IssueCategory = 'grammar' | 'vocabulary' | 'usage' | 'completeness'
export type ExplanationKind = 'semantics' | 'error' | 'both'
export type IllustrationMoment = 'start' | 'key' | 'end'
export type Origin = 'builtin' | 'learner'
export type Visibility = 'template' | 'session-only'
export type AuthMode = 'bearer' | 'x-api-key' | 'api-key'
export type ThemeOption = 'light' | 'dark' | 'auto'
export type InterfaceLanguage = 'en' | 'de'

/** A situation and partner as they were described when the session started. */
export interface SituationRef {
  id: string
  name: string
  setting: string
  custom: boolean
  /** A snapshot of the situation's illustration moments (FR-028). */
  keyMoments?: string[]
}

export interface PartnerRef {
  id: string
  name: string
  age: number | null
  occupation: string
  custom: boolean
  /** A snapshot of the partner's biography, used to keep role-play in character. */
  description: string
}

export interface Session {
  id: string
  title: string
  language: string
  level: Level
  situation: SituationRef
  partner: PartnerRef
  learnerName: string | null
  state: SessionState
  createdAt: string
  updatedAt: string
  turnCount: number
  lastTurnAt: string | null
}

export interface Assumption {
  original: string
  filled: string
  reason: string
}

export interface Badge {
  tier: BadgeTier
  labelKey: string
  /** Rendered, stored wording — a transcript keeps what the learner saw. */
  label: string
}

export interface Issue {
  category: IssueCategory
  detail: string
  suggestion: string | null
}

export interface Explanation {
  id: string
  turnId: string
  kind: ExplanationKind
  content: string
}

export interface Turn {
  id: string
  sessionId: string
  position: number
  partnerText: string
  partnerTextLanguage: string
  translation: string
  explanation: string | null
  learnerText: string | null
  correctedText: string | null
  interpretation: string | null
  assumptions: Assumption[]
  badge: Badge | null
  issues: Issue[]
  explain: Explanation | null
  illustrationId: string | null
  audioId: string | null
  createdAt: string
  feedbackLanguage: string
}

/** Catalogue entity — a conversation partner. */
export interface Persona {
  id: string
  name: string
  age: number | null
  occupation: string
  description: string
  origin: Origin
  visibility: Visibility
  language: string | null
  createdAt: string | null
}

/** Catalogue entity — a situation to practise in. */
export interface Situation {
  id: string
  name: string
  setting: string
  keyMoments: string[]
  suggestedPartners: string[]
  origin: Origin
  visibility: Visibility
  language: string | null
  createdAt: string | null
}

export interface LearnerProfile {
  name: string
  details: string
  nativeLanguage: string | null
  interfaceLanguage: InterfaceLanguage
  theme: ThemeOption
  speechEnabled: boolean
  illustrationsEnabled: boolean
  cachedSpeechLines: number
}

export interface ServiceConfig {
  baseUrl: string
  apiKey: string
  authMode: AuthMode
  chatModel: string
  speechModel: string | null
  imageModel: string | null
  providerProfile: string
}

export interface Illustration {
  id: string
  sessionId: string
  turnId: string | null
  moment: IllustrationMoment
  prompt: string
  mimeType: string
  bytes: Blob
  width: number
  height: number
  createdAt: string
}

export interface AudioEntry {
  id: string
  sessionId: string
  turnId: string
  text: string
  voice: string
  mimeType: string
  bytes: Blob
  createdAt: string
}

/** Internal, normalised AI failure kind (specs/.../contracts/ai-service.md §6). */
export type AiErrorKind =
  | 'auth'
  | 'permission'
  | 'quota'
  | 'rate_limit'
  | 'bad_request'
  | 'not_found'
  | 'overloaded'
  | 'provider'
  | 'content_filter'
  | 'refusal'
  | 'timeout'
  | 'network'
  | 'cors'
  | 'unknown'

export class AiError extends Error {
  readonly kind: AiErrorKind
  readonly status: number | null
  constructor(kind: AiErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'AiError'
    this.kind = kind
    this.status = status
  }
}