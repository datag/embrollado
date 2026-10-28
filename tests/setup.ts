import { beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

// Reset the entire IndexedDB database before each unit test so no test leaks state into another.
beforeEach(() => {
  // fake-indexeddb/auto installs `indexedDB` on globalThis. Dropping the database is the fastest
  // full reset; the app re-creates it on first use.
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('embrollado')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
    req.onupgradeneeded = () => resolve()
  })
})