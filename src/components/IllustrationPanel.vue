<script setup lang="ts">
import { onBeforeUnmount, ref, watchEffect } from 'vue'
import type { Illustration } from '@/domain/types'

const props = defineProps<{
  illustration: Illustration | null | undefined
  alt: string
}>()

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
  <figure
    v-if="illustration && objectUrl"
    class="overflow-hidden rounded-xl border border-border"
  >
    <img
      :src="objectUrl"
      :alt="alt"
      class="h-auto w-full object-cover"
      loading="lazy"
    />
  </figure>
</template>