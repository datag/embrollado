<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PARTNERS } from '@/domain/catalogue'
import type { Gender, Persona } from '@/domain/types'

const props = defineProps<{
  modelValue: string | null
  templates: Persona[]
  searchLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string | null]; pickCustom: [] }>()
const { t } = useI18n()

const query = ref('')
const value = computed({
  get: () => props.modelValue,
  set: (v: string | null) => emit('update:modelValue', v),
})

const entries = computed<Persona[]>(() => {
  const builtin = [...PARTNERS]
  const customs = props.templates.filter((p) => p.origin === 'learner')
  return [...builtin, ...customs]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.occupation.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  )
})

function genderLabel(g: Gender | null): string {
  if (g === 'female') return t('customForm.genderFemale')
  if (g === 'male') return t('customForm.genderMale')
  if (g === 'other') return t('customForm.genderOther')
  return ''
}

function describe(p: Persona): string {
  const parts = [p.age != null ? String(p.age) : '', genderLabel(p.gender)]
  if (p.occupation) parts.push(p.occupation)
  return parts.filter(Boolean).join(', ')
}
</script>

<template>
  <fieldset>
    <legend class="mb-1 block text-sm font-medium">{{ $t('setup.partner') }}</legend>
    <input
      v-model="query"
      type="search"
      :placeholder="searchLabel"
      class="min-h-11 mb-2 w-full rounded-lg border border-border bg-surface-raised px-3 text-fg"
    />
    <ul class="flex max-h-64 flex-col gap-1 overflow-y-auto">
      <li v-for="entry in filtered" :key="entry.id">
        <button
          type="button"
          class="min-h-11 w-full rounded-lg border px-3 text-left"
          :class="
            value === entry.id
              ? 'border-accent bg-accent/10 text-fg'
              : 'border-border bg-surface-raised'
          "
          @click="value = entry.id"
        >
          <span class="block font-medium">{{ entry.name }}</span>
          <span class="block text-xs text-fg-muted">{{ describe(entry) }}</span>
        </button>
      </li>
      <li>
        <button
          type="button"
          class="min-h-11 w-full rounded-lg border border-dashed border-border px-3 text-left text-accent"
          @click="emit('pickCustom')"
        >
          {{ $t('setup.partnerCustom') }}
        </button>
      </li>
    </ul>
  </fieldset>
</template>
