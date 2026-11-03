import { ref } from 'vue'
import { debugLogEntries, subscribeDebugLog, clearDebugLog } from '@/ai/debugLog'
import type { DebugLogEntry } from '@/ai/debugLog'

/**
 * Reactive bridge between the plain debug store and components. The store is the source of truth;
 * the module-level `shallowRef` holds an immutable snapshot of the log (the array reference is
 * replaced on every add/clear) so components reading through `useDebugLog()` stay reactive.
 */
const entriesSnapshot = ref<readonly DebugLogEntry[]>(debugLogEntries())

subscribeDebugLog(() => {
  entriesSnapshot.value = debugLogEntries()
})

export interface UseDebugLog {
  entries: () => readonly DebugLogEntry[]
  clear: () => void
}

export function useDebugLog(): UseDebugLog {
  return {
    entries: () => entriesSnapshot.value,
    clear: clearDebugLog,
  }
}

export type { DebugLogEntry }
