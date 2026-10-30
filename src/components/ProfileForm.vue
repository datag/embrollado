<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'
import type { Gender } from '@/domain/types'

/**
 * Learner profile form (T072, T112): the perceivable traits (appearance, voice, age, gender) are
 * part of the model context in every conversation; the name and the personal details are only
 * released when the per-session option "the AI partner already knows you" is enabled — but always
 * used when a picture is generated. What the learner enters here can reach the configured AI
 * service — the privacy notes and the pseudonym tip say so.
 */
const { settings, update } = useSettings()

const nameTooLong = computed(() => settings.name.length > 60)
const detailsTooLong = computed(() => settings.details.length > 500)
const appearanceTooLong = computed(() => settings.appearance.length > 500)
const voiceTooLong = computed(() => settings.voice.length > 300)
const ageOutOfRange = computed(
  () => settings.age !== null && (settings.age < 0 || settings.age > 120),
)

function onName(event: Event) {
  const value = (event.target as HTMLInputElement).value
  update({ name: value.slice(0, 60) })
}

function onDetails(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  update({ details: value.slice(0, 500) })
}

function onAppearance(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  update({ appearance: value.slice(0, 500) })
}

function onVoice(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  update({ voice: value.slice(0, 300) })
}

function onAge(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim()
  if (raw === '') {
    update({ age: null })
    return
  }
  const n = Number(raw)
  update({ age: Number.isFinite(n) && n >= 0 && n <= 120 ? Math.floor(n) : null })
}

function onGender(event: Event) {
  const value = (event.target as HTMLSelectElement).value as Gender | ''
  update({ gender: value || null })
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs text-fg-muted">{{ $t('settings.profileTip') }}</p>

    <h3 class="pt-1 text-sm font-semibold">{{ $t('settings.perceivable') }}</h3>
    <p class="text-xs text-fg-muted">{{ $t('settings.perceivableHint') }}</p>

    <label class="block">
      <span class="mb-1 block text-sm">
        {{ $t('settings.appearance') }} ({{ settings.appearance.length }}/500)
        <span v-if="appearanceTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <textarea
        :value="settings.appearance"
        rows="2"
        class="w-full rounded-lg border border-border px-3 py-2"
        :class="appearanceTooLong ? 'border-error' : ''"
        @input="onAppearance"
      />
      <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.appearanceHint') }}</span>
    </label>

    <label class="block">
      <span class="mb-1 block text-sm">
        {{ $t('settings.voice') }} ({{ settings.voice.length }}/300)
        <span v-if="voiceTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <textarea
        :value="settings.voice"
        rows="2"
        class="w-full rounded-lg border border-border px-3 py-2"
        :class="voiceTooLong ? 'border-error' : ''"
        @input="onVoice"
      />
      <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.voiceHint') }}</span>
    </label>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-sm">
          {{ $t('settings.age') }}
          <span v-if="ageOutOfRange" class="text-error">({{ $t('customForm.ageRange') }})</span>
        </span>
        <input
          :value="settings.age ?? ''"
          type="number"
          min="0"
          max="120"
          class="min-h-11 w-full rounded-lg border border-border px-3"
          :class="ageOutOfRange ? 'border-error' : ''"
          @input="onAge"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm">{{ $t('settings.gender') }}</span>
        <select
          :value="settings.gender ?? ''"
          class="min-h-11 w-full rounded-lg border border-border px-3"
          data-testid="profile-gender"
          @change="onGender"
        >
          <option value="">{{ $t('customForm.genderNone') }}</option>
          <option value="female">{{ $t('customForm.genderFemale') }}</option>
          <option value="male">{{ $t('customForm.genderMale') }}</option>
          <option value="other">{{ $t('customForm.genderOther') }}</option>
        </select>
      </label>
    </div>

    <h3 class="pt-1 text-sm font-semibold">{{ $t('settings.otherData') }}</h3>
    <p class="text-xs text-fg-muted">{{ $t('settings.otherDataHint') }}</p>

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
