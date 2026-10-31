<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSettings, useServiceConfig } from '@/composables/useSettings'
import { useTheme } from '@/composables/useTheme'
import { LANGUAGES } from '@/domain/catalogue'
import {
  PROVIDER_PROFILES,
  guessProfileFromUrl,
  corsHintFor,
  shouldPrefillAddress,
  shouldResetAuthMode,
} from '@/ai/providers'
import { testConnection, listModels } from '@/ai/aiService'
import type { ConnectionTestResult } from '@/ai/aiService'
import type { ServiceConfig } from '@/domain/types'
import { getStorageEstimate, requestPersistentStorage } from '@/data/db'
import ProfileForm from '@/components/ProfileForm.vue'
import ShareMenu from '@/components/ShareMenu.vue'
import SpinnerIcon from '@/components/SpinnerIcon.vue'

/**
 * Settings screen (T071, T078; settings-profile.md §2). The only place where the learner states
 * who they are and which AI service to use. The API key is stored locally only and never exported.
 */
const { settings, update } = useSettings()
const { service, update: updateService } = useServiceConfig()
const { setTheme } = useTheme()

const showKey = ref(false)
const testing = ref(false)
const testResult = ref<ConnectionTestResult | null>(null)
const modelList = ref<string[]>([])
const modelsLoading = ref(false)
const estimate = ref({ usage: 0, quota: 0 })
const hasEstimate = ref(false)
const persistentState = ref<'unknown' | 'granted' | 'denied'>('unknown')
const savedFlash = ref(false)

const providerOptions = Object.values(PROVIDER_PROFILES)

onMounted(async () => {
  const est = await getStorageEstimate()
  if (est.quota > 0) {
    hasEstimate.value = true
    estimate.value = est
  }
})

/**
 * The profile the typed address suggests — offered as a hint only, never applied automatically
 * (the profile leads, the address follows, not the other way round).
 */
const detectedProfile = computed(() => {
  const detected = guessProfileFromUrl(service.baseUrl)
  if (detected === 'custom' || detected === service.providerProfile) return null
  return detected
})

function onBaseUrl(event: Event) {
  // The typed address never changes the profile; the detected hint below the field offers to
  // adopt the guessed profile instead.
  updateService({ baseUrl: (event.target as HTMLInputElement).value })
}

function applyDetectedProfile() {
  const id = detectedProfile.value
  if (!id) return
  const profile = PROVIDER_PROFILES[id] ?? PROVIDER_PROFILES.custom
  const patch: Partial<ServiceConfig> = { providerProfile: id }
  if (shouldResetAuthMode(service.authMode, service.providerProfile)) {
    patch.authMode = profile.defaultAuthMode
  }
  updateService(patch)
}

function onAuthMode(event: Event) {
  updateService({ authMode: (event.target as HTMLSelectElement).value as typeof service.authMode })
}

function onProvider(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  const profile = PROVIDER_PROFILES[id] ?? PROVIDER_PROFILES.custom
  const oldProfileId = service.providerProfile
  const patch: Partial<ServiceConfig> = { providerProfile: id }
  // Pre-fill the address only while it is still auto-filled (empty or the previous default);
  // a manually entered address is never overwritten, so e.g. an EU-bounded OpenRouter host
  // survives the switch.
  if (shouldPrefillAddress(service.baseUrl, oldProfileId) && profile.defaultBaseUrl) {
    patch.baseUrl = profile.defaultBaseUrl
  }
  // Only replace the auth style while it is still the previous profile's default — a manually
  // chosen x-api-key / api-key must survive a profile switch.
  if (shouldResetAuthMode(service.authMode, oldProfileId)) {
    patch.authMode = profile.defaultAuthMode
  }
  updateService(patch)
}

function onChatModel(event: Event) {
  updateService({ chatModel: (event.target as HTMLInputElement).value.trim() })
}
function onSpeechModel(event: Event) {
  updateService({ speechModel: (event.target as HTMLInputElement).value.trim() || null })
}
function onSpeechVoice(event: Event) {
  updateService({ speechVoice: (event.target as HTMLInputElement).value.trim() || null })
}
function onImageModel(event: Event) {
  updateService({ imageModel: (event.target as HTMLInputElement).value.trim() || null })
}

const speechVoicePlaceholder = computed(() => {
  const profile = PROVIDER_PROFILES[service.providerProfile] ?? PROVIDER_PROFILES.custom
  return profile.defaultVoice
})

function onSaveSettings(nav: { interfaceLanguage?: string; theme?: string }) {
  const patch: Record<string, unknown> = {}
  if (nav.interfaceLanguage !== undefined) patch.interfaceLanguage = nav.interfaceLanguage
  if (nav.theme !== undefined) {
    patch.theme = nav.theme
    setTheme(nav.theme as 'light' | 'dark' | 'auto')
  }
  update(patch)
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1500)
}

async function runTest() {
  if (!service.chatModel || !service.apiKey) {
    testResult.value = { ok: false, message: 'The key and model must be set first.' }
    return
  }
  testing.value = true
  try {
    testResult.value = await testConnection({ ...service })
  } finally {
    testing.value = false
  }
}

async function runFetchModels() {
  modelsLoading.value = true
  try {
    modelList.value = await listModels({ ...service })
  } catch {
    modelList.value = []
  } finally {
    modelsLoading.value = false
  }
}

async function requestPersist() {
  persistentState.value = (await requestPersistentStorage()) ? 'granted' : 'denied'
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

function lowSpaceComputed(): boolean {
  if (!hasEstimate.value || estimate.value.quota === 0) return false
  const headroom = estimate.value.quota - estimate.value.usage
  return headroom < 50 * 1024 * 1024
}
</script>

<template>
  <section class="space-y-5">
    <h1 class="text-xl font-bold">{{ $t('settings.title') }}</h1>
    <p v-if="savedFlash" class="text-ok text-sm">{{ $t('settings.saved') }}</p>

    <!-- AI service -->
    <article class="space-y-3 rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="font-semibold">{{ $t('settings.aiService') }}</h2>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-sm">{{ $t('settings.provider') }}</span>
          <select
            :value="service.providerProfile"
            data-testid="service-provider"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @change="onProvider"
          >
            <option v-for="p in providerOptions" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm">{{ $t('settings.authMode') }}</span>
          <select
            :value="service.authMode"
            data-testid="service-auth-mode"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @change="onAuthMode"
          >
            <option value="bearer">{{ $t('settings.authBearer') }}</option>
            <option value="x-api-key">{{ $t('settings.authXApiKey') }}</option>
            <option value="api-key">{{ $t('settings.authApiKey') }}</option>
          </select>
        </label>
      </div>

      <label class="block">
        <span class="mb-1 block text-sm">{{ $t('settings.baseUrl') }}</span>
        <input
          :value="service.baseUrl"
          data-testid="service-base-url"
          type="url"
          inputmode="url"
          class="min-h-11 w-full rounded-lg border border-border px-3"
          @input="onBaseUrl"
        />
        <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.baseUrlHint') }}</span>
      </label>
      <button
        v-if="detectedProfile"
        type="button"
        data-testid="service-detected-hint"
        class="min-h-11 w-full rounded-lg border border-accent px-3 text-left text-xs text-accent"
        @click="applyDetectedProfile"
      >
        {{
          $t('settings.detectedHint', {
            provider: PROVIDER_PROFILES[detectedProfile]?.label ?? detectedProfile,
          })
        }}
      </button>

      <div class="flex items-end gap-2">
        <label class="block flex-1">
          <span class="mb-1 block text-sm">{{ $t('settings.apiKey') }}</span>
          <input
            :value="service.apiKey"
            data-testid="service-api-key"
            :type="showKey ? 'text' : 'password'"
            autocomplete="off"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @input="updateService({ apiKey: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <button
          type="button"
          class="min-h-11 rounded-lg border border-border px-3 text-sm"
          @click="showKey = !showKey"
        >
          {{ $t(showKey ? 'settings.hide' : 'settings.reveal') }}
        </button>
      </div>
      <p class="text-xs text-fg-muted">{{ $t('settings.apiKeyHint') }}</p>

      <label class="block">
        <span class="mb-1 block text-sm">{{ $t('settings.chatModel') }}</span>
        <div class="flex items-end gap-2">
          <input
            :value="service.chatModel"
            data-testid="service-chat-model"
            type="text"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @input="onChatModel"
          />
          <button
            type="button"
            class="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm"
            :class="modelsLoading ? 'cursor-wait' : ''"
            :disabled="modelsLoading"
            @click="runFetchModels"
          >
            <SpinnerIcon v-if="modelsLoading" class="h-4 w-4" />
            {{ $t('settings.fetchModels') }}
          </button>
        </div>
      </label>
      <ul
        v-if="modelList.length"
        class="max-h-32 overflow-auto rounded border border-border bg-surface px-2 text-sm"
      >
        <li v-for="m in modelList" :key="m">{{ m }}</li>
      </ul>

      <label class="block">
        <span class="mb-1 block text-sm">{{ $t('settings.speechModel') }}</span>
        <input
          :value="service.speechModel ?? ''"
          data-testid="service-speech-model"
          type="text"
          :placeholder="$t('settings.speechModelHint')"
          class="min-h-11 w-full rounded-lg border border-border px-3"
          @input="onSpeechModel"
        />
        <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.speechModelHint') }}</span>
      </label>

      <label class="block">
        <span class="mb-1 block text-sm">{{ $t('settings.speechVoice') }}</span>
        <input
          :value="service.speechVoice ?? ''"
          data-testid="service-speech-voice"
          type="text"
          :placeholder="speechVoicePlaceholder"
          class="min-h-11 w-full rounded-lg border border-border px-3"
          @input="onSpeechVoice"
        />
        <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.speechVoiceHint') }}</span>
      </label>

      <label class="block">
        <span class="mb-1 block text-sm">{{ $t('settings.imageModel') }}</span>
        <input
          :value="service.imageModel ?? ''"
          data-testid="service-image-model"
          type="text"
          :placeholder="$t('settings.imageModelHint')"
          class="min-h-11 w-full rounded-lg border border-border px-3"
          @input="onImageModel"
        />
        <span class="mt-1 block text-xs text-fg-muted">{{ $t('settings.imageModelHint') }}</span>
      </label>

      <div>
        <button
          type="button"
          data-testid="test-connection"
          class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 font-medium text-accent-fg disabled:opacity-50"
          :class="testing ? 'cursor-wait' : ''"
          :disabled="testing"
          @click="runTest"
        >
          <SpinnerIcon v-if="testing" class="h-4 w-4" />
          {{ testing ? $t('settings.testing') : $t('settings.test') }}
        </button>
        <p v-if="testResult" class="mt-1 text-sm" :class="testResult.ok ? 'text-ok' : 'text-error'">
          {{ testResult.message }}
          <span v-if="testResult.corsHint" class="block text-xs text-fg-muted">
            {{ $t('errors.corsHint', { hint: testResult.corsHint }) }}
          </span>
        </p>
      </div>
    </article>

    <!-- The learner -->
    <article class="space-y-3 rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="font-semibold">{{ $t('settings.learner') }}</h2>
      <ProfileForm />
      <p class="text-xs text-fg-muted">{{ $t('settings.privacyText') }}</p>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-sm">{{ $t('settings.nativeLanguage') }}</span>
          <select
            :value="settings.nativeLanguage ?? ''"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @change="update({ nativeLanguage: ($event.target as HTMLSelectElement).value || null })"
          >
            <option value="">{{ $t('settings.sameAsInterface') }}</option>
            <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">{{ l.nameEn }}</option>
          </select>
          <span class="mt-1 block text-xs text-fg-muted">{{
            $t('settings.nativeLanguageHint')
          }}</span>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm">{{ $t('settings.interfaceLanguage') }}</span>
          <select
            :value="settings.interfaceLanguage"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @change="
              onSaveSettings({ interfaceLanguage: ($event.target as HTMLSelectElement).value })
            "
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm">{{ $t('settings.theme') }}</span>
          <select
            :value="settings.theme"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @change="onSaveSettings({ theme: ($event.target as HTMLSelectElement).value })"
          >
            <option value="light">{{ $t('settings.themeLight') }}</option>
            <option value="dark">{{ $t('settings.themeDark') }}</option>
            <option value="auto">{{ $t('settings.themeAuto') }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm">{{ $t('settings.cachedSpeechLines') }}</span>
          <input
            :value="settings.cachedSpeechLines"
            type="number"
            min="0"
            max="200"
            class="min-h-11 w-full rounded-lg border border-border px-3"
            @change="
              update({
                cachedSpeechLines: Math.max(
                  0,
                  Math.min(200, Number(($event.target as HTMLInputElement).value) || 0),
                ),
              })
            "
          />
          <span class="mt-1 block text-xs text-fg-muted">{{
            $t('settings.cachedSpeechLinesHint')
          }}</span>
        </label>
      </div>
    </article>

    <!-- Storage -->
    <article class="space-y-3 rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="font-semibold">{{ $t('settings.storage') }}</h2>
      <p v-if="hasEstimate" class="text-sm">
        {{
          $t('settings.storageUsed', {
            used: formatBytes(estimate.usage),
            quota: formatBytes(estimate.quota),
          })
        }}
      </p>
      <p v-else class="text-sm text-fg-muted">{{ $t('settings.storageUnknown') }}</p>
      <p v-if="lowSpaceComputed()" class="text-sm text-error">{{ $t('settings.lowSpace') }}</p>

      <button
        type="button"
        class="min-h-11 rounded-lg border border-border px-4 text-sm"
        @click="requestPersist"
      >
        {{ $t('settings.makePersistent') }}
      </button>
      <p v-if="persistentState === 'granted'" class="text-sm text-ok">
        {{ $t('settings.persistentGranted') }}
      </p>
      <p v-else-if="persistentState === 'denied'" class="text-sm text-error">
        {{ $t('settings.persistentDenied') }}
      </p>

      <ShareMenu />
    </article>

    <!-- Privacy -->
    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('settings.privacy') }}</h2>
      <p class="text-sm text-fg-muted">{{ $t('settings.privacyText') }}</p>
      <p v-if="corsHintFor(service.providerProfile)" class="mt-2 text-xs text-fg-muted">
        {{ corsHintFor(service.providerProfile) }}
      </p>
    </article>
  </section>
</template>
