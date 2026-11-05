import { ref } from 'vue'
import {
  debugLogEntries,
  debugLogStatus,
  subscribeDebugLog,
  clearDebugLog,
  debugPersistenceFailed,
  type DebugLogStatus,
} from '@/ai/debugLog'
import type { DebugLogEntry } from '@/ai/debugLog'

/**
 * Reactive bridge between the plain debug store and components. The store is the source of truth;
 * the module-level `shallowRef` holds an immutable snapshot of the log (the array reference is
 * replaced on every add/clear) so components reading through `useDebugLog()` stay reactive.
 *
 * The snapshot carries the status counters as well: they change with every event, and the panel
 * renders them next to the list.
 */
interface DebugLogSnapshot {
  entries: readonly DebugLogEntry[]
  status: DebugLogStatus
  persistenceFailed: boolean
}

function snapshot(): DebugLogSnapshot {
  return {
    entries: debugLogEntries(),
    status: debugLogStatus(),
    persistenceFailed: debugPersistenceFailed(),
  }
}

const snapshotRef = ref<DebugLogSnapshot>(snapshot())

subscribeDebugLog(() => {
  snapshotRef.value = snapshot()
})

export interface UseDebugLog {
  entries: () => readonly DebugLogEntry[]
  /** The counters that explain a shortened log (dropped / not persisted). */
  status: () => DebugLogStatus
  clear: () => void
  /** True when the log could not be persisted and survives only this page. */
  persistenceFailed: () => boolean
}

export function useDebugLog(): UseDebugLog {
  return {
    entries: () => snapshotRef.value.entries,
    status: () => snapshotRef.value.status,
    clear: clearDebugLog,
    persistenceFailed: () => snapshotRef.value.persistenceFailed,
  }
}

export type { DebugLogEntry }
