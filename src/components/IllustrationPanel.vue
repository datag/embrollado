<script setup lang="ts">
import { onBeforeUnmount, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Illustration } from '@/domain/types'

const props = defineProps<{
  illustration: Illustration | null | undefined
  alt: string
}>()
const emit = defineEmits<{ open: []; loaded: [] }>()
const { t } = useI18n()

const objectUrl = ref<string | null>(null)

watchEffect(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = props.illustration ? URL.createObjectURL(props.illustration.bytes) : null
})

onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})
</script>

<template>
  <figure v-if="illustration && objectUrl" class="overflow-hidden rounded-xl border border-border">
    <!-- A thumbnail is a control: clicking it opens the full-resolution lightbox (ImageModal). -->
    <button
      type="button"
      class="group block w-full cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      :aria-label="t('dialogue.enlarge')"
      :title="t('dialogue.enlarge')"
      @click="emit('open')"
    >
      <img
        :src="objectUrl"
        :alt="alt"
        class="h-auto w-full object-cover transition group-hover:opacity-95"
        loading="lazy"
        @load="emit('loaded')"
      />
    </button>
  </figure>
</template>
