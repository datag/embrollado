import { ref } from 'vue'

/**
 * Open/close state for the debug panel (module-level singleton, same pattern as useTheme). Mounted
 * once in App.vue; toggled from the footer item. On open, the previously focused element is
 * remembered so it can be restored when the panel closes (a11y / focus management for the modal).
 */
const open = ref(false)
let lastFocused: HTMLElement | null = null

function restoreFocus() {
  requestAnimationFrame(() => {
    lastFocused?.focus?.()
    lastFocused = null
  })
}

export function useDebugPanel() {
  function toggle() {
    if (open.value) {
      open.value = false
      restoreFocus()
    } else {
      lastFocused = (document.activeElement as HTMLElement | null) ?? null
      open.value = true
    }
  }

  function close() {
    open.value = false
    restoreFocus()
  }

  return { open, toggle, close }
}
