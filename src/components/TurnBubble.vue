<script setup lang="ts">
defineProps<{
  text: string | null
  side: 'partner' | 'learner'
  streaming?: boolean
}>()
</script>

<template>
  <div :class="side === 'partner' ? 'text-left' : 'text-right'">
    <div
      class="inline-block max-w-full rounded-2xl px-4 py-2 text-left"
      :class="
        side === 'partner' ? 'bg-surface-raised border border-border' : 'bg-accent text-accent-fg'
      "
    >
      <p class="whitespace-pre-wrap break-words">
        {{ text }}
        <span v-if="streaming" aria-hidden="true" class="animate-pulse">▍</span>
      </p>
    </div>
  </div>
</template>
