<script setup lang="ts">
import { computed } from 'vue'
import { LEVELS } from '@/domain/catalogue'
import type { Level } from '@/domain/types'

const props = defineProps<{ modelValue: Level }>()
const emit = defineEmits<{ 'update:modelValue': [Level] }>()

const value = computed({
  get: () => props.modelValue,
  set: (v: Level) => emit('update:modelValue', v),
})
</script>

<template>
  <fieldset>
    <legend class="mb-1 block text-sm font-medium">{{ $t('setup.level') }}</legend>
    <div class="grid gap-2">
      <label
        v-for="level in LEVELS"
        :key="level.id"
        class="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2"
        :class="value === level.id ? 'border-accent' : ''"
      >
        <input
          v-model="value"
          type="radio"
          name="level"
          :value="level.id"
          class="mt-1.5 h-5 w-5 shrink-0 accent-[color:var(--color-accent)]"
          @change="value = level.id"
        />
        <span>
          <span class="block font-medium">{{ level.name }}</span>
          <span class="block text-sm text-fg-muted">{{ $t(`level.${level.id}`) }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
