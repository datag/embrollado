<script setup lang="ts">
import { ref } from 'vue'
import {
  createExportBlob,
  exportDownloadName,
  validateImportText,
  importSessions,
  type ExportDoc,
} from '@/data/exportImport'

/**
 * The Share action (T066, D9): **Download file** and **Import file** are always available; the
 * native share entry appears only when `navigator.canShare({ files })` is true. The share entry
 * reuses the same export blob, so download and share always produce the same file.
 */

const emit = defineEmits<{ imported: []; cancelled: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importState = ref<{
  doc: ExportDoc
  count: number
  existingIds: string[]
} | null>(null)
const message = ref<{ kind: 'ok' | 'error'; key: string; params?: Record<string, unknown> } | null>(null)

const canShareFiles =
  typeof navigator !== 'undefined' &&
  'canShare' in navigator &&
  (() => {
    try {
      return navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })
    } catch {
      return false
    }
  })()

async function exportBlob(withPictures = false): Promise<Blob> {
  return createExportBlob({ includePictures: withPictures })
}

async function download(withPictures = false) {
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
}

async function share() {
  const blob = await exportBlob()
  const file = new File([blob], exportDownloadName(), { type: 'application/json' })
  if (navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Embrollado' })
    } catch {
      /* the learner cancelled the system share sheet — not an error */
    }
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
    await importSessions(importState.value.doc)
    message.value = { kind: 'ok', key: 'importDone', params: { count: importState.value.count } }
    emit('imported')
  } catch {
    message.value = { kind: 'error', key: 'importBadFile' }
  } finally {
    importing.value = false
    importState.value = null
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="min-h-11 rounded-lg border border-border px-3"
        @click="download(false)"
      >
        {{ $t('exportImport.download') }}
      </button>
      <button type="button" class="min-h-11 rounded-lg border border-border px-3" @click="download(true)">
        {{ $t('exportImport.exportWithPictures') }}
      </button>
      <button type="button" class="min-h-11 rounded-lg border border-border px-3" @click="openFilePicker">
        {{ $t('exportImport.import') }}
      </button>
      <button
        v-if="canShareFiles"
        type="button"
        class="min-h-11 rounded-lg border border-border px-3"
        @click="share"
      >
        {{ $t('exportImport.shareToApp') }}
      </button>
    </div>

    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="pickFile" />

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
            class="min-h-11 flex-1 rounded-lg bg-accent px-4 font-medium text-accent-fg disabled:opacity-50"
            :disabled="importing"
            @click="confirmImport"
          >
            {{ $t('exportImport.confirmImport') }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded-lg border border-border px-4"
            @click="importState = null; emit('cancelled')"
          >
            {{ $t('exportImport.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>