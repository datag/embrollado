<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Gender, Level, Persona, Situation } from '@/domain/types'
import type { DraftContext } from '@/ai/prompts'
import { useDraftGenerator } from '@/composables/useDraftGenerator'
import SpinnerIcon from '@/components/SpinnerIcon.vue'

const props = withDefaults(
  defineProps<{
    kind: 'partner' | 'situation'
    /** Prefill the form with an existing entry (edit mode). */
    initial?: Persona | Situation
    /** Edit mode: the id is kept so saving replaces the entry instead of duplicating it. */
    editing?: boolean
    /** The selected proficiency level — sent with the draft request so it suits the learner. */
    level: Level
    /** The selected target language — sent with the draft request as context. */
    targetLanguage: string
  }>(),
  { editing: false, initial: undefined },
)
const emit = defineEmits<{
  saved: [entry: Persona | Situation, saveTemplate: boolean]
  cancel: []
}>()

/** Random situation / partner generation into the form (FR-064). */
const generator = useDraftGenerator()
const busy = generator.busy
const draftError = generator.errorKind
const seedHint = ref<string | null>(null)

const draftContext = computed<DraftContext>(() => ({
  level: props.level,
  targetLanguage: props.targetLanguage,
}))

async function onGenerate() {
  generator.clearError()
  seedHint.value = null
  const ctx = draftContext.value
  if (isPartner.value) {
    const result = await generator.generatePartner(ctx)
    if (result) {
      const { draft, seed } = result
      name.value = draft.name
      age.value = draft.age
      gender.value = draft.gender
      occupation.value = draft.occupation
      text.value = draft.description
      seedHint.value = [seed.genre, seed.place, seed.role].join(' · ')
    }
  } else {
    const result = await generator.generateSituation(ctx)
    if (result) {
      const { draft, seed } = result
      name.value = draft.name
      text.value = draft.setting
      seedHint.value = [seed.genre, seed.place, seed.aim].join(' · ')
    }
  }
}

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
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 class="font-medium">
        {{ $t(editing ? 'customForm.editTitle' : 'customForm.title') }}
      </h3>
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-accent disabled:opacity-50"
        :class="busy ? 'cursor-wait' : ''"
        :disabled="busy"
        :aria-label="$t('customForm.aiGenerate')"
        :title="$t('customForm.aiGenerateHint')"
        data-testid="ai-generate"
        @click="onGenerate"
      >
        <SpinnerIcon v-if="busy" class="h-4 w-4" />
        <span v-else aria-hidden="true">🪄</span>
      </button>
    </div>

    <p v-if="draftError" class="mb-2 text-sm text-error" data-testid="ai-draft-error">
      <template v-if="draftError === 'serviceNotConfigured'">
        {{ $t('errors.serviceNotConfigured') }}
        <RouterLink to="/settings" class="underline">{{
          $t('errors.serviceNotConfiguredAction')
        }}</RouterLink>
      </template>
      <template v-else>{{ $t(`errors.${draftError}`) }}</template>
    </p>
    <p v-else-if="seedHint" class="mb-2 text-xs text-fg-muted" data-testid="ai-seed-hint">
      {{ $t('customForm.aiSeed', { elements: seedHint }) }}
    </p>

    <label class="mb-2 block">
      <span class="mb-1 block text-sm">
        {{ $t(isPartner ? 'customForm.partnerName' : 'customForm.situationName') }}
        <span v-if="nameTooLong" class="text-error">({{ $t('customForm.tooLong') }})</span>
      </span>
      <input
        v-model="name"
        type="text"
        :maxlength="nameLimit + 1"
        class="min-h-11 w-full rounded-lg border border-border px-3 disabled:opacity-50"
        :class="nameTooLong ? 'border-error' : ''"
        :disabled="busy"
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
        class="min-h-11 w-full rounded-lg border border-border px-3 disabled:opacity-50"
        :class="ageOutOfRange ? 'border-error' : ''"
        :disabled="busy"
      />
    </label>

    <label v-if="isPartner" class="mb-2 block">
      <span class="mb-1 block text-sm">{{ $t('customForm.gender') }}</span>
      <select
        v-model="gender"
        class="min-h-11 w-full rounded-lg border border-border px-3 disabled:opacity-50"
        data-testid="custom-gender"
        :disabled="busy"
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
        class="min-h-11 w-full rounded-lg border border-border px-3 disabled:opacity-50"
        :class="occupation.length > 60 ? 'border-error' : ''"
        :disabled="busy"
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
        class="w-full rounded-lg border border-border px-3 py-2 disabled:opacity-50"
        :class="textTooLong ? 'border-error' : ''"
        :disabled="busy"
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
        :disabled="!canSave || busy"
      >
        {{ $t(editing ? 'customForm.saveChanges' : 'customForm.save') }}
      </button>
      <button
        type="button"
        class="min-h-11 rounded-lg border border-border px-4 disabled:opacity-50"
        :disabled="busy"
        @click="emit('cancel')"
      >
        {{ $t('customForm.cancel') }}
      </button>
    </div>
  </form>
</template>
