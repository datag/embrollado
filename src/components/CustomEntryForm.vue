<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Gender, Persona, Situation } from '@/domain/types'

const props = withDefaults(
  defineProps<{
    kind: 'partner' | 'situation'
    /** Prefill the form with an existing entry (edit mode). */
    initial?: Persona | Situation
    /** Edit mode: the id is kept so saving replaces the entry instead of duplicating it. */
    editing?: boolean
  }>(),
  { editing: false, initial: undefined },
)
const emit = defineEmits<{
  saved: [entry: Persona | Situation, saveTemplate: boolean]
  cancel: []
}>()

const initial = props.initial
const isPartner = computed(() => props.kind === 'partner')
const isPersona = (v: Persona | Situation): v is Persona => 'occupation' in v

const name = ref(initial ? initial.name : '')
const age = ref(initial && isPersona(initial) && initial.age != null ? initial.age : null)
const gender = ref<Gender | null>(
  initial && isPersona(initial) && initial.gender != null ? initial.gender : null,
)
const occupation = ref(initial && isPersona(initial) ? initial.occupation : '')
const text = ref(initial ? (isPersona(initial) ? initial.description : initial.setting) : '')
const saveTemplate = ref(false)

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
  // Edit mode keeps the identity (id, origin, visibility, createdAt) of the entry it prefilled.
  const id = initial?.id ?? crypto.randomUUID()
  const origin = initial?.origin ?? 'learner'
  const visibility = props.editing
    ? (initial?.visibility ?? 'template')
    : saveTemplate.value
      ? 'template'
      : 'session-only'
  const createdAt = initial?.createdAt ?? now
  if (isPartner.value) {
    const persona: Persona = {
      id,
      name: name.value.trim().slice(0, 60),
      age: age.value,
      gender: gender.value,
      occupation: occupation.value.trim().slice(0, 60),
      description: text.value.trim().slice(0, 400),
      origin,
      visibility,
      createdAt,
    }
    emit('saved', persona, props.editing ? false : saveTemplate.value)
  } else {
    const situation: Situation = {
      id,
      name: name.value.trim().slice(0, 80),
      setting: text.value.trim().slice(0, 400),
      keyMoments:
        initial && !isPersona(initial) ? initial.keyMoments : ['a key moment in this situation'],
      suggestedPartners: initial && !isPersona(initial) ? initial.suggestedPartners : [],
      origin,
      visibility,
      createdAt,
    }
    emit('saved', situation, props.editing ? false : saveTemplate.value)
  }
}
</script>

<template>
  <form
    class="rounded-lg border border-border bg-surface-raised p-3"
    :aria-label="$t(editing ? 'customForm.editTitle' : 'customForm.title')"
    @submit.prevent="save"
  >
    <h3 class="mb-2 font-medium">
      {{ $t(editing ? 'customForm.editTitle' : 'customForm.title') }}
    </h3>

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
      <span class="mb-1 block text-sm">{{ $t('customForm.gender') }}</span>
      <select
        v-model="gender"
        class="min-h-11 w-full rounded-lg border border-border px-3"
        data-testid="custom-gender"
      >
        <option value="">{{ $t('customForm.genderNone') }}</option>
        <option value="female">{{ $t('customForm.genderFemale') }}</option>
        <option value="male">{{ $t('customForm.genderMale') }}</option>
        <option value="other">{{ $t('customForm.genderOther') }}</option>
      </select>
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

    <div v-if="!editing" class="mb-3 flex items-center gap-2">
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
        {{ $t(editing ? 'customForm.saveChanges' : 'customForm.save') }}
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
