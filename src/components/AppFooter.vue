<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { appConfig, privacyPolicyLink, type PrivacyLang } from '@/config/app'

/**
 * App footer: app name, the About link, and — only when a privacy-policy URL is configured at
 * build time (`APP_PRIVACY_POLICY_URL`) — the two language links "Privacy Policy" (#en) and
 * "Datenschutzerklärung" (#de). Without the variable there are no privacy links at all.
 */
const props = withDefaults(defineProps<{ privacyPolicyUrl?: string }>(), {
  privacyPolicyUrl: undefined,
})

const { t } = useI18n()

const privacyLinks = computed<{ lang: PrivacyLang; href: string; label: string }[]>(() => {
  const base = props.privacyPolicyUrl ?? appConfig.privacyPolicyUrl
  if (!base) return []
  return (
    [
      ['en', t('footer.privacyPolicyEn')],
      ['de', t('footer.privacyPolicyDe')],
    ] as const
  ).map(([lang, label]) => ({ lang, href: privacyPolicyLink(base, lang), label }))
})
</script>

<template>
  <footer class="mx-auto w-full max-w-2xl px-4 pb-6 text-center text-xs text-fg-muted">
    <span>{{ t('app.name') }}</span>
    <span class="mx-1" aria-hidden="true">·</span>
    <RouterLink to="/about" class="underline underline-offset-2">{{ t('nav.about') }}</RouterLink>
    <template v-for="link in privacyLinks" :key="link.lang">
      <span class="mx-1" aria-hidden="true">·</span>
      <a
        :href="link.href"
        target="_blank"
        rel="noopener noreferrer"
        class="underline underline-offset-2"
      >
        {{ link.label }}
      </a>
    </template>
  </footer>
</template>
