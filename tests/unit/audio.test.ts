import { describe, expect, it } from 'vitest'
import { pcmToWavBlob } from '@/utils/audio'

describe('pcm → wav (T081 / Gemini-style pcm TTS)', () => {
  it('wraps raw 16-bit LE PCM samples into a playable WAV container', async () => {
    const samples = new Uint8Array(48_000) // 1 s of mono @ 24 kHz → 48,000 samples
    const blob = pcmToWavBlob(samples, 24000, 1)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + samples.length)

    const header = new Uint8Array(await blob.arrayBuffer()).slice(0, 44)
    const ascii = (s: number, len: number) =>
      String.fromCharCode(...Array.from(header.slice(s, s + len)))
    expect(ascii(0, 4)).toBe('RIFF')
    expect(ascii(8, 4)).toBe('WAVE')
    expect(ascii(36, 4)).toBe('data')

    const view = new DataView(header.buffer)
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(24000) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(view.getUint32(40, true)).toBe(samples.length) // data chunk size
  })

  it('supports stereo and a custom sample rate', () => {
    const samples = new Uint8Array(4)
    const blob = pcmToWavBlob(samples, 44100, 2)
    expect(blob.size).toBe(44 + 4)
  })

  it('never mutates the input bytes', async () => {
    const samples = new Uint8Array([1, 2, 3, 4])
    pcmToWavBlob(samples, 24000, 1)
    expect(Array.from(samples)).toEqual([1, 2, 3, 4])
  })
})
