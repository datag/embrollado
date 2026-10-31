<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Session, Turn } from '@/domain/types'
import {
  listSessions,
  searchSessions,
  deleteSession,
  renameSession,
  getTurns,
  sessionActivityAt,
} from '@/data/sessions'
import { LEVELS } from '@/domain/catalogue'
import ShareMenu from '@/components/ShareMenu.vue'
import TranscriptList from '@/components/TranscriptList.vue'

const router = useRouter()
const sessions = ref<Session[]>([])
const search = ref('')
const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const previewId = ref<string | null>(null)
const previewTurns = ref<Turn[]>([])
const loaded = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.language.toLowerCase().includes(q) ||
      s.situation.name.toLowerCase().includes(q) ||
      s.partner.name.toLowerCase().includes(q),
  )
})

async function refresh() {
  sessions.value = search.value.trim() ? await searchSessions(search.value) : await listSessions()
}

onMounted(async () => {
  await refresh()
  loaded.value = true
})

function levelName(level: Session['level']): string {
  return LEVELS.find((l) => l.id === level)?.name ?? level
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/** The i18n key for the date shown on a session row: the last activity, else the creation. */
function activityLabel(s: Session): string {
  return s.lastTurnAt ? 'sessions.lastTurn' : 'sessions.created'
}

function openSession(id: string) {
  router.push(`/conversation/${id}`)
}

function startRename(s: Session) {
  renamingId.value = s.id
  renameDraft.value = s.title
}

async function commitRename(s: Session) {
  const title = renameDraft.value.trim()
  if (title) await renameSession(s.id, title)
  renamingId.value = null
  await refresh()
}

async function confirmDelete(s: Session) {
  const ok = window.confirm(`Delete "${s.title}"? This cannot be undone.`)
  if (ok) {
    await deleteSession(s.id)
    await refresh()
  }
}

async function togglePreview(s: Session) {
  if (previewId.value === s.id) {
    previewId.value = null
    previewTurns.value = []
    return
  }
  previewId.value = s.id
  previewTurns.value = await getTurns(s.id)
}
</script>

<template>
  <section class="space-y-3">
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-bold">{{ $t('sessions.title') }}</h1>
      <RouterLink
        to="/new"
        class="min-h-11 inline-flex items-center rounded-lg bg-accent px-4 font-medium text-accent-fg"
      >
        ＋ {{ $t('nav.new') }}
      </RouterLink>
    </header>

    <input
      v-model="search"
      type="search"
      :placeholder="$t('sessions.searchPlaceholder')"
      class="min-h-11 w-full rounded-lg border border-border bg-surface-raised px-3"
      @input="refresh"
    />

    <ShareMenu @imported="refresh" />

    <p v-if="loaded && filtered.length === 0" class="py-6 text-center text-fg-muted">
      {{ search.trim() ? $t('sessions.noResult') : $t('sessions.empty') }}
    </p>

    <ul class="space-y-2">
      <li
        v-for="s in filtered"
        :key="s.id"
        class="rounded-xl border border-border bg-surface-raised p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <button type="button" class="min-h-11 flex-1 text-left" @click="openSession(s.id)">
            <span class="block font-semibold leading-snug">{{ s.title }}</span>
            <span class="block text-xs text-fg-muted">
              {{ s.situation.name }} · {{ s.partner.name }} · {{ s.language }} ·
              {{ levelName(s.level) }}
            </span>
            <span class="block text-xs text-fg-muted">
              {{ $t(activityLabel(s)) }}: {{ formatDate(sessionActivityAt(s)) }} ·
              {{
                s.turnCount === 1
                  ? $t('sessions.oneTurn')
                  : $t('sessions.turns', { count: s.turnCount })
              }}
            </span>
          </button>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="s.state === 'active' ? 'bg-ok/15 text-ok' : 'bg-border/40 text-fg-muted'"
          >
            {{ s.state === 'active' ? $t('sessions.active') : $t('sessions.ended') }}
          </span>
        </div>

        <div v-if="renamingId === s.id" class="mt-2 flex items-center gap-2">
          <input
            v-model="renameDraft"
            type="text"
            class="min-h-11 flex-1 rounded-lg border border-border px-3"
            :placeholder="$t('sessions.titlePlaceholder')"
            @keydown.enter.prevent="commitRename(s)"
          />
          <button
            type="button"
            class="min-h-11 rounded-lg bg-accent px-3 font-medium text-accent-fg"
            @click="commitRename(s)"
          >
            ✓
          </button>
          <button
            type="button"
            class="min-h-11 rounded-lg border border-border px-3"
            @click="renamingId = null"
          >
            ✕
          </button>
        </div>

        <div class="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-11 rounded-lg border border-border px-3 text-sm"
            @click="openSession(s.id)"
          >
            {{ $t('sessions.open') }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded-lg border border-border px-3 text-sm"
            @click="startRename(s)"
          >
            {{ $t('sessions.rename') }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded-lg border border-border px-3 text-sm"
            @click="togglePreview(s)"
          >
            {{ previewId === s.id ? '✕' : '¶' }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded-lg border border-error/40 px-3 text-sm text-error"
            @click="confirmDelete(s)"
          >
            {{ $t('sessions.delete') }}
          </button>
        </div>

        <div v-if="previewId === s.id" class="mt-3 border-t border-border pt-3">
          <TranscriptList :turns="previewTurns" />
        </div>
      </li>
    </ul>
  </section>
</template>
