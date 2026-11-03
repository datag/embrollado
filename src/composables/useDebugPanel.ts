import { ref } from 'vue'

/**
 * Open/close state for the debug panel (module-level singleton, same pattern as useTheme). Mounted
 * once in App.vue; toggled from the footer item.
 */
const open = ref(false)

export function useDebugPanel() {
  function toggle() {
    open.value = !open.value
  }

  function close() {
    open.value = false
  }

  function openPanel() {
    open.value = true
  }

  return { open, toggle, close, openPanel }
}
