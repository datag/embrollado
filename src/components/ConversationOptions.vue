<script setup lang="ts">
/**
 * Per-session conversation options (T112): chosen when the session starts and snapshotted on the
 * Session so a reload or an export keeps them. The only current option releases the learner's
 * stored name and details to the AI partner from the first line on.
 */
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <fieldset>
    <legend class="mb-1 block text-sm font-medium">{{ $t('setup.options') }}</legend>
    <label class="flex min-h-11 items-start gap-3 rounded-lg border border-border px-3 py-2">
      <input
        type="checkbox"
        class="mt-1 h-5 w-5 accent-[color:var(--color-accent)]"
        :checked="modelValue"
        data-testid="knows-learner"
        @change="onChange"
      />
      <span>
        <span class="block text-sm font-medium">{{ $t('setup.knowsLearner') }}</span>
        <span class="block text-xs text-fg-muted">{{ $t('setup.knowsLearnerHint') }}</span>
      </span>
    </label>
  </fieldset>
</template>
