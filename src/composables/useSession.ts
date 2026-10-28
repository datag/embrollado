import { ref, shallowRef, type Ref } from 'vue'
import type { Session, Turn, Illustration, AudioEntry } from '@/domain/types'
import {
  createSession,
  endSession as endSessionStore,
  getSession,
  getTurns,
  saveTurn,
  updateTurn,
  type NewSessionInput,
} from '@/data/sessions'
import { assembleFeedback, createOpeningTurn } from '@/domain/session'
import {
  buildSystemPrompt,
  buildTurnUserMessage,
  buildExplanationMessages,
  buildIllustrationPrompt,
} from '@/ai/prompts'
import { TURN_SCHEMA } from '@/ai/schema'
import {
  chatCompletion,
  growingStringValue,
  parseLooseJson,
  requestExplanation,
  requestImage,
  requestSpeech,
} from '@/ai/aiService'
import { profileById } from '@/ai/providers'
import { useServiceConfig, useSettings } from '@/composables/useSettings'
import { saveIllustration, saveAudio, getAudioForTurn, findAudioByText } from '@/data/media'

/**
 * The turn cycle (T041; FR-006…FR-014). One API call returns the partner's next line AND the
 * feedback on the learner's last answer, so the dialogue runs partner-line → answer → feedback →
 * partner-line. The partner's line is streamed progressively; the feedback appears as one block
 * when the stream completes (FR-035, D15).
 */

export type TurnPhase =
  'idle' | 'partner-streaming' | 'waiting-answer' | 'generating' | 'explaining' | 'failed'

export interface SessionError {
  kind: string
  message: string
}

export interface UseSessionReturn {
  session: Ref<Session | null>
  turns: Ref<Turn[]>
  phase: Ref<TurnPhase>
  partnerProgress: Ref<string>
  error: Ref<SessionError | null>
  speechAvailable: Ref<boolean>
  imagesAvailable: Ref<boolean>
  load: (id: string) => Promise<void>
  start: (input: NewSessionInput) => Promise<string>
  sendAnswer: (text: string) => Promise<void>
  endSession: () => Promise<void>
  explainTurn: (turn: Turn) => Promise<void>
  playTurn: (turn: Turn) => Promise<{ ok: boolean; message: string | null }>
  retry: () => Promise<void>
}

const lastBadgeIndexByTier = new Map<string, number>()

function feedbackLanguage(): string {
  const { settings } = useSettings()
  return settings.nativeLanguage ?? settings.interfaceLanguage
}

export function useSession(): UseSessionReturn {
  const session = ref<Session | null>(null)
  // shallowRef: the stored Turn objects stay plain (a deep reactive proxy cannot be written to
  // IndexedDB — structured clone rejects proxies). The list is reassigned on every change, which
  // keeps the UI reactive.
  const turns = shallowRef<Turn[]>([])
  const phase = ref<TurnPhase>('idle')
  const partnerProgress = ref('')
  const error = ref<SessionError | null>(null)
  const speechAvailable = ref(true)
  const imagesAvailable = ref(true)
  // Per-session AI chat history: the system prompt + the turns so far.
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  let lastHandle: Turn | null = null

  function clearMessages() {
    messages.length = 0
  }

  async function buildSystemPromptFor(sessionValue: Session): Promise<string> {
    const { settings } = useSettings()
    return buildSystemPrompt({
      partner: sessionValue.partner,
      situation: sessionValue.situation,
      level: sessionValue.level,
      targetLanguage: sessionValue.language,
      feedbackLanguage: settings.nativeLanguage ?? settings.interfaceLanguage,
      learnerName: settings.name || null,
      learnerDetails: settings.details || null,
    })
  }

  function handleError(err: unknown) {
    const { service } = useServiceConfig()
    if (err && typeof err === 'object' && 'kind' in err) {
      const kind = (err as SessionError).kind
      if (kind === 'not-configured') {
        error.value = { kind, message: 'serviceNotConfigured' }
        return
      }
    }
    const ae = err as { kind?: string; message?: string }
    if (ae?.kind === 'cors') {
      const profile = profileById(service.providerProfile)
      error.value = { kind: 'cors', message: profile.corsHint ?? '' }
      return
    }
    error.value = {
      kind: ae?.kind ?? 'unknown',
      message: ae?.message ?? String(err),
    }
  }

  /** One API call: returns the parsed turn JSON and the raw streamed text. */
  async function requestTurn(
    learnerText: string | null,
    onDelta: (data: string) => void,
  ): Promise<Record<string, unknown>> {
    const { service } = useServiceConfig()
    if (!service.chatModel)
      throw { kind: 'not-configured', message: 'serviceNotConfigured' } as SessionError
    if (messages.length === 0) return {}
    const userMessage = buildTurnUserMessage(learnerText)
    const result = await chatCompletion({
      service,
      messages: [...messages, userMessage],
      schema: {
        name: 'embrollado_turn',
        schema: TURN_SCHEMA as unknown as Record<string, unknown>,
      },
      stream: true,
      onDelta,
    })
    if (result.refusal) throw { kind: 'refusal', message: result.refusal } as SessionError
    messages.push(userMessage, { role: 'assistant', content: result.content })
    return (parseLooseJson(result.content) ?? {}) as Record<string, unknown>
  }

  /** Open a session and produce the partner's first line. */
  async function startInitialTurn() {
    const s = session.value
    if (!s) return
    phase.value = 'partner-streaming'
    partnerProgress.value = ''
    error.value = null
    clearMessages()
    messages.push({ role: 'system', content: await buildSystemPromptFor(s) })

    let acc = ''
    const parsed = await requestTurn(null, (data) => {
      acc += data
      partnerProgress.value = growingStringValue(acc, 'partnerText')
    })
    const opening = createOpeningTurn(
      s,
      typeof parsed.partnerText === 'string' ? parsed.partnerText : '',
      typeof parsed.translation === 'string' ? parsed.translation : '',
      typeof parsed.explanation === 'string' ? parsed.explanation : null,
      feedbackLanguage(),
    )
    await saveTurn(opening)
    turns.value = await getTurns(s.id)
    lastHandle = opening
    phase.value = 'waiting-answer'
    await generateIllustration(s)
  }

  async function sendAnswer(input: string) {
    const s = session.value
    const text = input.trim()
    if (!s || !text || (phase.value !== 'waiting-answer' && phase.value !== 'failed')) return
    phase.value = 'generating'
    partnerProgress.value = ''
    error.value = null

    let acc = ''
    try {
      const parsed = await requestTurn(text, (data) => {
        acc += data
        partnerProgress.value = growingStringValue(acc, 'partnerText')
      })
      const { settings } = useSettings()
      const previousBadgeIndex = lastBadgeIndexByTier.get(s.id) ?? 0
      const feedback = assembleFeedback(parsed, {
        learnerText: text,
        locale: settings.interfaceLanguage,
        previousBadgeIndex,
      })
      lastBadgeIndexByTier.set(s.id, feedback.badgeIndex)

      const now = new Date().toISOString()
      const turn: Turn = {
        id: crypto.randomUUID(),
        sessionId: s.id,
        position: turns.value.length + 1, // 1-based, consecutive after the stored turns (T038)
        partnerText: typeof parsed.partnerText === 'string' ? parsed.partnerText : '',
        partnerTextLanguage: s.language,
        translation: feedback.translation,
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : null,
        learnerText: text,
        correctedText: feedback.correctedText,
        interpretation: feedback.interpretation,
        assumptions: feedback.assumptions,
        badge: feedback.badge,
        issues: feedback.issues,
        explain: null,
        illustrationId: null,
        audioId: null,
        createdAt: now,
        feedbackLanguage: feedbackLanguage(),
      }
      await saveTurn(turn)
      turns.value = await getTurns(s.id)
      lastHandle = turn
      phase.value = 'waiting-answer'
      // Manuell nachbestellte Bilder gibt es nur für den Start der Konversation — nicht für jeden
      // Turn (owner-Anforderung). Illustrationen bleiben für importierte Sessions lesbar.
    } catch (err) {
      phase.value = 'failed'
      handleError(err)
    }
  }

  /**
   * An illustration for the start of the session (owner: one picture per conversation, not per
   * turn). Exported conversations with pictures stay readable per turn in the transcript.
   */
  async function generateIllustration(s: Session) {
    const { settings } = useSettings()
    if (!settings.illustrationsEnabled || !imagesAvailable.value) return
    const { service } = useServiceConfig()
    if (!service.imageModel) return

    const momentDescription = `at the start of ${s.situation.name}`
    const prompt = buildIllustrationPrompt(s.situation, momentDescription)
    let res
    try {
      res = await requestImage(service, prompt)
    } catch {
      return // a failing image service never interrupts (FR-030)
    }
    if (!res.ok) {
      if (res.unsupported) imagesAvailable.value = false
      return
    }
    const illustration: Illustration = {
      id: crypto.randomUUID(),
      sessionId: s.id,
      // A situation picture, not attached to a turn: it is shown in the start panel only, so a
      // per-turn image never duplicates it.
      turnId: null,
      moment: 'start',
      prompt,
      mimeType: res.mimeType,
      bytes: new Blob([res.bytes as BlobPart], { type: res.mimeType }),
      width: 0,
      height: 0,
      createdAt: new Date().toISOString(),
    }
    try {
      const saved = await saveIllustration(illustration)
      if (saved.ok) {
        turns.value = await getTurns(s.id)
      }
    } catch {
      /* storage failure is surfaced to the learner via the UI, never thrown */
    }
  }

  async function explainTurn(turn: Turn) {
    const s = session.value
    if (!s || turn.explain) return
    phase.value = 'explaining'
    error.value = null
    try {
      const systemPrompt = await buildSystemPromptFor(s)
      const turnJson = JSON.stringify(turnAsModel(turn))
      const requestMessages = buildExplanationMessages(systemPrompt, turnJson)
      const { service } = useServiceConfig()
      const result = await requestExplanation(service, requestMessages)
      turn.explain = {
        id: crypto.randomUUID(),
        turnId: turn.id,
        kind: result.kind as 'semantics' | 'error' | 'both',
        content: result.content,
      }
      await updateTurn(turn)
      turns.value = await getTurns(s.id)
    } catch (err) {
      handleError(err)
    } finally {
      if (phase.value === 'explaining') phase.value = 'waiting-answer'
    }
  }

  function turnAsModel(turn: Turn) {
    return {
      partnerText: turn.partnerText,
      translation: turn.translation,
      explanation: turn.explanation,
      correctedText: turn.correctedText,
      interpretation: turn.interpretation,
      assumptions: turn.assumptions,
      badge: turn.badge,
      issues: turn.issues,
    }
  }

  async function playTurn(turn: Turn): Promise<{ ok: boolean; message: string | null }> {
    const { service } = useServiceConfig()
    if (!service.speechModel) {
      speechAvailable.value = false
      return { ok: false, message: 'speechUnavailable' }
    }
    const voice = service.speechVoice?.trim() || profileById(service.providerProfile).defaultVoice
    try {
      // Reuse an identical line from the cache (FR-050).
      let audio: AudioEntry | undefined = turn.audioId
        ? await getAudioForTurn(turn.id)
        : await findAudioByText(turn.partnerText)
      if (!audio) {
        const res = await requestSpeech(service, turn.partnerText, voice)
        if (!res.ok) {
          if (res.unsupported) speechAvailable.value = false
          return { ok: false, message: res.unsupported ? 'speechUnavailable' : res.message }
        }
        const entry: AudioEntry = {
          id: crypto.randomUUID(),
          sessionId: turn.sessionId,
          turnId: turn.id,
          text: turn.partnerText,
          voice,
          mimeType: res.mimeType,
          bytes: res.blob,
          createdAt: new Date().toISOString(),
        }
        const saved = await saveAudio(entry)
        if (!saved.ok && saved.message === 'storageFull') {
          return { ok: false, message: 'storageFull' }
        }
        audio = entry
        turn.audioId = entry.id
        await updateTurn(turn)
        if (session.value) turns.value = await getTurns(session.value.id)
      }
      const url = URL.createObjectURL(audio.bytes)
      try {
        const el = new Audio(url)
        await el.play()
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      return { ok: true, message: null }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'speechUnavailable' }
    }
  }

  async function retry() {
    if (!session.value) return
    const last = lastHandle
    if (last && last.learnerText) {
      await sendAnswer(last.learnerText)
    } else {
      await startInitialTurn()
    }
  }

  async function load(id: string) {
    const found = await getSession(id)
    if (!found) {
      session.value = null
      return
    }
    session.value = found
    turns.value = await getTurns(id)
    lastBadgeIndexByTier.delete(id)
    if (found.state === 'active' && turns.value.length === 0) {
      await startInitialTurn()
    } else {
      phase.value = 'waiting-answer'
    }
  }

  async function start(input: NewSessionInput): Promise<string> {
    const created = await createSession(input)
    session.value = created
    lastBadgeIndexByTier.delete(created.id)
    await startInitialTurn()
    return created.id
  }

  async function endSession() {
    const s = session.value
    if (!s) return
    await endSessionStore(s.id)
    session.value = (await getSession(s.id)) ?? null
    phase.value = 'waiting-answer'
  }

  return {
    session,
    turns,
    phase,
    partnerProgress,
    error,
    speechAvailable,
    imagesAvailable,
    load,
    start,
    sendAnswer,
    endSession,
    explainTurn,
    playTurn,
    retry,
  }
}
