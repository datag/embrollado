<script setup lang="ts">
import { computed } from 'vue'
import { LANGUAGES } from '@/domain/catalogue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const value = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})
</script>

<template>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">{{ $t('setup.language') }}</span>
    <select
      v-model="value"
      class="min-h-11 w-full rounded-lg border border-border bg-surface-raised px-3 text-fg"
    >
      <option v-for="lang in LANGUAGES" :key="lang.code" :value="lang.code">
        {{ lang.nameEn }} — {{ lang.nativeName }}
      </option>
    </select>
  </label>
</template>