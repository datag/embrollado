<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { appConfig } from '@/config/app'
import { grantAccess } from '@/data/access'

/**
 * Full-screen access prompt that renders before anything else when an access code is configured at
 * build time (`APP_ACCESS_CODE`). A small hurdle against accidental use — the correct code is part
 * of the build, so it is explicitly NOT a security mechanism. On success a marker is stored in
 * localStorage (`embrollado.access.v1`) and the app unlocks; a wrong code just shows an error.
 */
const props = withDefaults(defineProps<{ accessCode?: string }>(), {
  accessCode: undefined,
})

const emit = defineEmits<{ granted: [] }>()
const { t } = useI18n()

const expected = props.accessCode ?? appConfig.accessCode ?? ''

const code = ref('')
const wrong = ref(false)
const field = ref<HTMLInputElement | null>(null)

onMounted(() => field.value?.focus())

function submit() {
  if (code.value.trim() === expected) {
    wrong.value = false
    // A failed marker write only means this session itself stays unlocked.
    grantAccess()
    emit('granted')
  } else {
    wrong.value = true
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <form
      class="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6"
      @submit.prevent="submit"
    >
      <h1 class="mb-1 text-lg font-bold">{{ t('app.name') }}</h1>
      <p class="mb-4 text-sm text-fg-muted">{{ t('gate.hint') }}</p>
      <label for="access-code" class="mb-1 block text-sm">{{ t('gate.codeLabel') }}</label>
      <input
        id="access-code"
        ref="field"
        v-model="code"
        type="password"
        autocomplete="off"
        class="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
        :aria-invalid="wrong || undefined"
        @input="wrong = false"
      />
      <p v-if="wrong" role="alert" class="mt-2 text-sm text-error">{{ t('gate.error') }}</p>
      <button
        type="submit"
        class="mt-4 min-h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
      >
        {{ t('gate.submit') }}
      </button>
    </form>
  </div>
</template>
