<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@/composables/useSession'
import type { Illustration, Session, Turn } from '@/domain/types'
import { LEVELS } from '@/domain/catalogue'
import { getIllustrationsBySession } from '@/data/media'
import TurnBubble from '@/components/TurnBubble.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import SpeechButton from '@/components/SpeechButton.vue'
import IllustrationPanel from '@/components/IllustrationPanel.vue'

const route = useRoute()
const sessionState = useSession()
const draft = ref('')
const illustrations = ref<Illustration[]>([])
const speechHints = ref<Record<string, string>>({})

const sessionId = computed(() => String(route.params.id ?? ''))
const session = computed<Session | null>(() => sessionState.session.value)
const turns = computed<Turn[]>(() => sessionState.turns.value)
const phase = computed(() => sessionState.phase.value)
const streaming = computed(
  () => phase.value === 'partner-streaming' || phase.value === 'generating',
)
const readOnly = computed(() => session.value?.state === 'ended')
const canSend = computed(
  () => !readOnly.value && draft.value.trim().length > 0 && !streaming.value,
)
const levelName = computed(() => {
  const level = LEVELS.find((l) => l.id === session.value?.level)
  return level ? level.name : (session.value?.level ?? '')
})

function startIllustration(sessionId2: string) {
  return illustrations.value.find((i) => i.sessionId === sessionId2 && i.moment === 'start') ?? null
}

async function loadIllustrations() {
  if (!session.value) return
  illustrations.value = await getIllustrationsBySession(session.value.id)
}

onMounted(async () => {
  await sessionState.load(sessionId.value)
  await loadIllustrations()
})

async function onSend() {
  const text = draft.value
  if (!canSend.value) return
  draft.value = ''
  await sessionState.sendAnswer(text)
  await loadIllustrations()
}

function onExplain(turn: Turn) {
  sessionState.explainTurn(turn)
}

async function onPlay(turn: Turn) {
  const result = await sessionState.playTurn(turn)
  if (!result.ok && result.message === 'speechUnavailable') {
    speechHints.value[turn.id] = 'speechUnavailable'
  }
}

function speechHint(turnId: string): string | null {
  return speechHints.value[turnId] ?? (sessionState.speechAvailable.value ? null : 'speechUnavailable')
}

const errorKind = computed(() => sessionState.error.value?.kind ?? null)
const errorMessage = computed(() => sessionState.error.value?.message ?? '')
const offline = computed(() => typeof navigator !== 'undefined' && navigator.onLine === false)
const statusHint = computed(() => (offline.value ? 'network' : null) ?? errorKind.value)
</script>

<template>
  <section class="space-y-3">
    <div v-if="!session" class="text-fg-muted">{{ $t('dialogue.connectHint') }}</div>

    <template v-else>
      <header class="flex items-start justify-between gap-2">
        <div>
          <h1 class="text-lg font-bold leading-tight">{{ session.title }}</h1>
          <p class="text-sm text-fg-muted">
            {{ session.situation.name }} · {{ session.partner.name }} ·
            {{ session.language }} · {{ levelName }}
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

      <p v-if="readOnly" class="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
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
      <IllustrationPanel :illustration="startIllustration(session.id)" :alt="session.situation.name" />

      <div class="space-y-3">
        <template v-for="(turn, idx) in turns" :key="turn.id">
          <TurnBubble :text="turn.partnerText" side="partner" />

          <div v-if="turn.illustrationId" class="flex justify-end">
            <IllustrationPanel
              class="w-40"
              :illustration="illustrations.find((i) => i.id === turn.illustrationId) ?? null"
              :alt="turn.partnerText"
            />
          </div>

          <div v-if="turn.learnerText" class="flex flex-col gap-2">
            <TurnBubble :text="turn.learnerText" side="learner" />
            <div class="flex items-start gap-2">
              <div class="flex flex-col items-center gap-1">
                <SpeechButton
                  :label="$t('settings.speech')"
                  :hint="speechHint(turn.id) ? $t('errors.speechUnavailable') : null"
                  @play="onPlay(turn)"
                />
                <span v-if="speechHint(turn.id)" class="max-w-24 text-center text-[10px] leading-tight text-fg-muted">
                  {{ $t('errors.speechUnavailable') }}
                </span>
              </div>
              <FeedbackPanel
                :turn="turn"
                :explaining="phase === 'explaining' && idx === turns.length - 1"
                :show-explain="true"
                :explain-disabled="readOnly"
                @explain="onExplain(turn)"
              />
            </div>
          </div>
        </template>

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
          <textarea
            v-model="draft"
            rows="1"
            class="min-h-11 max-h-32 flex-1 resize-y rounded-lg border border-border bg-surface-raised px-3 py-2.5"
            :placeholder="$t('dialogue.inputPlaceholder')"
            :disabled="streaming || phase === 'partner-streaming'"
            @keydown.enter.exact.prevent="onSend"
          />
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-50"
            :disabled="!canSend"
            :aria-label="$t('dialogue.send')"
            @click="onSend"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M3 20.5 21 12 3 3.5v6l12 2.5-12 2.5z" />
            </svg>
          </button>
        </div>
        <p v-if="statusHint" class="mt-1 text-xs text-fg-muted">
          {{ $t(`errors.${statusHint}`) }}
        </p>
      </footer>
    </template>
  </section>
</template>