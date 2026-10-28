<script setup lang="ts">
import { computed, ref } from 'vue'
import { SITUATIONS } from '@/domain/catalogue'
import type { Situation } from '@/domain/types'

const props = defineProps<{
  modelValue: string | null
  templates: Situation[]
  searchLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string | null]; pickCustom: [] }>()

const query = ref('')
const value = computed({
  get: () => props.modelValue,
  set: (v: string | null) => emit('update:modelValue', v),
})

const entries = computed<Situation[]>(() => {
  const builtin = [...SITUATIONS]
  const customs = props.templates.filter((s) => s.origin === 'learner')
  return [...builtin, ...customs]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(
    (s) => s.name.toLowerCase().includes(q) || s.setting.toLowerCase().includes(q),
  )
})
</script>

<template>
  <fieldset>
    <legend class="mb-1 block text-sm font-medium">{{ $t('setup.situation') }}</legend>
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
          <span class="block text-xs text-fg-muted">{{ entry.setting }}</span>
        </button>
      </li>
      <li>
        <button
          type="button"
          class="min-h-11 w-full rounded-lg border border-dashed border-border px-3 text-left text-accent"
          @click="emit('pickCustom')"
        >
          {{ $t('setup.situationCustom') }}
        </button>
      </li>
    </ul>
  </fieldset>
</template>