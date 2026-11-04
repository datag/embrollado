<script setup lang="ts">
/**
 * The three soft bouncing dots — a warm "something is coming" cue used by the thinking indicator
 * and the feedback placeholder. Shared so the animation lives in exactly one place.
 */
</script>

<template>
  <span class="flex gap-1" aria-hidden="true">
    <span v-for="i in 3" :key="i" class="thinking-dot" />
  </span>
</template>

<style scoped>
.thinking-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--color-fg-muted);
  animation: thinking-bounce 1.2s infinite ease-in-out;
}
.thinking-dot:nth-child(2) {
  animation-delay: 0.15s;
}
.thinking-dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes thinking-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
