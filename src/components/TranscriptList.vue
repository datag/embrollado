<script setup lang="ts">
import type { Turn } from '@/domain/types'
import TurnBubble from '@/components/TurnBubble.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'

defineProps<{ turns: Turn[] }>()
</script>

<template>
  <div class="space-y-3">
    <template v-for="(turn, idx) in turns" :key="turn.id">
      <!-- Chronologische Reihenfolge: Antwort + Feedback (Übersetzung der beantworteten Zeile),
           dann die Partnerzeile (FR-011). -->
      <div v-if="turn.learnerText" class="flex flex-col gap-2">
        <TurnBubble :text="turn.learnerText" side="learner" />
        <FeedbackPanel
          :turn="turn"
          :prev-turn="idx > 0 ? turns[idx - 1] : undefined"
          :show-explain="false"
        />
      </div>
      <TurnBubble v-if="turn.partnerText" :text="turn.partnerText" side="partner" />
    </template>
  </div>
</template>
