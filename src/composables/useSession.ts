import { reactive, ref, shallowRef, type Ref } from 'vue'
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
import { assembleFeedback, createOpeningTurn, translationVisible } from '@/domain/session'
import {
  buildSystemPrompt,
  buildTurnUserMessage,
  buildSceneMessages,
  buildIllustrationPrompt,
} from '@/ai/prompts'
import { SCENE_SCHEMA, TURN_SCHEMA } from '@/ai/schema'
import {
  chatCompletion,
  growingStringValue,
  parseLooseJson,
  requestImage,
  requestSpeech,
} from '@/ai/aiService'
import { profileById } from '@/ai/providers'
import { useServiceConfig, useSettings } from '@/composables/useSettings'
import {
  saveIllustration,
  deleteIllustration,
  saveAudio,
  getAudioForTurn,
  findAudioByText,
} from '@/data/media'

/**
 * The turn cycle (T041; FR-006…FR-014). One API call returns the partner's next line AND the
 * feedback on the learner's last answer, so the dialogue runs partner-line → answer → feedback →
 * partner-line. The partner's line is streamed progressively; the feedback appears as one block
 * when the stream completes (FR-035, D15).
 */

export type TurnPhase = 'idle' | 'partner-streaming' | 'waiting-answer' | 'generating' | 'failed'

export interface SessionError {
  kind: string
  message: string
}

/**
 * The result of one turn request: what the model answered and the history entry it produced.
 * The entry joins the model-side history only when the turn is actually stored — a failed attempt
 * must leave the history untouched (T129), or the retry would send the learner's answer twice.
 */
interface TurnRequest {
  /** The parsed turn JSON. */
  parsed: Record<string, unknown>
  /**
   * The message that joins the stored history. A stored answer is "already assessed — context
   * only"; only the answer that is being sent right now carries the "assess this" mark — so the
   * model never has two answers to rate (FR-040).
   */
  historyMessage: { role: 'user'; content: string } | null
  /** The partner's line — the assistant half of the history entry. */
  partnerLine: string
}

export interface UseSessionReturn {
  session: Ref<Session | null>
  turns: Ref<Turn[]>
  phase: Ref<TurnPhase>
  partnerProgress: Ref<string>
  /**
   * The learner's latest answer while its response is pending (generating) or was rejected
   * (failed) — rendered immediately, because the text is already known 1:1. Cleared on success.
   */
  pendingLearnerText: Ref<string | null>
  error: Ref<SessionError | null>
  speechAvailable: Ref<boolean>
  imagesAvailable: Ref<boolean>
  /** True while an on-demand illustration is being generated (FR-028 as amended). */
  illustrationBusy: Ref<boolean>
  /**
   * A learner-facing hint after a failed generation: either the key `imageUnavailable` or a
   * provider's raw message. A failure never interrupts the dialogue (FR-030).
   */
  illustrationHint: Ref<string | null>
  /** Which turn's line is currently being played aloud (null = nothing plays). */
  speakingTurnId: Ref<string | null>
  /** Which turn's line is currently being fetched from the speech service (null = idle). */
  speechRequestTurnId: Ref<string | null>
  /** Stop the current speech playback, if any. */
  stopSpeaking: () => void
  /** Generate an illustration of the CURRENT moment — situation, people and dialogue in one
   * context; attaches the picture to the latest turn. Only run from an explicit user action. */
  generateIllustration: () => Promise<void>
  /** Whether the partner line's translation may be shown (FR-057). */
  isTranslationVisible: (turnId: string) => boolean
  /** Flip the per-line "cheat" visibility of the translation. */
  toggleTranslation: (turnId: string) => void
  load: (id: string) => Promise<void>
  start: (input: NewSessionInput) => Promise<string>
  sendAnswer: (text: string) => Promise<void>
  endSession: () => Promise<void>
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
  const illustrationBusy = ref(false)
  const illustrationHint = ref<string | null>(null)
  const speakingTurnId = ref<string | null>(null)
  const speechRequestTurnId = ref<string | null>(null)
  /** The single <audio> element currently playing a partner line, if any. */
  let audioEl: HTMLAudioElement | null = null
  /** The learner's answer awaiting the model's reply — kept across failures for retry (FR-025). */
  const pendingText = ref<string | null>(null)
  /**
   * Explicit per-line visibility decisions for the partner-line translation (FR-057). Only
   * deviations from the derived default are stored: the learner's toggle, and the auto-reveal
   * when an answer is sent. Answered lines also stay visible after a reload, derived from the
   * stored turns.
   */
  const translationOverrides = reactive(new Map<string, boolean>())
  // Per-session AI chat history: the system prompt + the turns so far. It mirrors the stored
  // conversation exactly — a turn joins it only after it was stored, so a failed attempt leaves
  // no phantom answer in the context the service sees (T129).
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  let lastHandle: Turn | null = null

  function clearMessages() {
    messages.length = 0
  }

  /** A partner line is "answered" once a later turn carries a learner answer. */
  function isAnswered(turnId: string): boolean {
    const idx = turns.value.findIndex((t) => t.id === turnId)
    return idx !== -1 && idx < turns.value.length - 1
  }
  function isTranslationVisible(turnId: string): boolean {
    const override = translationOverrides.has(turnId) ? translationOverrides.get(turnId)! : null
    return translationVisible(override, isAnswered(turnId), session.value?.state === 'ended')
  }

  function toggleTranslation(turnId: string) {
    translationOverrides.set(turnId, !isTranslationVisible(turnId))
  }

  /**
   * Rebuild the model-side history from the stored turns so a resumed session continues with the
   * same minimal dialogue context: the complete correspondence (every partner line, every learner
   * answer) and nothing else — no stored feedback, which would anchor a new rating to the
   * previous answer.
   */
  async function rebuildHistory() {
    const s = session.value
    if (!s) return
    clearMessages()
    messages.push({ role: 'system', content: await buildSystemPromptFor(s) })
    let opening = true
    for (const t of turns.value) {
      // Earlier answers travel as explicit context: labelled "already assessed" so a resumed
      // session never re-rates an old answer (rating = current only, FR-040).
      messages.push(
        buildTurnUserMessage(opening ? null : t.learnerText, opening ? 'opening' : 'context'),
      )
      if (t.partnerText) messages.push({ role: 'assistant', content: t.partnerText })
      opening = false
    }
  }

  async function buildSystemPromptFor(sessionValue: Session): Promise<string> {
    const { settings } = useSettings()
    const knowsLearner = sessionValue.options?.knowsLearner ?? false
    return buildSystemPrompt({
      partner: sessionValue.partner,
      situation: sessionValue.situation,
      level: sessionValue.level,
      targetLanguage: sessionValue.language,
      feedbackLanguage: settings.nativeLanguage ?? settings.interfaceLanguage,
      knowsLearner,
      appearance: settings.appearance.trim() || null,
      voice: settings.voice.trim() || null,
      age: settings.age,
      gender: settings.gender,
      // Name and details leave the device only with the per-session option enabled.
      learnerName: knowsLearner ? settings.name.trim() || null : null,
      learnerDetails: knowsLearner ? settings.details.trim() || null : null,
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

  /** One API call: returns the parsed turn JSON and the history entry it produced. */
  async function requestTurn(
    learnerText: string | null,
    onDelta: (data: string) => void,
  ): Promise<TurnRequest> {
    const { service } = useServiceConfig()
    if (!service.chatModel)
      throw { kind: 'not-configured', message: 'serviceNotConfigured' } as SessionError
    if (messages.length === 0) return { parsed: {}, historyMessage: null, partnerLine: '' }
    const kind = learnerText == null || learnerText.trim() === '' ? 'opening' : 'current'
    const userMessage = buildTurnUserMessage(learnerText, kind)
    // The answer that is being sent now is the one to assess ("current"). Every answer that is
    // already stored is context only — the same mark the resumed session uses. So the history
    // never holds a second "assess this" message, and the model rates exactly one answer: the
    // last one (FR-040, T135).
    const historyMessage =
      kind === 'opening' ? userMessage : buildTurnUserMessage(learnerText, 'context')
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
    const parsed = (parseLooseJson(result.content) ?? {}) as Record<string, unknown>
    // The model-side history holds ONLY the correspondence (the complete dialogue): the assistant
    // message is the partner line itself. If the full turn JSON (with its badge, issues, …) were
    // stored instead, the previous turn's rating would sit directly above the next request and
    // anchor the model's new rating to the WRONG (previous) answer — the observable "lag by one".
    const partnerLine = typeof parsed.partnerText === 'string' ? parsed.partnerText : result.content
    // The history is NOT extended here: the entry joins it only once the turn is stored. A
    // rejected answer or a failed write would otherwise leave the attempt behind — and the retry
    // would send the learner's answer a second time, on top of the failed one.
    return { parsed, historyMessage, partnerLine }
  }

  /**
   * The stored turns after a write. The read is best-effort: a failing read must not turn a
   * stored turn into a failed one — the retry would store the same answer a second time.
   */
  async function refreshTurns(sessionId: string, stored: Turn): Promise<Turn[]> {
    try {
      return await getTurns(sessionId)
    } catch {
      return [...turns.value, stored]
    }
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
    try {
      const { parsed, historyMessage, partnerLine } = await requestTurn(null, (data) => {
        acc += data
        partnerProgress.value = growingStringValue(acc, 'partnerText')
      })
      if (typeof parsed.partnerText !== 'string' || !parsed.partnerText.trim()) {
        throw { kind: 'unexpectedFormat', message: 'The service answered in an unexpected format.' }
      }
      const opening = createOpeningTurn(
        s,
        parsed.partnerText,
        typeof parsed.translation === 'string' ? parsed.translation : '',
        // The opening turn has no learner answer yet — an explanation could only refer to the
        // partner's own line, so the app never stores the model's field here (FR-061).
        null,
        feedbackLanguage(),
      )
      await saveTurn(opening)
      // The turn is stored — only now does it join the model-side history. A failed attempt
      // leaves the history untouched, so a retry starts from the same context.
      if (historyMessage) {
        messages.push(historyMessage, { role: 'assistant', content: partnerLine })
      }
      turns.value = await refreshTurns(s.id, opening)
      lastHandle = opening
      phase.value = 'waiting-answer'
    } catch (err) {
      // A failed attempt never becomes part of the conversation — nothing is persisted and any
      // partially streamed partner line is discarded, so a retry starts a fresh response.
      partnerProgress.value = ''
      phase.value = 'failed'
      handleError(err)
    }
  }

  async function sendAnswer(input: string) {
    const s = session.value
    const text = input.trim()
    if (!s || !text || (phase.value !== 'waiting-answer' && phase.value !== 'failed')) return
    phase.value = 'generating'
    partnerProgress.value = ''
    error.value = null
    pendingText.value = text
    // Unmittelbar die Übersetzung der beantworteten Zeile aufdecken (FR-057), damit der Lernende
    // seine Annahme noch einmal prüfen kann — auch wenn der Request danach fehlschlägt.
    if (lastHandle) translationOverrides.set(lastHandle.id, true)

    let acc = ''
    try {
      const { parsed, historyMessage, partnerLine } = await requestTurn(text, (data) => {
        acc += data
        partnerProgress.value = growingStringValue(acc, 'partnerText')
      })
      // Reject a broken model response instead of persisting an empty, half-filled turn — that
      // would surface as an empty partner bubble and a missing assessment (FR-025).
      if (typeof parsed.partnerText !== 'string' || !parsed.partnerText.trim()) {
        throw { kind: 'unexpectedFormat', message: 'The service answered in an unexpected format.' }
      }
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
        partnerText: parsed.partnerText,
        partnerTextLanguage: s.language,
        translation: feedback.translation,
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : null,
        learnerText: text,
        correctedText: feedback.correctedText,
        interpretation: feedback.interpretation,
        assumptions: feedback.assumptions,
        badge: feedback.badge,
        issues: feedback.issues,
        illustrationId: null,
        audioId: null,
        createdAt: now,
        feedbackLanguage: feedbackLanguage(),
      }
      await saveTurn(turn)
      // The turn is stored — only now does it join the model-side history. A failed attempt
      // (a rejected answer, a failed write) leaves the history untouched, so the retry sends
      // the learner's answer exactly once (T129). The stored answer is context from here on —
      // only the answer that is sent next is marked as the one to assess (T135).
      if (historyMessage) {
        messages.push(historyMessage, { role: 'assistant', content: partnerLine })
      }
      turns.value = await refreshTurns(s.id, turn)
      lastHandle = turn
      pendingText.value = null
      phase.value = 'waiting-answer'
      // Manuell nachbestellte Bilder gibt es nur für den Start der Konversation — nicht für jeden
      // Turn (owner-Anforderung). Illustrationen bleiben für importierte Sessions lesbar.
    } catch (err) {
      // A failed attempt never becomes part of the conversation — nothing is persisted and any
      // partially streamed partner line is discarded, so a retry starts a fresh response (T129).
      partnerProgress.value = ''
      phase.value = 'failed'
      handleError(err)
    }
  }

  /**
   * Generate an illustration of the CURRENT moment (FR-028 as amended). The scene is first
   * narrated by the chat model — situation, people incl. the learner's profile and the whole
   * dialogue travel together in ONE context request — and only the finished narration goes to the
   * image endpoint, so the picture actually shows what is being talked about instead of a generic
   * "people talking" frame. The picture is attached to the latest turn; a second click replaces it.
   * A failure never interrupts the dialogue (FR-030); it only sets a short hint.
   */
  async function generateIllustration() {
    const s = session.value
    if (!s) return
    const { settings } = useSettings()
    if (!imagesAvailable.value) return
    const { service } = useServiceConfig()
    if (!service.imageModel) return
    const profile = profileById(service.providerProfile)
    if (!profile.imagesPath) return
    if (illustrationBusy.value) return
    const anchor = turns.value[turns.value.length - 1]
    if (!anchor) return

    illustrationBusy.value = true
    illustrationHint.value = null
    try {
      // Step 1 — narrate the current moment from the full context (one chat request).
      const sceneResult = await chatCompletion({
        service,
        messages: buildSceneMessages({
          partner: s.partner,
          situation: s.situation,
          learnerName: settings.name.trim() || null,
          learnerDetails: settings.details.trim() || null,
          appearance: settings.appearance.trim() || null,
          age: settings.age,
          gender: settings.gender,
          dialogue: turns.value.map((t) => ({
            partnerText: t.partnerText,
            learnerText: t.learnerText,
          })),
        }),
        schema: {
          name: 'embrollado_scene',
          schema: SCENE_SCHEMA as unknown as Record<string, unknown>,
        },
        stream: false,
      })
      if (sceneResult.refusal) {
        illustrationHint.value = sceneResult.refusal
        return
      }
      const parsed = (parseLooseJson(sceneResult.content) ?? {}) as { scene?: unknown }
      const scene =
        typeof parsed.scene === 'string' && parsed.scene.trim() ? parsed.scene.trim() : null
      if (!scene) {
        illustrationHint.value = 'unexpectedFormat'
        return
      }

      // Step 2 — render exactly that scene.
      let res
      try {
        res = await requestImage(service, buildIllustrationPrompt(scene))
      } catch {
        illustrationHint.value = 'imageUnavailable'
        return
      }
      if (!res.ok) {
        if (res.unsupported) {
          imagesAvailable.value = false
          illustrationHint.value = 'imageUnavailable'
        } else {
          illustrationHint.value = res.message
        }
        return
      }

      const illustration: Illustration = {
        id: crypto.randomUUID(),
        sessionId: s.id,
        // An on-demand picture of the current moment, bound to the latest turn so it renders
        // inline in the dialogue (FR-028 as amended).
        turnId: anchor.id,
        moment: 'key',
        prompt: scene,
        mimeType: res.mimeType,
        bytes: new Blob([res.bytes as BlobPart], { type: res.mimeType }),
        width: 0,
        height: 0,
        createdAt: new Date().toISOString(),
      }
      // A re-generation replaces the previous picture of the same turn instead of accumulating.
      if (anchor.illustrationId) {
        try {
          await deleteIllustration(anchor.illustrationId)
        } catch {
          /* a stale reference never blocks the new image */
        }
      }
      try {
        const saved = await saveIllustration(illustration)
        if (saved.ok) {
          anchor.illustrationId = illustration.id
          await updateTurn(anchor)
          turns.value = await getTurns(s.id)
        }
      } catch {
        /* storage failure is surfaced via the UI, never thrown */
      }
    } catch {
      illustrationHint.value = 'imageUnavailable'
    } finally {
      illustrationBusy.value = false
    }
  }

  /** Stop the current speech playback inside this composable scope. */
  function stopSpeaking() {
    if (audioEl) {
      audioEl.pause()
      audioEl.currentTime = 0
      audioEl = null
    }
    speakingTurnId.value = null
  }

  async function playTurn(turn: Turn): Promise<{ ok: boolean; message: string | null }> {
    // While a line is playing, its own button becomes Stop.
    if (speakingTurnId.value === turn.id) {
      stopSpeaking()
      return { ok: true, message: null }
    }
    // One speech request at a time — later clicks on other lines are ignored until it settles.
    if (speechRequestTurnId.value) return { ok: false, message: null }
    // Starting a different line replaces the current playback.
    if (speakingTurnId.value) stopSpeaking()

    const { service } = useServiceConfig()
    if (!service.speechModel) {
      speechAvailable.value = false
      return { ok: false, message: 'speechUnavailable' }
    }
    const voice = service.speechVoice?.trim() || profileById(service.providerProfile).defaultVoice
    speechRequestTurnId.value = turn.id
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
      const el = new Audio(url)
      audioEl = el
      const cleanup = () => {
        if (audioEl === el) {
          audioEl = null
          speakingTurnId.value = null
        }
        URL.revokeObjectURL(url)
      }
      el.addEventListener('ended', cleanup, { once: true })
      el.addEventListener('error', cleanup, { once: true })
      try {
        await el.play()
      } catch (err) {
        cleanup()
        return { ok: false, message: err instanceof Error ? err.message : 'speechUnavailable' }
      }
      speakingTurnId.value = turn.id
      return { ok: true, message: null }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'speechUnavailable' }
    } finally {
      speechRequestTurnId.value = null
    }
  }

  async function retry() {
    if (!session.value) return
    if (pendingText.value) {
      // Re-send the answer that failed — the learner's text is kept (FR-025, FR-035) and sent
      // exactly once: the failed attempt never entered the model-side history.
      await sendAnswer(pendingText.value)
      return
    }
    // No answer is pending: the opening line failed — request it again from scratch. (A stored
    // answer is never re-sent here: it has been assessed already and would be rated twice.)
    await startInitialTurn()
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
      // Rebuild the dialogue-only history from storage — also makes a resumed session continue
      // correctly (the in-memory messages start empty on every fresh mount/reload).
      await rebuildHistory()
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
    pendingLearnerText: pendingText,
    error,
    speechAvailable,
    imagesAvailable,
    illustrationBusy,
    illustrationHint,
    speakingTurnId,
    speechRequestTurnId,
    stopSpeaking,
    generateIllustration,
    isTranslationVisible,
    toggleTranslation,
    load,
    start,
    sendAnswer,
    endSession,
    playTurn,
    retry,
  }
}
