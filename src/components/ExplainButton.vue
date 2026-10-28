<script setup lang="ts">
defineProps<{ disabled?: boolean; busy?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="min-h-11 rounded-lg border border-border px-4 font-medium"
    :disabled="disabled || busy"
    @click="$emit('click')"
  >
    {{ busy ? $t('feedback.explaining') : $t('feedback.explain') }}
  </button>
</template>
