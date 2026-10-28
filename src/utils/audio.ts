/**
 * Wrap raw 16-bit little-endian PCM samples in a WAV container, because a browser `<audio>`
 * element cannot play header-less PCM. Used for TTS providers that only return pcm
 * (e.g. OpenRouter's Gemini TTS / HeyGen Voice).
 */

const WAV_HEADER_BYTES = 44

export function pcmToWavBlob(pcmBytes: Uint8Array, sampleRate: number, channels: number): Blob {
  const dataSize = pcmBytes.length
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true) // file size - 8
  writeAscii(8, 'WAVE')

  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM = 1
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true) // byte rate
  view.setUint16(32, channels * 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample

  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  new Uint8Array(buffer, WAV_HEADER_BYTES).set(pcmBytes)
  return new Blob([buffer], { type: 'audio/wav' })
}
