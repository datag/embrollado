<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'

/**
 * Learner profile form (T072): name ≤ 60 chars, personal details ≤ 500 chars. Both are sent to the
 * AI service as part of the model context — stated in the privacy notes.
 */
const { settings, update } = useSettings()

const nameTooLong = computed(() => settings.name.length > 60)
const detailsTooLong = computed(() => settings.details.length > 500)

function onName(event: Event) {
  const value = (event.target as HTMLInputElement).value
  update({ name: value.slice(0, 60) })
}

function onDetails(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  update({ details: value.slice(0, 500) })
}
</script>

<template>
  <div class="space-y-3">
    <label class="block">
      <span class="mb-1 block text-sm">
        {{ $t('settings.name') }}
        <span v-if="nameTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <input
        :value="settings.name"
        type="text"
        maxlength="61"
        class="min-h-11 w-full rounded-lg border border-border px-3"
        :class="nameTooLong ? 'border-error' : ''"
        @input="onName"
      />
      <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.nameHint') }}</span>
    </label>

    <label class="block">
      <span class="mb-1 block text-sm">
        {{ $t('settings.details') }} ({{ settings.details.length }}/500)
        <span v-if="detailsTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <textarea
        :value="settings.details"
        rows="3"
        class="w-full rounded-lg border border-border px-3 py-2"
        :class="detailsTooLong ? 'border-error' : ''"
        @input="onDetails"
      />
      <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.detailsHint') }}</span>
    </label>
  </div>
</template>
