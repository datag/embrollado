<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const customKind = ref<'none' | 'partner' | 'situation'>('none')
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
  templates.value = await readTemplates()
})

async function refreshTemplates() {
  templates.value = await readTemplates()
}

async function handleSaved(entry: Persona | Situation, saveAsTemplate: boolean) {
  if ('occupation' in entry) {
    // persona
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
  customKind.value = 'none'
  await refreshTemplates()
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
  } else {
    sessionOnly.value.situations.delete(entry.id)
  }
  if (situationId.value === entry.id) situationId.value = null
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
  } else {
    sessionOnly.value.personas.delete(entry.id)
  }
  if (partnerId.value === entry.id) partnerId.value = null
  await refreshTemplates()
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
      v-if="customKind !== 'situation'"
      v-model="situationId"
      :templates="templates.situations"
      :session-only="situationSolo"
      :search-label="$t('sessions.searchPlaceholder')"
      @pick-custom="customKind = 'situation'"
      @promote="promoteSituation"
      @remove="removeSituation"
    />
    <CustomEntryForm
      v-if="customKind === 'situation'"
      kind="situation"
      @saved="handleSaved"
      @cancel="customKind = 'none'"
    />

    <PartnerPicker
      v-if="customKind !== 'partner'"
      v-model="partnerId"
      :templates="templates.personas"
      :session-only="partnerSolo"
      :search-label="$t('sessions.searchPlaceholder')"
      @pick-custom="customKind = 'partner'"
      @promote="promotePartner"
      @remove="removePartner"
    />
    <CustomEntryForm
      v-if="customKind === 'partner'"
      kind="partner"
      @saved="handleSaved"
      @cancel="customKind = 'none'"
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
