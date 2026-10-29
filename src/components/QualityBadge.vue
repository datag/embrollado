<script setup lang="ts">
import { computed } from 'vue'
import type { Badge, BadgeTier } from '@/domain/types'

const props = defineProps<{ badge: Badge }>()

// Full literal class names so Tailwind v4 generates every bg-badge-* utility (a dynamic
// `bg-badge-${tier}` would otherwise not be picked up by the source scanner → invisible pill).
const TIER_CLASS: Record<BadgeTier, string> = {
  perfect: 'bg-badge-perfect',
  good: 'bg-badge-good',
  acceptable: 'bg-badge-acceptable',
  unsatisfactory: 'bg-badge-unsatisfactory',
  unknown: 'bg-badge-unknown',
}

const tierClass = computed(() => TIER_CLASS[props.badge.tier] ?? 'bg-badge-acceptable')
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
    :class="`${tierClass} text-badge-fg`"
  >
    {{ badge.label }}
  </span>
</template>
