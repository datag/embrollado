<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SITUATIONS } from '@/domain/catalogue'
import type { Situation } from '@/domain/types'

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    templates: Situation[]
    searchLabel: string
    /** Entries given on the fly for this conversation only — listed, never stored as templates. */
    sessionOnly?: Situation[]
  }>(),
  { sessionOnly: () => [] },
)
const emit = defineEmits<{
  'update:modelValue': [string | null]
  pickCustom: []
  promote: [Situation]
  edit: [Situation]
  remove: [Situation]
}>()
const { t } = useI18n()

const query = ref('')
const value = computed({
  get: () => props.modelValue,
  set: (v: string | null) => emit('update:modelValue', v),
})

const entries = computed<Situation[]>(() => {
  const builtin = [...SITUATIONS]
  const customs = props.templates.filter((s) => s.origin === 'learner')
  const solo = props.sessionOnly.filter((s) => s.origin === 'learner')
  return [...builtin, ...customs, ...solo]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(
    (s) => s.name.toLowerCase().includes(q) || s.setting.toLowerCase().includes(q),
  )
})

// A custom entry sits at the end of the scrollable list; keep the selected row in view.
const listEl = ref<HTMLElement | null>(null)

function scrollToSelected() {
  const id = props.modelValue
  if (!id) return
  listEl.value
    ?.querySelector<HTMLElement>(`[data-entry-id="${id}"]`)
    ?.scrollIntoView({ block: 'nearest' })
}

// The picker is remounted when a custom form closes (v-if) and template entries can arrive after
// the mount (a "save as template" write finishes only after the list refreshes), so scroll to the
// selected row on mount, on every selection change, and whenever the entry list itself changes.
onMounted(() => nextTick(scrollToSelected))
watch([value, entries], () => nextTick(scrollToSelected))

function visibilityBadge(s: Situation): { label: string; cls: string } {
  if (s.visibility === 'template')
    return { label: t('setup.badgeCustom'), cls: 'bg-accent/15 text-accent' }
  return { label: t('setup.badgeOneTime'), cls: 'bg-border/50 text-fg-muted' }
}
</script>

<template>
  <fieldset>
    <legend class="mb-1 block text-sm font-medium">{{ $t('setup.situation') }}</legend>
    <input
      v-model="query"
      type="search"
      :placeholder="searchLabel"
      class="min-h-11 mb-2 w-full rounded-lg border border-border bg-surface-raised px-3 text-fg"
    />
    <ul
      ref="listEl"
      data-testid="situation-picker"
      class="flex max-h-64 flex-col gap-1 overflow-y-auto"
    >
      <li v-for="entry in filtered" :key="entry.id">
        <div :data-entry-id="entry.id" class="flex items-stretch gap-1">
          <button
            type="button"
            class="min-h-11 flex-1 rounded-lg border px-3 text-left"
            :class="
              value === entry.id
                ? 'border-accent bg-accent/10 text-fg'
                : 'border-border bg-surface-raised'
            "
            @click="value = entry.id"
          >
            <span class="block font-medium">
              {{ entry.name }}
              <span
                v-if="entry.origin === 'learner'"
                class="ml-1 inline-flex rounded-full px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wide"
                :class="visibilityBadge(entry).cls"
                :title="
                  entry.visibility === 'template'
                    ? $t('setup.badgeCustomHint')
                    : $t('setup.badgeOneTimeHint')
                "
              >
                {{ visibilityBadge(entry).label }}
              </span>
            </span>
            <span class="block text-xs text-fg-muted">{{ entry.setting }}</span>
          </button>
          <template v-if="value === entry.id && entry.origin === 'learner'">
            <button
              type="button"
              class="min-h-11 rounded-lg border border-border px-2.5"
              :title="$t('setup.editEntry')"
              :aria-label="$t('setup.editEntry')"
              data-testid="edit-entry"
              @click="emit('edit', entry)"
            >
              ✎
            </button>
            <button
              v-if="entry.visibility === 'session-only'"
              type="button"
              class="min-h-11 rounded-lg border border-border px-2.5 text-accent"
              :title="$t('setup.promoteTemplate')"
              :aria-label="$t('setup.promoteTemplate')"
              data-testid="promote-entry"
              @click="emit('promote', entry)"
            >
              ★
            </button>
            <button
              type="button"
              class="min-h-11 rounded-lg border border-error/40 px-2.5 text-error"
              :title="$t('setup.removeEntry')"
              :aria-label="$t('setup.removeEntry')"
              data-testid="remove-entry"
              @click="emit('remove', entry)"
            >
              ✕
            </button>
          </template>
        </div>
      </li>
      <li>
        <button
          type="button"
          class="min-h-11 w-full rounded-lg border border-dashed border-border px-3 text-left text-accent"
          @click="emit('pickCustom')"
        >
          {{ $t('setup.situationCustom') }}
        </button>
      </li>
    </ul>
  </fieldset>
</template>
