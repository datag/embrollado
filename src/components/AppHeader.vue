<script setup lang="ts">
const navItems = [
  { to: '/', labelKey: 'nav.sessions', icon: '≡' },
  { to: '/new', labelKey: 'nav.new', icon: '＋' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙' },
]
</script>

<template>
  <header class="border-b border-border bg-surface-raised">
    <div class="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2">
      <RouterLink
        to="/"
        class="min-h-11 flex min-w-11 shrink-0 items-center rounded-lg font-bold tracking-tight text-accent"
        aria-label="Embrollado home"
      >
        Embrollado
      </RouterLink>
      <nav class="flex items-center gap-1" aria-label="Main">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          :class="{ 'text-fg': $route.path === item.to }"
        >
          <span class="text-base leading-none" aria-hidden="true">{{ item.icon }}</span>
          <span class="ml-1.5 hidden sm:inline">{{ $t(item.labelKey) }}</span>
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
