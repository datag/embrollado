<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { partnerById, situationById } from '@/domain/catalogue'
import type { Level, Persona, Situation } from '@/domain/types'
import { personaToRef, sessionToRef, createSession } from '@/data/sessions'
import { readTemplates, addPersonaTemplate, addSituationTemplate } from '@/data/profile'
import LanguagePicker from '@/components/LanguagePicker.vue'
import LevelPicker from '@/components/LevelPicker.vue'
import SituationPicker from '@/components/SituationPicker.vue'
import PartnerPicker from '@/components/PartnerPicker.vue'
import CustomEntryForm from '@/components/CustomEntryForm.vue'
import ConversationOptions from '@/components/ConversationOptions.vue'

const router = useRouter()

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

onMounted(async () => {
  templates.value = await readTemplates()
})

async function refreshTemplates() {
  templates.value = await readTemplates()
}

function handleSaved(entry: Persona | Situation, saveAsTemplate: boolean) {
  if ('occupation' in entry) {
    // persona
    if (saveAsTemplate) {
      addPersonaTemplate(entry)
    } else {
      sessionOnly.value.personas.set(entry.id, entry)
    }
    partnerId.value = entry.id
  } else {
    if (saveAsTemplate) {
      addSituationTemplate(entry)
    } else {
      sessionOnly.value.situations.set(entry.id, entry)
    }
    situationId.value = entry.id
  }
  customKind.value = 'none'
  refreshTemplates()
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
    router.push(`/session/${session.id}`)
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
      :search-label="$t('sessions.searchPlaceholder')"
      @pick-custom="customKind = 'situation'"
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
      :search-label="$t('sessions.searchPlaceholder')"
      @pick-custom="customKind = 'partner'"
    />
    <CustomEntryForm
      v-if="customKind === 'partner'"
      kind="partner"
      @saved="handleSaved"
      @cancel="customKind = 'none'"
    />

    <ConversationOptions v-model="knowsLearner" />

    <button
      type="button"
      class="min-h-11 w-full rounded-lg bg-accent font-medium text-accent-fg disabled:opacity-50"
      :disabled="!situationId || !partnerId || starting"
      @click="begin"
    >
      {{ $t('setup.start') }}
    </button>
  </section>
</template>
