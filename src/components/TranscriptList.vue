<script setup lang="ts">
import type { Turn } from '@/domain/types'
import TurnBubble from '@/components/TurnBubble.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'

defineProps<{ turns: Turn[] }>()
</script>

<template>
  <div class="space-y-3">
    <template v-for="turn in turns" :key="turn.id">
      <TurnBubble :text="turn.partnerText" side="partner" />
      <div v-if="turn.learnerText" class="flex flex-col gap-2">
        <TurnBubble :text="turn.learnerText" side="learner" />
        <FeedbackPanel :turn="turn" :show-explain="false" />
      </div>
    </template>
  </div>
</template>
