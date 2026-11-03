<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebugLog, type DebugLogEntry } from '@/composables/useDebugLog'
import { useDebugPanel } from '@/composables/useDebugPanel'
import JsonCode from '@/components/JsonCode.vue'

/**
 * Debug panel — the "Development" TODO item. A footer item opens it (mounted in App.vue). Shows
 * every AI exchange of the current page: a list (newest first) of request/response entries, and on
 * click a detail view with the meta line, the headers (<details>, collapsed by default, credentials
 * already `<REDACTED>`) and — most importantly — the formatted, syntax-highlighted payload.
 *
 * The log is in-memory only and never leaves the device (constitution "current session", local-first).
 */
const { entries, clear } = useDebugLog()
const { close: closePanel } = useDebugPanel()
const { t } = useI18n()

const list = computed(() => entries())
const selectedId = ref<string | null>(null)
const selected = computed<DebugLogEntry | null>(
  () => list.value.find((e) => e.id === selectedId.value) ?? null,
)

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString()
}

function kindLabel(kind: DebugLogEntry['kind']): string {
  return t(`debug.kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)
}

function directionLabel(direction: DebugLogEntry['direction']): string {
  return direction === 'request' ? t('debug.directionRequest') : t('debug.directionResponse')
}

const isBinary = (payload: string) => payload.startsWith('<binary')

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (selectedId.value) selectedId.value = null
    else closePanel()
  }
}

function onClear() {
  clear()
  selectedId.value = null
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Reset the drill-in when a fresh entry arrives while a stale id is selected (it also closes the
// breadcrumb for an id that no longer exists after a clear).
watch(selected, (sel) => {
  if (!sel && selectedId.value) selectedId.value = null
})
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    :aria-label="t('debug.title')"
    data-testid="debug-panel"
    class="fixed inset-0 z-50 flex sm:justify-end"
  >
    <!-- dim backdrop on mobile (tap to close); on ≥sm the drawer sits over the app's right side -->
    <div
      class="absolute inset-0 bg-black/40 sm:hidden"
      data-testid="debug-backdrop"
      @click="closePanel"
    ></div>

    <div
      class="relative flex h-full w-full flex-col border-border bg-surface sm:max-w-[560px] sm:border-l"
    >
      <header
        class="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2"
      >
        <div class="min-w-0">
          <h2 class="text-base font-bold leading-tight">{{ t('debug.title') }}</h2>
          <p class="truncate text-xs text-fg-muted">{{ t('debug.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-1">
          <button
            v-if="list.length > 0"
            type="button"
            data-testid="debug-clear"
            class="min-h-11 rounded-lg px-3 text-sm text-fg-muted transition-colors hover:text-fg"
            @click="onClear"
          >
            {{ t('debug.clear') }}
          </button>
          <button
            type="button"
            data-testid="debug-close"
            :aria-label="t('debug.close')"
            class="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg"
            @click="closePanel"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-3">
        <!-- ------------------------------ list ------------------------------ -->
        <template v-if="!selected">
          <p
            v-if="list.length === 0"
            class="px-2 py-8 text-center text-sm text-fg-muted"
            data-testid="debug-empty"
          >
            {{ t('debug.empty') }}
          </p>
          <ul v-else class="space-y-2" data-testid="debug-list">
            <li v-for="entry in list" :key="entry.id">
              <button
                type="button"
                data-testid="debug-entry"
                class="flex min-h-12 w-full flex-col items-stretch gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left transition-colors hover:border-accent"
                @click="selectedId = entry.id"
              >
                <span class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-2 text-xs text-fg-muted">
                    <span
                      class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      :class="
                        entry.direction === 'request'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-ok/15 text-ok'
                      "
                      >{{ directionLabel(entry.direction) }}</span
                    >
                    <span
                      class="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    >
                      {{ kindLabel(entry.kind) }}
                    </span>
                  </span>
                  <span class="shrink-0 font-mono text-xs text-fg-muted">{{
                    formatTime(entry.timestamp)
                  }}</span>
                </span>
                <span class="flex items-center justify-between gap-2 font-mono text-xs">
                  <span class="min-w-0 truncate text-fg">
                    <span class="text-fg-muted">{{ entry.method }}</span>
                    <span class="ml-1">{{ entry.path }}</span>
                  </span>
                  <span v-if="entry.direction === 'response'" class="shrink-0">
                    <span
                      :class="
                        entry.status !== null && entry.status >= 400 ? 'text-error' : 'text-ok'
                      "
                    >
                      {{ entry.status }}
                    </span>
                    <span v-if="entry.durationMs !== null" class="ml-2 text-fg-muted">{{
                      t('debug.durationMs', { ms: entry.durationMs })
                    }}</span>
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </template>

        <!-- ------------------------------ detail ------------------------------ -->
        <div v-else data-testid="debug-detail">
          <button
            type="button"
            class="mb-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-fg-muted transition-colors hover:text-fg"
            @click="selectedId = null"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ t('nav.back') }}
          </button>

          <dl
            class="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-raised p-3 text-sm"
          >
            <dt class="text-fg-muted">{{ t('debug.time') }}</dt>
            <dd>{{ formatTime(selected!.timestamp) }}</dd>
            <dt class="text-fg-muted">{{ t('debug.method') }}</dt>
            <dd class="font-mono">{{ selected!.method }} {{ selected!.path }}</dd>
            <dt class="text-fg-muted">{{ t('debug.status') }}</dt>
            <dd>
              <template v-if="selected!.direction === 'response'">
                <span
                  :class="
                    selected!.status !== null && selected!.status >= 400 ? 'text-error' : 'text-ok'
                  "
                >
                  {{ selected!.status }}
                </span>
                <span v-if="selected!.durationMs !== null" class="ml-2 text-fg-muted">
                  {{ t('debug.durationMs', { ms: selected!.durationMs }) }}
                </span>
              </template>
              <template v-else>—</template>
            </dd>
          </dl>

          <!-- headers: collapsed by default; credentials already redacted -->
          <details data-testid="debug-headers" class="mb-3 rounded-lg border border-border">
            <summary class="flex min-h-11 items-center px-3 text-sm font-medium text-fg">
              {{ t('debug.headers') }}
            </summary>
            <div class="max-h-64 overflow-y-auto border-t border-border px-3 py-2">
              <pre
                class="m-0 text-xs leading-relaxed"
              ><template v-for="(value, key) in selected!.headers" :key="key"><span class="text-accent">{{ key }}</span>: {{ value }}
</template></pre>
            </div>
          </details>

          <!-- the payload: highlighted JSON, or a plain placeholder for binary -->
          <div class="overflow-hidden rounded-lg border border-border">
            <div class="border-b border-border bg-surface-raised px-3 py-2 text-sm font-medium">
              {{ t('debug.payload') }}
            </div>
            <div class="max-h-[60vh] overflow-auto bg-surface p-3" data-testid="debug-payload">
              <p v-if="!selected!.payload" class="text-sm text-fg-muted">{{ t('debug.noBody') }}</p>
              <JsonCode v-else-if="!isBinary(selected!.payload)" :code="selected!.payload" />
              <p v-else class="font-mono text-xs text-fg-muted">{{ selected!.payload }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
