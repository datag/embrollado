import { beforeEach, describe, expect, it } from 'vitest'
import { saveAudio, listAudio, pruneSpeechCache, findAudioByText } from '@/data/media'
import type { AudioEntry } from '@/domain/types'

function entry(sessionId: string, turnId: string, text: string, minutesAgo: number): AudioEntry {
  return {
    id: crypto.randomUUID(),
    sessionId,
    turnId,
    text,
    voice: 'alloy',
    mimeType: 'audio/mp3',
    bytes: new Blob(['fake-audio'], { type: 'audio/mp3' }),
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  }
}

describe('speech cache pruning (T079, T082)', () => {
  beforeEach(async () => {
    const existing = await listAudio()
    for (const a of existing) {
      const { getDB, STORE } = await import('@/data/db')
      const db = await getDB()
      await db.delete(STORE.audio, a.id)
    }
  })

  it('keeps only the newest cachedSpeechLines entries per session, oldest first', async () => {
    // 4 entries in one session (oldest = minutesAgo 60 … 30).
    const sessionId = 's1'
    const minsList = [60, 50, 40, 30]
    for (let i = 0; i < minsList.length; i++) {
      await saveAudio(entry(sessionId, `t${i}`, `line ${i}`, minsList[i]))
    }
    await pruneSpeechCache(2)
    const remaining = await listAudio()
    expect(remaining).toHaveLength(2)
    const texts = remaining.map((a) => a.text)
    expect(texts).toEqual(['line 2', 'line 3'])
  })

  it('prunes per session, not globally', async () => {
    await saveAudio(entry('s1', 'a', 'one', 50))
    await saveAudio(entry('s2', 'b', 'two', 50))
    await pruneSpeechCache(1)
    const remaining = await listAudio()
    expect(remaining).toHaveLength(2)
  })

  it('reuses an identical line from the cache before requesting a new generation', async () => {
    await saveAudio(entry('s1', 't9', 'Hello there', 5))
    const found = await findAudioByText('Hello there')
    expect(found).toBeTruthy()
    expect(found?.text).toBe('Hello there')
  })
})
