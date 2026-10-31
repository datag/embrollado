<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AccessGate from '@/components/AccessGate.vue'
import { computed, ref } from 'vue'
import { accessGateEnabled } from '@/config/app'
import { readAccessGrant } from '@/data/access'

// A `file://` origin has undefined storage behaviour — the app is not supported there
// (contracts/deployment.md §8). Show a short, dismissible notice instead of silently misbehaving.
const onFileProtocol = computed(
  () => typeof window !== 'undefined' && window.location.protocol === 'file:',
)

// Optional access-code gate (build-time APP_ACCESS_CODE, docs/deployment.md). When enabled, only
// the prompt renders until a valid code was entered — or already granted on a previous visit
// (localStorage marker `embrollado.access.v1`).
const gateEnabled = accessGateEnabled()
const granted = ref(gateEnabled ? readAccessGrant() : true)
</script>

<template>
  <AccessGate v-if="gateEnabled && !granted" @granted="granted = true" />
  <div v-else class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
      <RouterView />
    </main>
    <AppFooter />
    <div
      v-if="onFileProtocol"
      role="alert"
      class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface-raised p-3 text-sm"
    >
      {{ $t('app.fileProtocol') }}
    </div>
  </div>
</template>
