<script setup lang="ts">
import SpinnerIcon from '@/components/SpinnerIcon.vue'
import { useI18n } from 'vue-i18n'

/**
 * Playback control (T083; FR-026/FR-027). The button reflects what is happening with THIS line:
 * - `busy`   — the speech request for the line is in flight → spinner, clicks ignored
 * - `active` — the line is currently playing → becomes a Stop button (click stops the playback)
 * - otherwise — a play button; the voice is fetched when it is clicked
 */
defineProps<{
  label: string
  disabled?: boolean
  hint?: string | null
  active?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ play: []; stop: [] }>()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    data-testid="speech-button"
    class="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border px-3"
    :class="busy ? 'cursor-wait' : ''"
    :disabled="disabled || busy"
    :aria-label="active ? t('dialogue.stopSpeech') : label"
    :title="hint ?? label"
    @click="active ? emit('stop') : emit('play')"
  >
    <SpinnerIcon v-if="busy" class="h-5 w-5 text-fg-muted" />
    <svg
      v-else-if="active"
      viewBox="0 0 24 24"
      class="h-5 w-5"
      fill="currentColor"
      aria-hidden="true"
      data-testid="stop-icon"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
    <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
</template>
