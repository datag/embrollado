<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  label: string
  disabled?: boolean
  hint?: string | null
}>()
const emit = defineEmits<{ play: [] }>()

const busy = ref(false)

async function play() {
  if (props.disabled || busy.value) return
  busy.value = true
  try {
    await emit('play')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    data-testid="speech-button"
    class="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border px-3"
    :disabled="disabled || busy"
    :aria-label="label"
    :title="hint ?? label"
    @click="play"
  >
    <svg v-if="!busy" viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
    <span v-else class="h-5 w-5 animate-pulse rounded-full bg-fg-muted" aria-hidden="true" />
  </button>
</template>
