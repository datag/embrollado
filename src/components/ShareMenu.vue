<script setup lang="ts">
import { ref, toRaw } from 'vue'
import {
  createExportBlob,
  exportDownloadName,
  validateImportText,
  importSessions,
  type ExportDoc,
} from '@/data/exportImport'
import SpinnerIcon from '@/components/SpinnerIcon.vue'

/**
 * The Share action (T066, D9): **Download file** and **Import file** are always available; the
 * native share entry appears only when `navigator.canShare({ files })` is true. The share entry
 * reuses the same export blob, so download and share always produce the same file.
 */

const emit = defineEmits<{ imported: []; cancelled: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
/** Which export/share action is currently building a blob (single flight). */
const busy = ref<string | null>(null)
const importState = ref<{
  doc: ExportDoc
  count: number
  existingIds: string[]
} | null>(null)
const message = ref<{ kind: 'ok' | 'error'; key: string; params?: Record<string, unknown> } | null>(
  null,
)

const canShareFiles =
  typeof navigator !== 'undefined' &&
  'canShare' in navigator &&
  (() => {
    try {
      return navigator.canShare({
        files: [new File(['x'], 'x.json', { type: 'application/json' })],
      })
    } catch {
      return false
    }
  })()

async function exportBlob(withPictures = false): Promise<Blob> {
  return createExportBlob({ includePictures: withPictures })
}

async function download(withPictures = false) {
  const action = withPictures ? 'exportWithPictures' : 'download'
  if (busy.value) return
  busy.value = action
  try {
    const blob = await exportBlob(withPictures)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: exportDownloadName(),
    })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    message.value = { kind: 'ok', key: 'exportDone' }
  } finally {
    busy.value = null
  }
}

async function share() {
  if (busy.value) return
  busy.value = 'shareToApp'
  try {
    const blob = await exportBlob()
    const file = new File([blob], exportDownloadName(), { type: 'application/json' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Embrollado' })
      } catch {
        /* the learner cancelled the system share sheet — not an error */
      }
    }
  } finally {
    busy.value = null
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function pickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 250 * 1024 * 1024) {
    message.value = { kind: 'error', key: 'importTooLarge' }
    return
  }
  const text = await file.text()
  const validation = await validateImportText(text)
  if (!validation.ok) {
    message.value = {
      kind: 'error',
      key:
        validation.error === 'too-large'
          ? 'importTooLarge'
          : validation.error === 'newer-version'
            ? 'importNewer'
            : 'importBadFile',
    }
    return
  }
  if (validation.doc) {
    importState.value = {
      doc: validation.doc,
      count: validation.sessionCount,
      existingIds: validation.existingIds,
    }
  }
}

async function confirmImport() {
  if (!importState.value) return
  importing.value = true
  try {
    // `importState` is a deep ref, so its doc is a reactive proxy — IndexedDB cannot structured
    // clone a proxy, so write the raw object.
    await importSessions(toRaw(importState.value.doc))
    message.value = { kind: 'ok', key: 'importDone', params: { count: importState.value.count } }
    emit('imported')
  } catch {
    message.value = { kind: 'error', key: 'importBadFile' }
  } finally {
    importing.value = false
    importState.value = null
  }
}

async function cancelImport() {
  importState.value = null
  emit('cancelled')
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
        :class="busy === 'download' ? 'cursor-wait' : ''"
        :disabled="busy !== null"
        @click="download(false)"
      >
        <SpinnerIcon v-if="busy === 'download'" class="h-4 w-4" />
        {{ $t('exportImport.download') }}
      </button>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
        :class="busy === 'exportWithPictures' ? 'cursor-wait' : ''"
        :disabled="busy !== null"
        @click="download(true)"
      >
        <SpinnerIcon v-if="busy === 'exportWithPictures'" class="h-4 w-4" />
        {{ $t('exportImport.exportWithPictures') }}
      </button>
      <button
        type="button"
        class="min-h-11 rounded-lg border border-border px-3"
        @click="openFilePicker"
      >
        {{ $t('exportImport.import') }}
      </button>
      <button
        v-if="canShareFiles"
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
        :class="busy === 'shareToApp' ? 'cursor-wait' : ''"
        :disabled="busy !== null"
        @click="share"
      >
        <SpinnerIcon v-if="busy === 'shareToApp'" class="h-4 w-4" />
        {{ $t('exportImport.shareToApp') }}
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="pickFile"
    />

    <p v-if="message" class="text-sm" :class="message.kind === 'ok' ? 'text-ok' : 'text-error'">
      {{ $t(`exportImport.${message.key}`, message.params ?? {}) }}
    </p>

    <!-- import warning (FR-055) -->
    <div
      v-if="importState"
      role="alertdialog"
      aria-modal="true"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
    >
      <div class="w-full max-w-md rounded-xl border border-border bg-surface-raised p-4">
        <h2 class="mb-2 font-bold">{{ $t('exportImport.importWarningTitle') }}</h2>
        <p class="mb-2 text-sm">
          {{
            $t('exportImport.importWarning', {
              count: importState.count,
              plural: importState.count === 1 ? '' : 's',
            })
          }}
        </p>
        <p
          v-if="importState.existingIds.length"
          class="mb-3 rounded bg-accent/10 px-3 py-2 text-sm"
        >
          {{ $t('exportImport.importReplaces', { count: importState.existingIds.length }) }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 font-medium text-accent-fg disabled:opacity-50"
            :class="importing ? 'cursor-wait' : ''"
            :disabled="importing"
            @click="confirmImport"
          >
            <SpinnerIcon v-if="importing" class="h-4 w-4" />
            {{ $t('exportImport.confirmImport') }}
          </button>
          <button type="button" class="min-h-11 rounded-lg border border-border px-4" @click="cancelImport">
            {{ $t('exportImport.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
