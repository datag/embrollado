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

export interface UseSessionReturn {
  session: Ref<Session | null>
  turns: Ref<Turn[]>
  phase: Ref<TurnPhase>
  partnerProgress: Ref<string>
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
  /** The learner's answer awaiting the model's reply — kept across failures for retry (FR-025). */
  const pendingText = ref<string | null>(null)
  /**
   * Explicit per-line visibility decisions for the partner-line translation (FR-057). Only
   * deviations from the derived default are stored: the learner's toggle, and the auto-reveal
   * when an answer is sent. Answered lines also stay visible after a reload, derived from the
   * stored turns.
   */
  const translationOverrides = reactive(new Map<string, boolean>())
  // Per-session AI chat history: the system prompt + the turns so far.
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
      messages.push(buildTurnUserMessage(opening ? null : t.learnerText))
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
    const parsed = (parseLooseJson(result.content) ?? {}) as Record<string, unknown>
    // The model-side history holds ONLY the correspondence (the complete dialogue): the assistant
    // message is the partner line itself. If the full turn JSON (with its badge, issues, …) were
    // stored instead, the previous turn's rating would sit directly above the next request and
    // anchor the model's new rating to the WRONG (previous) answer — the observable "lag by one".
    const partnerLine = typeof parsed.partnerText === 'string' ? parsed.partnerText : result.content
    messages.push(userMessage, { role: 'assistant', content: partnerLine })
    return parsed
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
      const parsed = await requestTurn(null, (data) => {
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
        typeof parsed.explanation === 'string' ? parsed.explanation : null,
        feedbackLanguage(),
      )
      await saveTurn(opening)
      turns.value = await getTurns(s.id)
      lastHandle = opening
      phase.value = 'waiting-answer'
    } catch (err) {
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
      const parsed = await requestTurn(text, (data) => {
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
      turns.value = await getTurns(s.id)
      lastHandle = turn
      pendingText.value = null
      phase.value = 'waiting-answer'
      // Manuell nachbestellte Bilder gibt es nur für den Start der Konversation — nicht für jeden
      // Turn (owner-Anforderung). Illustrationen bleiben für importierte Sessions lesbar.
    } catch (err) {
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
    if (!settings.illustrationsEnabled || !imagesAvailable.value) return
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
    if (pendingText.value) {
      // Re-send the answer that failed — the learner's text is kept (FR-025, FR-035).
      await sendAnswer(pendingText.value)
      return
    }
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
    error,
    speechAvailable,
    imagesAvailable,
    illustrationBusy,
    illustrationHint,
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
