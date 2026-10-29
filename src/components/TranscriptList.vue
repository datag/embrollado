<script setup lang="ts">
import type { Turn } from '@/domain/types'
import TurnBubble from '@/components/TurnBubble.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'

defineProps<{ turns: Turn[] }>()
</script>

<template>
  <div class="space-y-3">
    <template v-for="turn in turns" :key="turn.id">
      <!-- Chronologische Reihenfolge: Antwort + Feedback (Erklärung der eigenen Antwort), dann
           die Partnerzeile (FR-011). Die Übersetzung steht in einer schreibgeschützten
           Vorschau immer sichtbar unter der Zeile (FR-057). -->
      <div v-if="turn.learnerText" class="flex flex-col gap-2">
        <TurnBubble :text="turn.learnerText" side="learner" />
        <FeedbackPanel :turn="turn" :show-explain="false" />
      </div>
      <TurnBubble
        v-if="turn.partnerText"
        :text="turn.partnerText"
        side="partner"
        :translation="turn.translation"
      />
    </template>
  </div>
</template>
