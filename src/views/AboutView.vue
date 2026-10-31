<script setup lang="ts">
/**
 * Links to the licence files that ship with the application. `import.meta.env.BASE_URL` is the
 * deployment base path ('/' locally, '/embrollado/' on GitHub Pages), so the links resolve in both
 * cases. The files themselves are copies in `public/` and are kept identical to their sources.
 */
const licenceUrl = `${import.meta.env.BASE_URL}LICENSE`
const thirdPartyUrl = `${import.meta.env.BASE_URL}THIRD_PARTY_LICENSES.md`
const fontOflUrl = `${import.meta.env.BASE_URL}LICENSES/OFL.txt`
const fontNoticeUrl = `${import.meta.env.BASE_URL}LICENSES/NOTICE.md`

const fontInfo = {
  family: 'Atkinson Hyperlegible Next',
  author: 'Braille Institute of America',
  licence: 'SIL Open Font License 1.1',
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
      <ul class="mt-1 space-y-1 text-sm">
        <li>
          <a
            :href="licenceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            {{ $t('about.licenceText') }}
          </a>
        </li>
        <li>
          <a
            :href="thirdPartyUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            {{ $t('about.thirdParty') }}
          </a>
        </li>
      </ul>
    </article>

    <article class="rounded-xl border border-border bg-surface-raised p-3">
      <h2 class="mb-1 font-semibold">{{ $t('about.fontTitle') }}</h2>
      <p class="text-sm">{{ fontInfo.family }} — {{ fontInfo.author }} — {{ fontInfo.licence }}</p>
      <p class="mt-1 text-sm text-fg-muted">{{ $t('about.font') }}</p>
      <ul class="mt-1 space-y-1 text-sm">
        <li>
          <a
            :href="fontOflUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            {{ $t('about.fontOfl') }}
          </a>
        </li>
        <li>
          <a
            :href="fontNoticeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            {{ $t('about.fontNotice') }}
          </a>
        </li>
      </ul>
    </article>
  </section>
</template>
