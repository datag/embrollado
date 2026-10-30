import { beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { closeDB } from '@/data/db'

// Reset the entire IndexedDB database before each unit test so no test leaks state into another.
beforeEach(async () => {
  // Close the app's cached connection first, otherwise the delete below stays blocked.
  await closeDB()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('embrollado')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
  // One-off (session-only) Setup entries live in sessionStorage — also reset per test.
  sessionStorage.clear()
})
