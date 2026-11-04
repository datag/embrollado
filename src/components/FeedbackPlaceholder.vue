<script setup lang="ts">
import ThinkingDots from '@/components/ThinkingDots.vue'

/**
 * The loading card that occupies the feedback block's position while the model is still producing
 * the turn (FR-035, T128). It is the app's own status message — never the partner's voice, because
 * the partner does not know the rating (FR-061). Same quiet, recessed styling as the completed
 * feedback block, so the layout does not jump once the assessment lands.
 */
defineProps<{ label: string }>()
</script>

<template>
  <div
    class="rounded-xl border border-border bg-surface-muted p-3"
    role="status"
    data-testid="feedback-placeholder"
  >
    <div class="flex items-center gap-2.5 text-sm text-fg-muted">
      <ThinkingDots />
      <span>{{ label }}</span>
    </div>
  </div>
</template>
