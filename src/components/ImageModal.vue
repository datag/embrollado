<script setup lang="ts">
import { onBeforeUnmount, ref, watchEffect } from 'vue'
import type { Illustration } from '@/domain/types'

/**
 * Lightbox for a generated illustration (FR-028 as amended — "see the full resolution").
 *
 * Built on the native `<dialog>` element with `showModal()`: focus is trapped inside, Escape
 * closes, the content is in the top layer and the dimmed backdrop is `::backdrop` — no library,
 * fully keyboard-operable. The modal shows while `illustration` is non-null; any close action
 * (Escape, backdrop click, the close button) emits `close` so the parent nulls the prop again.
 */
const props = defineProps<{
  /** Non-null while the lightbox should be shown; null closes it. */
  illustration: Illustration | null
  alt: string
}>()
const emit = defineEmits<{ close: [] }>()

const dialogEl = ref<HTMLDialogElement | null>(null)
const objectUrl = ref<string | null>(null)

// Own object URL from the same bytes — cheap, and revoke it when the selection changes.
watchEffect(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = props.illustration ? URL.createObjectURL(props.illustration.bytes) : null
})

// Keep the open state in lockstep with the prop.
watchEffect(() => {
  const d = dialogEl.value
  if (!d) return
  if (props.illustration && objectUrl.value && !d.open) d.showModal()
  if (!props.illustration && d.open) d.close()
})

// Best practice: while a modal is open the page behind should not scroll.
watchEffect(() => {
  document.body.classList.toggle('overflow-hidden', !!props.illustration)
})

function close() {
  emit('close')
}

onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})
</script>

<template>
  <dialog
    ref="dialogEl"
    aria-modal="true"
    class="fixed inset-0 m-auto h-fit w-fit max-h-[90dvh] max-w-[92dvw] overflow-hidden rounded-xl border border-border bg-surface p-2 text-fg shadow-2xl"
    :aria-label="alt"
    @cancel.prevent="close"
    @click.self="close"
  >
    <img
      v-if="illustration && objectUrl"
      :src="objectUrl"
      :alt="alt"
      class="block max-h-[82dvh] max-w-[86dvw] rounded-lg object-contain"
    />
    <button
      type="button"
      class="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-raised text-fg"
      :aria-label="$t('dialogue.illustrationClose')"
      :title="$t('dialogue.illustrationClose')"
      autofocus
      @click="close"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" />
      </svg>
    </button>
  </dialog>
</template>

<style scoped>
/* A dimmed, theme-aware backdrop behind the top-layer dialog. */
dialog::backdrop {
  background: rgb(0 0 0 / 0.65);
}
</style>
