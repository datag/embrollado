<script setup lang="ts">
import { computed, ref } from 'vue'
import { LANGUAGES } from '@/domain/catalogue'
import type { Persona, Situation } from '@/domain/types'

const props = defineProps<{ kind: 'partner' | 'situation' }>()
const emit = defineEmits<{
  saved: [entry: Persona | Situation, saveTemplate: boolean]
  cancel: []
}>()

const name = ref('')
const age = ref<number | null>(null)
const occupation = ref('')
const text = ref('') // description (partner) or setting (situation)
const language = ref('en')
const saveTemplate = ref(false)

const isPartner = computed(() => props.kind === 'partner')

const nameLimit = isPartner.value ? 60 : 80
const textLabel = isPartner.value ? 'customForm.description' : 'customForm.setting'
const textLimit = 400

const nameTooLong = computed(() => name.value.length > nameLimit)
const textTooLong = computed(() => text.value.length > textLimit)
const ageOutOfRange = computed(() => age.value !== null && (age.value < 0 || age.value > 120))
const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    !nameTooLong.value &&
    !textTooLong.value &&
    !ageOutOfRange.value &&
    (!isPartner.value || occupation.value.trim().length > 0) &&
    text.value.trim().length > 0,
)

function save() {
  if (!canSave.value) return
  const now = new Date().toISOString()
  if (isPartner.value) {
    const persona: Persona = {
      id: crypto.randomUUID(),
      name: name.value.trim().slice(0, 60),
      age: age.value,
      occupation: occupation.value.trim().slice(0, 60),
      description: text.value.trim().slice(0, 400),
      origin: 'learner',
      visibility: saveTemplate.value ? 'template' : 'session-only',
      language: language.value,
      createdAt: now,
    }
    emit('saved', persona, saveTemplate.value)
  } else {
    const situation: Situation = {
      id: crypto.randomUUID(),
      name: name.value.trim().slice(0, 80),
      setting: text.value.trim().slice(0, 400),
      keyMoments: ['a key moment in this situation'],
      suggestedPartners: [],
      origin: 'learner',
      visibility: saveTemplate.value ? 'template' : 'session-only',
      language: language.value,
      createdAt: now,
    }
    emit('saved', situation, saveTemplate.value)
  }
}
</script>

<template>
  <form
    class="rounded-lg border border-border bg-surface-raised p-3"
    :aria-label="$t('customForm.title')"
    @submit.prevent="save"
  >
    <h3 class="mb-2 font-medium">{{ $t('customForm.title') }}</h3>

    <label class="mb-2 block">
      <span class="mb-1 block text-sm">
        {{ $t(isPartner ? 'customForm.partnerName' : 'customForm.situationName') }}
        <span v-if="nameTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <input
        v-model="name"
        type="text"
        :maxlength="nameLimit + 1"
        class="min-h-11 w-full rounded-lg border border-border px-3"
        :class="nameTooLong ? 'border-error' : ''"
      />
    </label>

    <label v-if="isPartner" class="mb-2 block">
      <span class="mb-1 block text-sm">
        {{ $t('customForm.age') }}
        <span v-if="ageOutOfRange" class="text-error">({{ $t('customForm.ageRange') }})</span>
      </span>
      <input
        v-model.number="age"
        type="number"
        min="0"
        max="120"
        class="min-h-11 w-full rounded-lg border border-border px-3"
        :class="ageOutOfRange ? 'border-error' : ''"
      />
    </label>

    <label v-if="isPartner" class="mb-2 block">
      <span class="mb-1 block text-sm">{{ $t('customForm.occupation') }}</span>
      <input
        v-model="occupation"
        type="text"
        maxlength="61"
        class="min-h-11 w-full rounded-lg border border-border px-3"
        :class="occupation.length > 60 ? 'border-error' : ''"
      />
    </label>

    <label class="mb-2 block">
      <span class="mb-1 block text-sm">
        {{ $t(textLabel) }} ({{ text.length }}/{{ textLimit }})
        <span v-if="textTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <textarea
        v-model="text"
        rows="3"
        class="w-full rounded-lg border border-border px-3 py-2"
        :class="textTooLong ? 'border-error' : ''"
      />
    </label>

    <label class="mb-3 block">
      <span class="mb-1 block text-sm">{{ $t('customForm.language') }}</span>
      <select v-model="language" class="min-h-11 w-full rounded-lg border border-border px-3">
        <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">
          {{ l.nameEn }} — {{ l.nativeName }}
        </option>
      </select>
    </label>

    <div class="mb-3 flex items-center gap-2">
      <input
        id="save-template"
        v-model="saveTemplate"
        type="checkbox"
        class="h-5 w-5 accent-[color:var(--color-accent)]"
      />
      <label for="save-template" class="text-sm">{{ $t('customForm.saveTemplate') }}</label>
    </div>

    <div class="flex gap-2">
      <button
        type="submit"
        class="min-h-11 flex-1 rounded-lg bg-accent px-4 font-medium text-accent-fg disabled:opacity-50"
        :disabled="!canSave"
      >
        {{ $t('customForm.save') }}
      </button>
      <button
        type="button"
        class="min-h-11 rounded-lg border border-border px-4"
        @click="emit('cancel')"
      >
        {{ $t('customForm.cancel') }}
      </button>
    </div>
  </form>
</template>
