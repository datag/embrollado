import { ref, watchEffect } from 'vue'
import type { ThemeOption } from '@/domain/types'
import { readSettings, updateSettings } from '@/data/settings'

/**
 * Theme composable (T028): light / dark / auto, toggling the `dark` class on <html>.
 * The Tailwind config (`@custom-variant dark`) keys off that class.
 */
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')

function prefersDark(): boolean {
  return systemQuery.matches
}

function applyClass(theme: ThemeOption) {
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

const theme = ref<ThemeOption>(readSettings().theme)

// React to the system preference while in `auto` mode.
systemQuery.addEventListener('change', () => {
  applyClass(theme.value)
})

watchEffect(() => {
  applyClass(theme.value)
})

export function useTheme() {
  function setTheme(next: ThemeOption) {
    theme.value = next
    const result = updateSettings({ theme: next })
    if (!result.ok) console.warn('embrollado: could not persist theme setting.', result.error)
  }

  function initTheme() {
    theme.value = readSettings().theme
    applyClass(theme.value)
  }

  return { theme, setTheme, initTheme }
}