import { AiError } from '@/domain/types'
import type { ServiceConfig } from '@/domain/types'
import type { EndpointProfile } from '@/ai/providers'
import { profileById } from '@/ai/providers'
import { postJson, postStream, request } from '@/ai/transport'
import { normalizeBodyError } from '@/ai/errors'
import { pcmToWavBlob } from '@/utils/audio'
import {
  buildResponseFormat,
  FALLBACK_RESPONSE_FORMAT,
  CONNECTION_SCHEMA,
  type SchemaObject,
} from '@/ai/schema'
import { schemaInPrompt } from '@/ai/prompts'

/**
 * The single AI adapter (T024; constitution Principle IV). All request construction, response
 * parsing and error mapping for the learner's OpenAI-compatible endpoint happens here — feature
 * code never talks to `fetch` directly.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  service: ServiceConfig
  path?: string
  messages: ChatMessage[]
  schema?: { name: string; schema: SchemaObject }
  stream: boolean
  onDelta?: (text: string) => void
  signal?: AbortSignal
  maxRetries?: number
}

export interface ChatResult {
  content: string
  finishReason: string | null
  refusal: string | null
  unstreamed: boolean
}

export function authHeaders(
  service: ServiceConfig,
  profile: EndpointProfile,
): Record<string, string> {
  const key = profile.sendRealKey ? service.apiKey.trim() : 'ollama'
  if (service.authMode === 'x-api-key') return { 'x-api-key': key }
  if (service.authMode === 'api-key') return { 'api-key': key }
  return { authorization: `Bearer ${key}` }
}

function buildUrl(service: ServiceConfig, path: string): string {
  return `${service.baseUrl.replace(/\/+$/, '')}${path}`
}

function bodyWithSchema(
  service: ServiceConfig,
  profile: EndpointProfile,
  messages: ChatMessage[],
  stream: boolean,
  schema: { name: string; schema: SchemaObject } | undefined,
  useFallback: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: service.chatModel,
    messages,
  }
  if (stream) {
    body.stream = true
    body.stream_options = { include_usage: true }
  }
  if (schema) {
    if (useFallback) {
      body.response_format = FALLBACK_RESPONSE_FORMAT
      const last = body.messages as unknown as ChatMessage[]
      body.messages = [
        ...last,
        {
          role: 'system',
          content: `Answer exactly in this JSON schema:\n${schemaInPrompt(schema.schema)}`,
        },
      ]
    } else {
      body.response_format = buildResponseFormat(
        schema.name,
        schema.schema,
        profile.schemaPlacement,
      )
    }
  }
  return body
}

interface ParsedCompletion {
  content: string
  finishReason: string | null
  refusal: string | null
}

function parseCompletionObject(json: unknown): ParsedCompletion {
  const obj = json as {
    choices?: Array<{
      message?: { content?: string | null; refusal?: string | null }
      finish_reason?: string | null
    }>
    error?: unknown
  }
  if (obj && obj.error && !Array.isArray(obj.choices)) {
    throw normalizeBodyError(obj, 200)
  }
  const choice = obj?.choices?.[0]
  if (!choice) {
    throw normalizeBodyError(obj, 200)
  }
  const message = choice.message ?? {}
  const refusal = message.refusal ?? null
  const finishReason = choice.finish_reason ?? null
  if (refusal) {
    return { content: '', finishReason, refusal }
  }
  if (finishReason === 'length') {
    throw new AiError(
      'provider',
      'The service response was cut off (token limit reached); try again.',
      200,
    )
  }
  if (finishReason === 'content_filter') {
    return { content: '', finishReason, refusal: 'The service filtered this response.' }
  }
  return { content: message.content ?? '', finishReason, refusal: null }
}

function finishFromFrames(frames: unknown[]): string | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const c = frames[i] as {
      choices?: Array<{ finish_reason?: string | null }>
    }
    const fr = c?.choices?.[0]?.finish_reason
    if (fr) return fr
  }
  return null
}

/**
 * One chat completion. Tries `json_schema` (or `json_object` when the profile says so); on a 4xx
 * rejection of `response_format`, retries once with `json_object` and the schema in the prompt.
 */
export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatResult> {
  const profile = profileById(opts.service.providerProfile)
  const service = opts.service
  const url = buildUrl(service, opts.path ?? '/chat/completions')
  const headers = authHeaders(service, profile)
  const attempts = Math.max(1, opts.maxRetries ?? 2)

  for (let attempt = 0; attempt < attempts; attempt++) {
    const useFallback = attempt > 0
    const body = bodyWithSchema(
      service,
      profile,
      opts.messages,
      opts.stream,
      opts.schema,
      useFallback,
    )

    try {
      if (opts.stream) {
        const onDelta = opts.onDelta
        const streamResult = await postStream(
          url,
          headers,
          body,
          (data) => {
            if (onDelta) onDelta(data)
          },
          opts.signal,
        )
        if (!streamResult.unstreamed) {
          // Assemble content from the delta chunks.
          let content = ''
          let refusal: string | null = null
          for (const frame of streamResult.frames) {
            const f = frame as {
              choices?: Array<{
                delta?: { content?: string | null; refusal?: string | null }
                message?: { content?: string | null }
                refusal?: string | null
              }>
            }
            const choice = f?.choices?.[0]
            if (!choice) continue
            if (typeof choice.delta?.content === 'string') content += choice.delta.content
            else if (typeof choice.message?.content === 'string') content += choice.message.content
            if (choice.delta?.refusal || choice.refusal)
              refusal = choice.delta?.refusal ?? choice.refusal ?? refusal
          }
          return {
            content,
            finishReason: finishFromFrames(streamResult.frames),
            refusal,
            unstreamed: false,
          }
        }
        // The endpoint answered with a plain JSON body despite stream: true.
        const parsed = parseCompletionObject(streamResult.frames[0])
        return { ...parsed, unstreamed: true }
      }

      const json = await postJson(url, headers, body, opts.signal)
      const parsed = parseCompletionObject(json)
      return { ...parsed, unstreamed: false }
    } catch (err) {
      if (err instanceof AiError && err.kind === 'bad_request' && attempt < attempts - 1) {
        continue // retry with the json_object fallback once
      }
      throw err
    }
  }
  throw new AiError('provider', 'The service did not complete the request.', null)
}

/** The current visible value of a JSON string field as it streams in (progressive partner line). */
export function growingStringValue(acc: string, key: string): string {
  const keyIdx = acc.indexOf(`"${key}":`)
  if (keyIdx === -1) return ''
  const colonIdx = acc.indexOf(':', keyIdx)
  const startQuote = acc.indexOf('"', colonIdx + 1)
  if (startQuote === -1) return ''
  const rest = acc.slice(startQuote + 1)
  let out = ''
  let closed = false
  let i = 0
  while (i < rest.length) {
    const ch = rest[i]
    if (ch === '\\') {
      out += ch
      if (i + 1 < rest.length) {
        out += rest[i + 1]
        i += 2
      } else {
        break
      }
      continue
    }
    if (ch === '"') {
      closed = true
      break
    }
    out += ch
    i++
  }
  const value = closed ? out : out.replace(/\\[bnr]*$/, '')
  return value.replace(/\\n/g, ' ').replace(/\\"/g, '"')
}

/** Leniently parse a JSON object from model text (extract + tolerate unknown keys). */
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    ...(trimmed
      .match(/```(?:json)?\s*([\s\S]*?)```/g)
      ?.map((m) => m.replace(/^```(?:json)?\s*/g, '').replace(/```$/, '')) ?? []),
  ]
  for (const candidate of candidates) {
    if (!candidate || candidate[0] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end > 0) {
      try {
        return JSON.parse(candidate.slice(0, end))
      } catch {
        continue
      }
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Connection test (T073)                                              */
/* ------------------------------------------------------------------ */
export interface ConnectionTestResult {
  ok: boolean
  message: string
  models?: string[]
  corsHint?: string | null
}

export async function testConnection(service: ServiceConfig): Promise<ConnectionTestResult> {
  const profile = profileById(service.providerProfile)
  try {
    const result = await chatCompletion({
      service,
      messages: [
        { role: 'system', content: 'You are a connectivity probe. Answer with the JSON schema.' },
        { role: 'user', content: 'Reply with the JSON object {"reply": "ok"}.' },
      ],
      schema: {
        name: 'embrollado_connection',
        schema: CONNECTION_SCHEMA as unknown as SchemaObject,
      },
      stream: false,
      maxRetries: 1,
    })
    if (result.refusal) {
      return { ok: false, message: result.refusal }
    }
    return { ok: true, message: 'Connected.' }
  } catch (err) {
    if (err instanceof AiError) {
      if (err.kind === 'cors' || err.kind === 'network') {
        return {
          ok: false,
          message: 'The service did not allow the request from the browser.',
          corsHint: profile.corsHint,
        }
      }
      if (err.kind === 'auth') return { ok: false, message: 'The service rejected the key.' }
      if (err.kind === 'rate_limit')
        return { ok: false, message: 'The service is rate limiting, try again in a moment.' }
      return { ok: false, message: err.message }
    }
    return { ok: false, message: String(err) }
  }
}

export async function listModels(service: ServiceConfig): Promise<string[]> {
  const profile = profileById(service.providerProfile)
  const url = buildUrl(service, '/models')
  const headers = authHeaders(service, profile)
  const response = await request(url, { method: 'GET', headers })
  const json = (await response.json().catch(() => ({}))) as { data?: Array<{ id: string }> }
  return (json.data ?? []).map((m) => m.id).filter(Boolean)
}

/* ------------------------------------------------------------------ */
/* Speech (T081)                                                       */
/* ------------------------------------------------------------------ */
export type CapabilityResult =
  { ok: true; blob: Blob; mimeType: string } | { ok: false; unsupported: boolean; message: string }

/**
 * Request a partner line as speech. The profile's primary format is tried first; on an HTTP 400
 * (Gemini TTS / HeyGen accept only `pcm`, MiniMax only `mp3`) a single retry with the alternate
 * format is made. Raw `pcm` responses are wrapped into a WAV container so browser playback and
 * the speech cache work regardless of format.
 */
export async function requestSpeech(
  service: ServiceConfig,
  text: string,
  voice: string,
): Promise<CapabilityResult> {
  const profile = profileById(service.providerProfile)
  if (!profile.audioResponseFormat || !service.speechModel) {
    return { ok: false, unsupported: true, message: 'This service cannot produce speech.' }
  }
  const headers = authHeaders(service, profile)
  const url = buildUrl(service, '/audio/speech')
  const formats = [profile.audioResponseFormat, profile.altAudioResponseFormat].filter(
    (f): f is string => Boolean(f),
  )

  for (let i = 0; i < formats.length; i++) {
    const fmt = formats[i]
    try {
      const response = await postJsonRaw(url, headers, {
        model: service.speechModel,
        input: text.slice(0, 4096),
        voice,
        response_format: fmt,
      })
      const bytes = new Uint8Array(await response.arrayBuffer())
      const mimeType = response.headers.get('content-type')?.split(';')[0] ?? 'audio/mpeg'
      if (mimeType === 'audio/pcm' || fmt === 'pcm') {
        // Header-less raw 16-bit LE PCM → playable WAV.
        const wav = pcmToWavBlob(bytes, profile.pcmSampleRate, profile.pcmChannels)
        return { ok: true, blob: wav, mimeType: 'audio/wav' }
      }
      return { ok: true, blob: new Blob([bytes], { type: mimeType }), mimeType }
    } catch (err) {
      const isFormatError = err instanceof AiError && err.kind === 'bad_request'
      if (isFormatError && i < formats.length - 1) continue
      if (
        err instanceof AiError &&
        (err.kind === 'not_found' || err.status === 404 || err.status === 405)
      ) {
        return { ok: false, unsupported: true, message: 'This service cannot produce speech.' }
      }
      return {
        ok: false,
        unsupported: false,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { ok: false, unsupported: false, message: 'The service could not produce speech.' }
}

/** Internal: like postJson but returns the raw Response (raw bytes for speech). */
async function postJsonRaw(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Response> {
  return request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/* ------------------------------------------------------------------ */
/* Images (T084)                                                       */
/* ------------------------------------------------------------------ */
export type ImageResult =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | { ok: false; unsupported: boolean; message: string }

export async function requestImage(service: ServiceConfig, prompt: string): Promise<ImageResult> {
  const profile = profileById(service.providerProfile)
  if (!profile.imagesPath || !service.imageModel) {
    return { ok: false, unsupported: true, message: 'This service cannot generate images.' }
  }
  const headers = authHeaders(service, profile)
  const url = buildUrl(service, profile.imagesPath)
  try {
    const json = (await postJson(url, headers, {
      model: service.imageModel,
      prompt: prompt.slice(0, 1000),
      size: '1024x1024',
      output_format: 'webp',
      n: 1,
    })) as { data?: Array<{ b64_json?: string; url?: string }> }
    const item = json?.data?.[0]
    if (item?.b64_json) {
      const bin = atob(item.b64_json)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { ok: true, bytes, mimeType: 'image/webp' }
    }
    // A provider that answers with a remote `url` is not used for display, but the bytes are
    // fetched once at generation time so no third-party address is contacted later (FR-029).
    if (item?.url) {
      const res = await fetch(item.url)
      const bytes = new Uint8Array(await res.arrayBuffer())
      return { ok: true, bytes, mimeType: res.headers.get('content-type') ?? 'image/png' }
    }
    return { ok: false, unsupported: false, message: 'The picture service returned no image.' }
  } catch (err) {
    if (
      err instanceof AiError &&
      (err.kind === 'not_found' || err.status === 404 || err.status === 405)
    ) {
      return { ok: false, unsupported: true, message: 'This service cannot generate images.' }
    }
    return {
      ok: false,
      unsupported: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
