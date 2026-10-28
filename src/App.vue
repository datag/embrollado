<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import { computed } from 'vue'

// A `file://` origin has undefined storage behaviour — the app is not supported there
// (contracts/deployment.md §8). Show a short, dismissible notice instead of silently misbehaving.
const onFileProtocol = computed(
  () => typeof window !== 'undefined' && window.location.protocol === 'file:',
)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
      <RouterView />
    </main>
    <footer class="mx-auto w-full max-w-2xl px-4 pb-6 text-center text-xs text-fg-muted">
      <span>{{ $t('app.name') }}</span>
      <span class="mx-1">·</span>
      <RouterLink to="/about" class="underline underline-offset-2">{{
        $t('nav.about')
      }}</RouterLink>
    </footer>
    <div
      v-if="onFileProtocol"
      role="alert"
      class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface-raised p-3 text-sm"
    >
      {{ $t('app.fileProtocol') }}
    </div>
  </div>
</template>
