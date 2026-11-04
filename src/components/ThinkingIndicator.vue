<script setup lang="ts">
import ThinkingDots from '@/components/ThinkingDots.vue'
defineProps<{ label: string }>()
</script>

<template>
  <div
    class="flex min-h-11 items-center gap-2.5 rounded-2xl border border-border bg-surface-raised px-4 py-3"
    role="status"
    data-testid="thinking-indicator"
  >
    <ThinkingDots />
    <span class="text-sm text-fg-muted">{{ label }}</span>
  </div>
</template>
