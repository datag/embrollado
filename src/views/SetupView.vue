<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { partnerById, situationById } from '@/domain/catalogue'
import type { Level, Persona, Situation } from '@/domain/types'
import { personaToRef, sessionToRef, createSession } from '@/data/sessions'
import {
  readTemplates,
  addPersonaTemplate,
  addSituationTemplate,
  removePersonaTemplate,
  removeSituationTemplate,
} from '@/data/profile'
import { readOneShots, writeOneShots, type OneShotsData } from '@/data/oneShots'
import LanguagePicker from '@/components/LanguagePicker.vue'
import LevelPicker from '@/components/LevelPicker.vue'
import SituationPicker from '@/components/SituationPicker.vue'
import PartnerPicker from '@/components/PartnerPicker.vue'
import CustomEntryForm from '@/components/CustomEntryForm.vue'
import ConversationOptions from '@/components/ConversationOptions.vue'
import SpinnerIcon from '@/components/SpinnerIcon.vue'

const router = useRouter()
const { t } = useI18n()

const language = ref('en')
const level = ref<Level>('intermediate')
const situationId = ref<string | null>(null)
const partnerId = ref<string | null>(null)
const templates = ref<{ personas: Persona[]; situations: Situation[] }>({
  personas: [],
  situations: [],
})
/** The custom-entry form (create or edit) replaces the picker while it is open. */
const form = ref<{
  mode: 'create' | 'edit'
  kind: 'partner' | 'situation'
  initial?: Persona | Situation
} | null>(null)
/**
 * One-off (session-only) entries, mirrored to sessionStorage so they survive a reload of this
 * tab (FR-046) while the actual selection inside the form stays plain in-memory state.
 */
const sessionOnly = ref<{ personas: Map<string, Persona>; situations: Map<string, Situation> }>({
  personas: new Map(),
  situations: new Map(),
})
/** Conversation option snapshot — "the AI partner already knows you" (default off). */
const knowsLearner = ref(false)
const starting = ref(false)
const saveError = ref(false)

const situationSolo = computed(() => [...sessionOnly.value.situations.values()])
const partnerSolo = computed(() => [...sessionOnly.value.personas.values()])

/**
 * The start button mirrors the real resolution used by `begin()` — after an entry is removed the
 * selection becomes unresolvable and the button must not look active.
 */
const canStart = computed(
  () =>
    !starting.value &&
    Boolean(situationId.value && partnerId.value && resolveSituation() && resolvePartner()),
)

onMounted(async () => {
  const saved = readOneShots()
  for (const p of saved.personas) sessionOnly.value.personas.set(p.id, p)
  for (const s of saved.situations) sessionOnly.value.situations.set(s.id, s)
  templates.value = await readTemplates()
  // A reload halfway through the setup restores the selection — but only if it is still usable.
  if (saved.selectedSituationId && isResolvableSituation(saved.selectedSituationId)) {
    situationId.value = saved.selectedSituationId
  }
  if (saved.selectedPartnerId && isResolvablePartner(saved.selectedPartnerId)) {
    partnerId.value = saved.selectedPartnerId
  }
})

async function refreshTemplates() {
  templates.value = await readTemplates()
}

/** Keep the one-off entries and the in-progress selection in sync with sessionStorage. */
function persistOneShots(
  overrides: Partial<Pick<OneShotsData, 'selectedSituationId' | 'selectedPartnerId'>> = {},
) {
  writeOneShots({
    personas: partnerSolo.value,
    situations: situationSolo.value,
    selectedSituationId:
      overrides.selectedSituationId !== undefined
        ? overrides.selectedSituationId
        : situationId.value,
    selectedPartnerId:
      overrides.selectedPartnerId !== undefined ? overrides.selectedPartnerId : partnerId.value,
  })
}

// Persist the selection whenever it changes (e.g. picking a built-in partner), not only when a
// custom entry is created, edited, promoted or removed — so a reload restores the whole setup.
watch([situationId, partnerId], () => persistOneShots())

function isResolvableSituation(id: string): boolean {
  return Boolean(
    situationById(id) ||
    templates.value.situations.some((s) => s.id === id) ||
    sessionOnly.value.situations.has(id),
  )
}

function isResolvablePartner(id: string): boolean {
  return Boolean(
    partnerById(id) ||
    templates.value.personas.some((p) => p.id === id) ||
    sessionOnly.value.personas.has(id),
  )
}

/** Editing keeps the id, so the corresponding collection write replaces the entry, never copies it. */
async function handleSaved(entry: Persona | Situation, saveAsTemplate: boolean) {
  const editing = form.value?.mode === 'edit'
  if (editing) {
    if ('occupation' in entry) {
      if (entry.visibility === 'template') {
        try {
          await addPersonaTemplate(entry)
          saveError.value = false
        } catch {
          // The stored template is unchanged — keep the selection and tell the learner.
          saveError.value = true
          return
        }
      } else {
        sessionOnly.value.personas.set(entry.id, entry)
      }
      partnerId.value = entry.id
    } else {
      if (entry.visibility === 'template') {
        try {
          await addSituationTemplate(entry)
          saveError.value = false
        } catch {
          saveError.value = true
          return
        }
      } else {
        sessionOnly.value.situations.set(entry.id, entry)
      }
      situationId.value = entry.id
    }
  } else if ('occupation' in entry) {
    // create: partner
    if (saveAsTemplate) {
      try {
        await addPersonaTemplate(entry)
        saveError.value = false
      } catch {
        saveError.value = true
        sessionOnly.value.personas.set(entry.id, entry)
      }
    } else {
      sessionOnly.value.personas.set(entry.id, entry)
    }
    partnerId.value = entry.id
  } else {
    // create: situation
    if (saveAsTemplate) {
      try {
        await addSituationTemplate(entry)
        saveError.value = false
      } catch {
        saveError.value = true
        sessionOnly.value.situations.set(entry.id, entry)
      }
    } else {
      sessionOnly.value.situations.set(entry.id, entry)
    }
    situationId.value = entry.id
  }
  form.value = null
  persistOneShots()
  await refreshTemplates()
}

function startEditSituation(entry: Situation) {
  form.value = { mode: 'edit', kind: 'situation', initial: entry }
}

function startEditPartner(entry: Persona) {
  form.value = { mode: 'edit', kind: 'partner', initial: entry }
}

/** Keep the id stable, so the selection and the badge stay put while the entry becomes a template. */
async function promoteSituation(entry: Situation) {
  try {
    await addSituationTemplate({ ...entry, visibility: 'template' })
    saveError.value = false
  } catch {
    saveError.value = true
    return
  }
  sessionOnly.value.situations.delete(entry.id)
  persistOneShots()
  await refreshTemplates()
}

async function promotePartner(entry: Persona) {
  try {
    await addPersonaTemplate({ ...entry, visibility: 'template' })
    saveError.value = false
  } catch {
    saveError.value = true
    return
  }
  sessionOnly.value.personas.delete(entry.id)
  persistOneShots()
  await refreshTemplates()
}

async function removeSituation(entry: Situation) {
  if (entry.visibility === 'template') {
    if (!window.confirm(t('setup.deleteTemplateConfirm', { name: entry.name }))) return
    try {
      await removeSituationTemplate(entry.id)
      saveError.value = false
    } catch {
      saveError.value = true
      return
    }
    if (situationId.value === entry.id) situationId.value = null
  } else {
    sessionOnly.value.situations.delete(entry.id)
    if (situationId.value === entry.id) situationId.value = null
  }
  persistOneShots()
  await refreshTemplates()
}

async function removePartner(entry: Persona) {
  if (entry.visibility === 'template') {
    if (!window.confirm(t('setup.deleteTemplateConfirm', { name: entry.name }))) return
    try {
      await removePersonaTemplate(entry.id)
      saveError.value = false
    } catch {
      saveError.value = true
      return
    }
    if (partnerId.value === entry.id) partnerId.value = null
  } else {
    sessionOnly.value.personas.delete(entry.id)
    if (partnerId.value === entry.id) partnerId.value = null
  }
  persistOneShots()
  await refreshTemplates()
}

function startCreate(kind: 'partner' | 'situation') {
  form.value = { mode: 'create', kind }
}

async function begin() {
  const sit = resolveSituation()
  const par = resolvePartner()
  if (!sit || !par || !situationId.value || !partnerId.value) return
  starting.value = true
  try {
    // Create the session record only — the Dialogue view opens it and streams the first line.
    const session = await createSession({
      language: language.value,
      level: level.value,
      situation: sit,
      partner: par,
      options: { knowsLearner: knowsLearner.value },
    })
    // A new conversation must not preselect the one-off entries again on the next setup visit.
    persistOneShots({ selectedSituationId: null, selectedPartnerId: null })
    router.push(`/conversation/${session.id}`)
  } finally {
    starting.value = false
  }
}

function resolveSituation() {
  const id = situationId.value
  if (!id) return null
  const builtin = situationById(id)
  if (builtin) return sessionToRef(builtin)
  const tpl = templates.value.situations.find((s) => s.id === id)
  if (tpl) return sessionToRef(tpl)
  const solo = sessionOnly.value.situations.get(id)
  if (solo) return sessionToRef(solo)
  return null
}

function resolvePartner() {
  const id = partnerId.value
  if (!id) return null
  const builtin = partnerById(id)
  if (builtin) return personaToRef(builtin)
  const tpl = templates.value.personas.find((p) => p.id === id)
  if (tpl) return personaToRef(tpl)
  const solo = sessionOnly.value.personas.get(id)
  if (solo) return personaToRef(solo)
  return null
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-bold">{{ $t('setup.title') }}</h1>

    <LanguagePicker v-model="language" />

    <LevelPicker v-model="level" />

    <SituationPicker
      v-if="!form || form.kind !== 'situation'"
      v-model="situationId"
      :templates="templates.situations"
      :session-only="situationSolo"
      :search-label="$t('setup.situationSearch')"
      @pick-custom="startCreate('situation')"
      @promote="promoteSituation"
      @edit="startEditSituation"
      @remove="removeSituation"
    />
    <CustomEntryForm
      v-if="form && form.kind === 'situation'"
      kind="situation"
      :initial="form.mode === 'edit' ? form.initial : undefined"
      :editing="form.mode === 'edit'"
      @saved="handleSaved"
      @cancel="form = null"
    />

    <PartnerPicker
      v-if="!form || form.kind !== 'partner'"
      v-model="partnerId"
      :templates="templates.personas"
      :session-only="partnerSolo"
      :search-label="$t('setup.partnerSearch')"
      @pick-custom="startCreate('partner')"
      @promote="promotePartner"
      @edit="startEditPartner"
      @remove="removePartner"
    />
    <CustomEntryForm
      v-if="form && form.kind === 'partner'"
      kind="partner"
      :initial="form.mode === 'edit' ? form.initial : undefined"
      :editing="form.mode === 'edit'"
      @saved="handleSaved"
      @cancel="form = null"
    />

    <ConversationOptions v-model="knowsLearner" />

    <p v-if="saveError" class="text-sm text-error">{{ $t('setup.ownSaveFailed') }}</p>

    <button
      type="button"
      class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent font-medium text-accent-fg disabled:opacity-50"
      :class="starting ? 'cursor-wait' : ''"
      :disabled="!canStart"
      @click="begin"
    >
      <SpinnerIcon v-if="starting" class="h-4 w-4" />
      {{ $t('setup.start') }}
    </button>
  </section>
</template>
