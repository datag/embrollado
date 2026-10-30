<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/composables/useSession'
import { useServiceConfig } from '@/composables/useSettings'
import { canGenerateImages as imagesPossible } from '@/ai/providers'
import type { Illustration, Session, Turn } from '@/domain/types'
import { LEVELS } from '@/domain/catalogue'
import { getIllustrationsBySession } from '@/data/media'
import TurnBubble from '@/components/TurnBubble.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import SpeechButton from '@/components/SpeechButton.vue'
import SpinnerIcon from '@/components/SpinnerIcon.vue'
import TranslationToggle from '@/components/TranslationToggle.vue'
import IllustrationPanel from '@/components/IllustrationPanel.vue'
import ImageModal from '@/components/ImageModal.vue'

const route = useRoute()
const { t } = useI18n()
const sessionState = useSession()
const draft = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const illustrations = ref<Illustration[]>([])
/** The illustration shown at full resolution in the lightbox; null = closed. */
const modalIllustration = ref<Illustration | null>(null)
const speechHints = ref<Record<string, string | null>>({})

const sessionId = computed(() => String(route.params.id ?? ''))
const session = computed<Session | null>(() => sessionState.session.value)
const turns = computed<Turn[]>(() => sessionState.turns.value)
const phase = computed(() => sessionState.phase.value)
const streaming = computed(
  () => phase.value === 'partner-streaming' || phase.value === 'generating',
)
/** The learner's latest answer while its response is pending or failed — rendered immediately. */
const pendingLearnerText = computed(() => sessionState.pendingLearnerText.value ?? '')
const readOnly = computed(() => session.value?.state === 'ended')
const canSend = computed(() => !readOnly.value && draft.value.trim().length > 0 && !streaming.value)
const levelName = computed(() => {
  const level = LEVELS.find((l) => l.id === session.value?.level)
  return level ? level.name : (session.value?.level ?? '')
})

function startIllustration(sessionId2: string) {
  return illustrations.value.find((i) => i.sessionId === sessionId2 && i.moment === 'start') ?? null
}

function turnIllustration(turn: Turn): Illustration | null {
  return illustrations.value.find((i) => i.id === turn.illustrationId) ?? null
}

/**
 * The generate-picture button is only offered when the configured service can produce images at
 * all: an image model is set AND the provider profile exposes an images path AND the endpoint has
 * not already declined. Without a model the input box takes the full width — no explanatory error
 * is shown, that state is the normal one.
 */
const showIllustrationButton = computed(() => {
  const { service } = useServiceConfig()
  return imagesPossible(service, sessionState.imagesAvailable.value)
})

/**
 * The playback button is only offered when a speech model is configured. Without one the partner
 * line simply is not speakable — like the picture button, its absence is the normal state. When a
 * model IS set but the endpoint refuses (404/405), the unavailability hint still explains why.
 */
const showSpeechButton = computed(() => {
  const { service } = useServiceConfig()
  return !!service.speechModel?.trim()
})

const illustrationBusy = computed(() => sessionState.illustrationBusy.value)

const illustrationHintText = computed(() => {
  const hint = sessionState.illustrationHint.value
  if (!hint) return null
  // Keys that map to the shared error catalogue; anything else is the provider's own message.
  return hint === 'imageUnavailable' || hint === 'unexpectedFormat' || hint === 'refusal'
    ? t(`errors.${hint}`)
    : hint
})

async function onIllustrate() {
  if (illustrationBusy.value || streaming.value) return
  await sessionState.generateIllustration()
  await loadIllustrations()
  // First attempt: jump to the foot right away. The picture itself fires `loaded` once its
  // (previously unknown) height is laid out, which scrolls again to the true bottom.
  void nextTick(() => scrollToBottom(true))
}

async function loadIllustrations() {
  if (!session.value) return
  illustrations.value = await getIllustrationsBySession(session.value.id)
}

onMounted(async () => {
  await sessionState.load(sessionId.value)
  await loadIllustrations()
  // Resume a conversation with the newest content in view.
  void nextTick(() => scrollToBottom(false))
})

// New turns may bring a freshly generated illustration — fetch it when the turn list changes.
watch(
  () => turns.value,
  () => {
    loadIllustrations()
  },
)

async function onSend() {
  const text = draft.value
  if (!canSend.value) return
  draft.value = ''
  await sessionState.sendAnswer(text)
  await loadIllustrations()
}

function onToggleTranslation(turnId: string) {
  sessionState.toggleTranslation(turnId)
}

async function onPlay(turn: Turn) {
  const result = await sessionState.playTurn(turn)
  if (!result.ok) {
    // Keep the provider's message when available so a rejected voice/model is understandable.
    speechHints.value[turn.id] =
      result.message === 'speechUnavailable' ? 'speechUnavailable' : result.message
  } else {
    delete speechHints.value[turn.id]
  }
}

const speakingTurnId = computed(() => sessionState.speakingTurnId.value)
const speechBusyTurnId = computed(() => sessionState.speechRequestTurnId.value)

function speechHint(turnId: string): string | null {
  return (
    speechHints.value[turnId] ?? (sessionState.speechAvailable.value ? null : 'speechUnavailable')
  )
}

const errorKind = computed(() => sessionState.error.value?.kind ?? null)
const errorMessage = computed(() => sessionState.error.value?.message ?? '')
const offline = computed(() => typeof navigator !== 'undefined' && navigator.onLine === false)
const statusHint = computed(() => (offline.value ? 'network' : null) ?? errorKind.value)

/* ------------------------------------------------------------------ */
/* Auto-scroll: keep the newest content in view (no dedicated scroll   */
/* container — the window scrolls, the composer is sticky at the foot). */
/* ------------------------------------------------------------------ */

function maxScrollTop(): number {
  const doc = document.documentElement
  const height = Math.max(doc.scrollHeight, document.body.scrollHeight, doc.offsetHeight)
  return Math.max(0, height - window.innerHeight)
}

function reduceMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Scroll the window to the bottom. `smooth` unless the user prefers reduced motion. */
function scrollToBottom(smooth = true) {
  window.scrollTo({ top: maxScrollTop(), behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' })
}

/** True while the viewport is at/near the bottom (threshold px). */
function isNearBottom(threshold = 120): boolean {
  return maxScrollTop() <= window.scrollY + threshold
}

// Follow the streamed partner line only while the learner is watching the bottom — a manual
// scroll-up to re-read is never overridden mid-stream.
watch(
  () => sessionState.partnerProgress.value,
  () => {
    if (streaming.value && isNearBottom()) scrollToBottom(false)
  },
  { flush: 'post' },
)

// The learner's answer renders instantly on send — scroll it into view even before the model
// answers (the sent message belongs at the foot of the conversation).
watch(
  () => sessionState.pendingLearnerText.value,
  (v) => {
    if (v) void nextTick(() => scrollToBottom(true))
  },
  { flush: 'post' },
)

// A completed message (feedback + partner line) always scrolls into view — the learner just sent
// an answer, so the new content belongs at the foot of the conversation.
watch(
  () => turns.value,
  () => {
    void nextTick(() => scrollToBottom(true))
  },
  { flush: 'post' },
)

// Keep the focus in the composer so the learner can keep typing without clicking. Two cases:
// - An AI response just finished (feedback on the learner's answer, the opening line, or a
//   failure) and re-enabled the input.
// - The learner opened an already existing conversation ('idle' → 'waiting-answer' right after
//   its session was loaded) — same thing: the input is enabled and empty, ready for the next
//   answer. Ended sessions have no composer, so focusing there is a harmless no-op, and a brand
//   new conversation passes through 'partner-streaming' first (covered by the first case).
watch(
  () => sessionState.phase.value,
  (next, prev) => {
    const aiResponseEnded =
      (prev === 'generating' || prev === 'partner-streaming') &&
      (next === 'waiting-answer' || next === 'failed')
    const resumedConversation =
      prev === 'idle' && next === 'waiting-answer' && turns.value.length > 0
    if (aiResponseEnded || resumedConversation) {
      inputEl.value?.focus()
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <section class="space-y-3">
    <div v-if="!session" class="text-fg-muted">{{ $t('dialogue.connectHint') }}</div>

    <template v-else>
      <header class="flex items-start justify-between gap-2">
        <div>
          <h1 class="text-lg font-bold leading-tight">{{ session.title }}</h1>
          <p class="text-sm text-fg-muted">
            {{ session.situation.name }} · {{ session.partner.name }} · {{ session.language }} ·
            {{ levelName }}
          </p>
        </div>
        <button
          v-if="!readOnly && (turns.length > 0 || streaming)"
          type="button"
          class="min-h-11 rounded-lg border border-border px-3 text-sm"
          :disabled="streaming"
          @click="sessionState.endSession()"
        >
          {{ $t('dialogue.end') }}
        </button>
      </header>

      <p
        v-if="readOnly"
        class="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
      >
        {{ $t('dialogue.readOnly') }}
      </p>

      <!-- service not configured -->
      <div
        v-if="errorKind === 'not-configured'"
        class="rounded-lg border border-error/40 bg-surface-raised p-3 text-sm"
      >
        <p>{{ $t('errors.serviceNotConfigured') }}</p>
        <RouterLink
          to="/settings"
          class="mt-2 inline-block min-h-11 rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg"
        >
          {{ $t('errors.serviceNotConfiguredAction') }}
        </RouterLink>
      </div>

      <!-- illustration for the start -->
      <IllustrationPanel
        :illustration="startIllustration(session.id)"
        :alt="session.situation.name"
        @open="modalIllustration = startIllustration(session.id)"
        @loaded="scrollToBottom(true)"
      />

      <div class="space-y-3">
        <template v-for="turn in turns" :key="turn.id">
          <!-- Chronologische Reihenfolge pro Turn (FR-011): die Lernenden-Antwort samt Feedback
               kommt zuerst, danach die neue Partnerzeile, die diese Antwort hervorrief. -->
          <div v-if="turn.learnerText" class="flex flex-col gap-2">
            <TurnBubble :text="turn.learnerText" side="learner" />
            <FeedbackPanel :turn="turn" />
          </div>

          <div v-if="turn.partnerText" class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <TurnBubble
                :text="turn.partnerText"
                side="partner"
                :translation="sessionState.isTranslationVisible(turn.id) ? turn.translation : null"
              />
              <p
                v-if="speechHint(turn.id)"
                class="mt-1 max-w-28 text-xs leading-snug text-fg-muted"
                data-testid="speech-hint"
              >
                {{
                  speechHint(turn.id) === 'speechUnavailable'
                    ? $t('errors.speechUnavailable')
                    : speechHint(turn.id)
                }}
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-center gap-1.5">
              <SpeechButton
                v-if="showSpeechButton"
                class="shrink-0"
                :label="$t('settings.speech')"
                :active="speakingTurnId === turn.id"
                :busy="speechBusyTurnId === turn.id"
                :hint="
                  speechHint(turn.id)
                    ? speechHint(turn.id) === 'speechUnavailable'
                      ? $t('errors.speechUnavailable')
                      : speechHint(turn.id)
                    : null
                "
                @play="onPlay(turn)"
                @stop="sessionState.stopSpeaking"
              />
              <TranslationToggle
                v-if="!readOnly && turn.translation"
                :visible="sessionState.isTranslationVisible(turn.id)"
                @toggle="onToggleTranslation(turn.id)"
              />
            </div>
          </div>

          <div v-if="turn.illustrationId" class="flex justify-end">
            <IllustrationPanel
              class="w-56 max-w-full"
              :illustration="turnIllustration(turn)"
              :alt="turnIllustration(turn)?.prompt || $t('dialogue.illustrationAlt')"
              @open="modalIllustration = turnIllustration(turn)"
              @loaded="scrollToBottom(true)"
            />
          </div>
        </template>

        <!-- the learner's latest answer renders immediately, while the response is pending -->
        <div v-if="pendingLearnerText" class="flex flex-col gap-2">
          <TurnBubble :text="pendingLearnerText" side="learner" />
        </div>

        <!-- the partner's next line streams here -->
        <TurnBubble
          v-if="streaming"
          :text="sessionState.partnerProgress.value"
          side="partner"
          :streaming="true"
        />

        <!-- failed state -->
        <div
          v-if="phase === 'failed' && errorKind && errorKind !== 'not-configured'"
          class="rounded-lg border border-error/40 bg-surface-raised p-3 text-sm"
        >
          <p>{{ $t(`errors.${errorKind}`) }}</p>
          <p v-if="errorKind === 'cors' && errorMessage" class="mt-1 text-fg-muted">
            {{ $t('errors.corsHint', { hint: errorMessage }) }}
          </p>
          <button
            type="button"
            class="mt-2 min-h-11 rounded-lg bg-accent px-4 font-medium text-accent-fg"
            @click="sessionState.retry()"
          >
            {{ $t('errors.sendAgain') }}
          </button>
        </div>
      </div>

      <!-- composer -->
      <footer
        v-if="!readOnly"
        class="sticky bottom-0 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur"
      >
        <div class="flex items-end gap-2">
          <button
            v-if="showIllustrationButton"
            type="button"
            data-testid="illustration-button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-fg disabled:opacity-50"
            :class="illustrationBusy ? 'cursor-wait' : ''"
            :disabled="streaming || illustrationBusy"
            :aria-label="
              illustrationBusy ? $t('dialogue.illustrationBusy') : $t('dialogue.illustration')
            "
            :title="$t('dialogue.illustration')"
            @click="onIllustrate"
          >
            <svg
              v-if="!illustrationBusy"
              viewBox="0 0 24 24"
              class="h-5 w-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M21 3H3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM10 13l2.5-3 2.5 3 2-2.5L20 16H6l2.5-3zM7 7.5A1.5 1.5 0 1 1 7 4.5 1.5 1.5 0 0 1 7 7.5z"
              />
            </svg>
            <SpinnerIcon v-else />
          </button>
          <textarea
            ref="inputEl"
            v-model="draft"
            rows="1"
            data-testid="dialogue-input"
            class="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-lg border border-border bg-surface-raised px-3 py-2.5"
            :placeholder="$t('dialogue.inputPlaceholder')"
            :disabled="streaming || phase === 'partner-streaming'"
            @keydown.enter.exact.prevent="onSend"
          />
          <button
            type="button"
            data-testid="send"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-50"
            :class="streaming ? 'cursor-wait' : ''"
            :disabled="!canSend"
            :aria-label="$t('dialogue.send')"
            @click="onSend"
          >
            <SpinnerIcon v-if="streaming" />
            <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M3 20.5 21 12 3 3.5v6l12 2.5-12 2.5z" />
            </svg>
          </button>
        </div>
        <p v-if="statusHint" class="mt-1 text-xs text-fg-muted">
          {{ $t(`errors.${statusHint}`) }}
        </p>
        <p
          v-if="illustrationHintText"
          class="mt-1 text-xs text-fg-muted"
          data-testid="illustration-hint"
        >
          {{ illustrationHintText }}
        </p>
      </footer>
    </template>

    <!-- Full-resolution lightbox for any illustration the learner clicks. -->
    <ImageModal
      :illustration="modalIllustration"
      :alt="modalIllustration?.prompt || $t('dialogue.illustrationAlt')"
      @close="modalIllustration = null"
    />
  </section>
</template>
