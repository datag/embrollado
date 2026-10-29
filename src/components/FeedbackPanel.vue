<script setup lang="ts">
import type { Turn } from '@/domain/types'
import QualityBadge from '@/components/QualityBadge.vue'
import { renderMarkdown } from '@/utils/markdown'

defineProps<{
  turn: Turn
}>()

const md = (value: string | null | undefined) => (value ? renderMarkdown(value) : '')
const heading = 'text-xs font-semibold uppercase tracking-wide text-fg-muted'
</script>

<template>
  <div
    class="feedback-prose rounded-xl border border-border bg-surface-raised p-3"
    data-testid="feedback"
  >
    <!-- Fixed order (settings-profile.md §3): explanation → correction → interpretation →
         assumptions → badge → issues (T052). Every field targets the learner's answer in the
         LATEST turn — the explanation (like interpretation, badge and issues) concerns the
         learner's own latest utterance, not a previous turn. The partner line's translation sits
         on the partner bubble (FR-057). -->
    <section v-if="turn.explanation" class="mb-2">
      <h4 :class="heading">{{ $t('feedback.explanation') }}</h4>
      <div class="text-left" v-html="md(turn.explanation)" />
    </section>

    <section v-if="turn.correctedText" class="mb-2">
      <h4 :class="heading">{{ $t('feedback.correction') }}</h4>
      <p class="text-left">{{ turn.correctedText }}</p>
    </section>

    <section v-if="turn.interpretation" class="mb-2">
      <h4 :class="heading">{{ $t('feedback.interpretation') }}</h4>
      <p class="text-left" v-html="md(turn.interpretation)" />
    </section>

    <section v-if="turn.assumptions.length" class="mb-2">
      <h4 :class="heading">{{ $t('feedback.assumptions') }}</h4>
      <ul class="text-left">
        <li v-for="(a, i) in turn.assumptions" :key="i" class="mb-1">
          {{ $t('feedback.assumption', { original: a.original, filled: a.filled }) }}
          <span v-if="a.reason" class="text-fg-muted">— {{ a.reason }}</span>
        </li>
      </ul>
    </section>

    <section v-if="turn.badge" class="mb-2 flex flex-wrap items-center gap-2">
      <h4 :class="heading">{{ $t('feedback.badge') }}</h4>
      <QualityBadge :badge="turn.badge" />
    </section>

    <section v-if="turn.issues.length" class="mb-2">
      <h4 :class="heading">{{ $t('feedback.issues') }}</h4>
      <ul class="text-left">
        <li v-for="(issue, i) in turn.issues" :key="i" class="mb-1">
          <span class="font-semibold">{{ issue.category }}</span> —
          {{ issue.detail }}
          <span v-if="issue.suggestion" class="text-fg-muted">({{ issue.suggestion }})</span>
        </li>
      </ul>
    </section>
  </div>
</template>
