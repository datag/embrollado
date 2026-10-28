<script setup lang="ts">
const fontInfo = {
  family: 'Atkinson Hyperlegible Next',
  author: 'Braille Institute of America',
  licence: 'SIL Open Font License 1.1',
  notice: '/src/assets/fonts/LICENSES/NOTICE.md',
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-bold">{{ $t('about.title') }}</h1>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="font-semibold">{{ $t('about.purpose') }}</h2>
    </article>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('about.privacyTitle') }}</h2>
      <p class="text-sm text-fg-muted">{{ $t('about.privacy') }}</p>
    </article>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('about.dataTitle') }}</h2>
      <p class="text-sm text-fg-muted">{{ $t('about.data') }}</p>
    </article>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('about.techTitle') }}</h2>
      <p class="text-sm text-fg-muted">{{ $t('about.tech') }}</p>
    </article>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('about.licenceTitle') }}</h2>
      <p class="text-sm text-fg-muted">{{ $t('about.licence') }}</p>
    </article>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('about.fontTitle') }}</h2>
      <p class="text-sm">
        {{ fontInfo.family }} — {{ fontInfo.author }} — {{ fontInfo.licence }}
      </p>
      <p class="mt-1 text-sm text-fg-muted">{{ $t('about.font') }}</p>
      <p class="mt-1 text-xs text-fg-muted">{{ fontInfo.notice }}</p>
    </article>
  </section>
</template>