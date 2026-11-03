<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebugLog, type DebugLogEntry } from '@/composables/useDebugLog'
import { useDebugPanel } from '@/composables/useDebugPanel'
import { formatTimestamp } from '@/utils/datetime'
import JsonCode from '@/components/JsonCode.vue'

/**
 * Debug panel — the "Development" TODO item. A footer item opens it (mounted in App.vue). A true
 * full-width modal (focus-trap, Esc, backdrop) showing every AI exchange of the current session:
 * a list (newest first) of request/response entries, and on click a detail view with the meta line,
 * the headers (<details>, collapsed by default, credentials `<REDACTED>`) and the payload — wrapped
 * at the container edge, with embedded JSON (the `content` field) optionally unfolded.
 *
 * The log survives a reload in this tab via sessionStorage and dies when the tab closes. It is never
 * exported and never leaves the device.
 */
const { entries, clear, persistenceFailed } = useDebugLog()
const { close: closePanel } = useDebugPanel()
const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)
const list = computed(() => entries())
const selectedId = ref<string | null>(null)
const selected = computed<DebugLogEntry | null>(
  () => list.value.find((e) => e.id === selectedId.value) ?? null,
)
/** Whether the detail view shows embedded JSON unfolded (vs. the raw payload). */
const expanded = ref(true)

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
    return
  }
  // Keep Tab inside the modal (focus trap, constitution/accessibility).
  if (e.key !== 'Tab') return
  const root = panelRef.value
  if (!root) return
  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>('button, [href], summary, [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute('disabled') && (el as HTMLElement).offsetParent !== null)
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey) {
    if (active === first || !root.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else if (active === last) {
    e.preventDefault()
    first.focus()
  }
}

function onClear() {
  clear()
  selectedId.value = null
}

const msLabel = (ms: number) => String(Math.round(ms))

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // Lock the page behind the modal, matching ImageModal.vue (verified: the body overflow
  // propagates to the viewport in Chrome without turning the body into its own scroll container).
  document.body.classList.add('overflow-hidden')
  void nextTick(() => panelRef.value?.focus())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('overflow-hidden')
})

// Reset the drill-in when a fresh entry arrives while a stale id is selected.
watch(selected, (sel) => {
  if (!sel && selectedId.value) selectedId.value = null
})
// Expand is the default; reset it when switching between entries.
watch(selectedId, () => {
  expanded.value = true
})
</script>

<template>
  <div data-testid="debug-panel" class="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
    <!-- backdrop (all breakpoints) — tap to close -->
    <div
      class="absolute inset-0 bg-black/40"
      data-testid="debug-backdrop"
      @click="closePanel"
    ></div>

    <div
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-label="t('debug.title')"
      class="relative flex h-full w-full flex-col border border-border bg-surface sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-xl"
    >
      <header
        class="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2 sm:rounded-t-xl"
      >
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-base font-bold leading-tight">
            {{ t('debug.title') }}
          </h2>
          <p class="truncate text-xs text-fg-muted" data-testid="debug-subtitle">
            {{ t('debug.subtitle') }}
          </p>
          <p
            v-if="persistenceFailed()"
            class="text-xs text-error"
            data-testid="debug-not-persisted"
          >
            {{ t('debug.notPersisted') }}
          </p>
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

      <div class="flex-1 overflow-y-auto overscroll-contain p-3">
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
                    formatTimestamp(entry.timestamp)
                  }}</span>
                </span>
                <span class="flex items-center justify-between gap-2 font-mono text-xs">
                  <span class="min-w-0 truncate text-fg">
                    <span class="text-fg-muted">{{ entry.method }}</span>
                    <span class="ml-1">{{ entry.path }}</span>
                  </span>
                  <span
                    v-if="entry.direction === 'response'"
                    class="flex shrink-0 items-center gap-1"
                  >
                    <span
                      class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      :class="
                        entry.status !== null && entry.status >= 400
                          ? 'bg-error/15 text-error'
                          : 'bg-ok/15 text-ok'
                      "
                      >{{ entry.status }}</span
                    >
                    <span
                      v-if="entry.durationMs !== null"
                      class="border-l border-border pl-2 text-fg-muted"
                    >
                      {{ t('debug.durationMs', { ms: msLabel(entry.durationMs) }) }}
                    </span>
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
            <dd class="font-mono">{{ formatTimestamp(selected!.timestamp) }}</dd>
            <dt class="text-fg-muted">{{ t('debug.method') }}</dt>
            <dd class="flex flex-wrap items-center gap-2">
              <span class="font-mono">{{ selected!.method }} {{ selected!.path }}</span>
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                :class="
                  selected!.direction === 'request'
                    ? 'bg-accent/15 text-accent'
                    : 'bg-ok/15 text-ok'
                "
                >{{ directionLabel(selected!.direction) }}</span
              >
              <span
                class="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              >
                {{ kindLabel(selected!.kind) }}
              </span>
            </dd>
            <dt class="text-fg-muted">{{ t('debug.status') }}</dt>
            <dd class="font-mono">
              <template v-if="selected!.direction === 'response'">
                <span
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  :class="
                    selected!.status !== null && selected!.status >= 400
                      ? 'bg-error/15 text-error'
                      : 'bg-ok/15 text-ok'
                  "
                  >{{ selected!.status }}</span
                >
                <span
                  v-if="selected!.durationMs !== null"
                  class="ml-2 border-l border-border pl-2 text-fg-muted"
                >
                  {{ t('debug.durationMs', { ms: msLabel(selected!.durationMs) }) }}
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
            <div class="max-h-64 overflow-auto border-t border-border px-3 py-2">
              <pre
                class="m-0 whitespace-pre-wrap break-all text-xs leading-relaxed"
              ><template v-for="(value, key) in selected!.headers" :key="key"><span class="text-accent">{{ key }}</span>: {{ value }}
</template></pre>
            </div>
          </details>

          <!-- the payload: wrapped JSON, optionally unfolded; or a plain placeholder for binary -->
          <div class="overflow-hidden rounded-lg border border-border">
            <div
              class="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-3 py-2"
            >
              <span class="text-sm font-medium">{{ t('debug.payload') }}</span>
              <button
                v-if="selected!.payload && !isBinary(selected!.payload)"
                type="button"
                data-testid="debug-expand"
                class="min-h-11 rounded-lg px-2 text-xs text-fg-muted transition-colors hover:text-fg"
                @click="expanded = !expanded"
              >
                {{ expanded ? t('debug.showRaw') : t('debug.expandJson') }}
              </button>
            </div>
            <div data-testid="debug-payload" class="bg-surface p-3">
              <JsonCode
                v-if="!isBinary(selected!.payload)"
                :code="selected!.payload"
                :expand="expanded"
              />
              <p v-else-if="selected!.payload" class="font-mono text-xs text-fg-muted">
                {{ selected!.payload }}
              </p>
              <p v-else class="text-sm text-fg-muted">{{ t('debug.noBody') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
