<script setup lang="ts">
import { computed } from 'vue'
import type { Badge, BadgeTier } from '@/domain/types'

const props = defineProps<{ badge: Badge }>()

const TIER_CLASS: Record<BadgeTier, string> = {
  perfect: 'perfect',
  good: 'good',
  acceptable: 'acceptable',
  unsatisfactory: 'unsatisfactory',
}

const tierClass = computed(() => TIER_CLASS[props.badge.tier] ?? 'acceptable')
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
    :class="`bg-badge-${tierClass} text-badge-fg`"
  >
    {{ badge.label }}
  </span>
</template>