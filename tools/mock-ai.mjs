#!/usr/bin/env node
/**
 * Local mock of the OpenAI-compatible endpoints used by Embrollado.
 *
 * Never touches the network. Serves:
 *   POST {base}/chat/completions   — streamed (SSE) and unstreamed
 *   GET  {base}/models
 *   POST {base}/audio/speech       — returns a tiny WAV
 *   POST {base}/images/generations — returns base64 PNG bytes
 *
 * Default port: 8787. Override with PORT.
 */
import http from 'node:http'

const PORT = Number(process.env.PORT ?? 8787)
const BASE = process.env.BASE ?? '/v1'

const TURN = {
  partnerText: 'Hello! Nice to meet you. Where do you come from?',
  translation: 'Hallo! Schön, dich zu treffen. Woher kommst du?',
  explanation: 'Eine höfliche, verständliche Frage.',
  correctedText: null,
  interpretation: 'Ist der Waschraum neben den Duschen?',
  assumptions: [],
  badge: { tier: 'good', labelKey: 'good.1' },
  issues: [],
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function sendStream(res, content) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  // The model streams the strict JSON turn document; the app renders `partnerText` progressively
  // from the accumulated JSON string (partnerText is the document's first property).
  const full = JSON.stringify(content)
  let offset = 0
  const slice = 12
  const timer = setInterval(() => {
    if (offset >= full.length) {
      clearInterval(timer)
      const final = {
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        choices: [
          {
            index: 0,
            delta: { content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      }
      res.write(`data: ${JSON.stringify(final)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    const piece = full.slice(offset, offset + slice)
    offset += slice
    const chunk = {
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
    }
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }, 25)
  // Safety net so a stuck client never holds the process forever.
  setTimeout(() => {
    clearInterval(timer)
    try {
      res.end()
    } catch {
      /* noop */
    }
  }, 15_000)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname === '/' ? '/v1' : url.pathname

  // CORS — allow any browser origin (local dev), mirroring a permissive server config.
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type, authorization, x-api-key, api-key')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && path === `${BASE}/models`) {
    sendJson(res, 200, {
      object: 'list',
      data: [
        { id: 'mock-chat', object: 'model', owned_by: 'mock' },
        { id: 'mock-speech', object: 'model', owned_by: 'mock' },
        { id: 'mock-image', object: 'model', owned_by: 'mock' },
      ],
    })
    return
  }

  if (req.method === 'POST' && path === `${BASE}/chat/completions`) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let parsed = {}
      try {
        parsed = JSON.parse(body || '{}')
      } catch {
        /* ignore */
      }
      const stream = parsed.stream === true
      // On-demand illustration requests carry the embrollado_scene schema: answer with a ready
      // narration that the image endpoint renders verbatim.
      const isScene = parsed.response_format?.json_schema?.name === 'embrollado_scene'
      const payload = isScene
        ? {
            scene:
              'A man in his late twenties in dark clothes hands a coin to a woman in her late ' +
              'thirties in front of a small campsite washroom building at dusk.',
          }
        : TURN
      if (stream) {
        sendStream(res, payload)
        return
      }
      const usage = { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
      sendJson(res, 200, {
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Date.now(),
        model: parsed.model ?? 'mock-chat',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: JSON.stringify(payload) },
            finish_reason: 'stop',
          },
        ],
        usage,
      })
    })
    return
  }

  if (req.method === 'POST' && path === `${BASE}/audio/speech`) {
    // The mock honours `response_format`: request `pcm` to receive header-less raw 16-bit LE
    // PCM (Gemini-TTS style) so the app's PCM→WAV conversion is exercised end to end.
    let speechBody = ''
    req.on('data', (c) => (speechBody += c))
    req.on('end', () => {
      let parsed = {}
      try {
        parsed = JSON.parse(speechBody || '{}')
      } catch {
        /* ignore */
      }
      const sampleRate = 24000
      const seconds = 0.3
      const n = Math.floor(sampleRate * seconds)
      if (parsed.response_format === 'pcm') {
        const raw = Buffer.alloc(n * 2) // silence, 16-bit little-endian
        res.writeHead(200, { 'content-type': 'audio/pcm', 'content-length': raw.length })
        res.end(raw)
        return
      }
      // 0.3s of silence in WAV format (~2.5 KB).
      const dataSize = n * 2
      const buf = Buffer.alloc(44 + dataSize)
      buf.write('RIFF', 0)
      buf.writeUInt32LE(36 + dataSize, 4)
      buf.write('WAVE', 8)
      buf.write('fmt ', 12)
      buf.writeUInt32LE(16, 16)
      buf.writeUInt16LE(1, 20)
      buf.writeUInt16LE(1, 22)
      buf.writeUInt32LE(sampleRate, 24)
      buf.writeUInt32LE(sampleRate * 2, 28)
      buf.writeUInt16LE(2, 32)
      buf.writeUInt16LE(16, 34)
      buf.write('data', 36)
      buf.writeUInt32LE(dataSize, 40)
      res.writeHead(200, {
        'content-type': 'audio/wav',
        'content-length': buf.length,
      })
      res.end(buf)
    })
    return
  }

  if (req.method === 'POST' && path === `${BASE}/images/generations`) {
    // Return a true base64 PNG via the data URL decoder, so the app's decode path is real.
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    const png = Buffer.from(b64, 'base64')
    sendJson(res, 200, {
      created: Date.now(),
      data: [{ b64_json: png.toString('base64') }],
    })
    return
  }

  if (req.method === 'POST' && path === `${BASE}/images`) {
    // OpenRouter-style images path (profile `openrouter` uses `/images`).
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    sendJson(res, 200, {
      created: Date.now(),
      data: [{ b64_json: b64 }],
    })
    return
  }

  sendJson(res, 404, { error: { message: `mock: unknown endpoint ${path}`, type: 'not_found' } })
})

server.listen(PORT, () => {
  console.log(`Mock AI service listening on http://localhost:${PORT}${BASE}`)
})
