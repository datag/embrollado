import type { AuthMode, ServiceConfig } from '@/domain/types'

/**
 * Declarative endpoint profiles (T023, ai-service.md §7). All provider differences that would
 * otherwise leak into the adapter live here: base URL, auth style, schema placement, JSON mode,
 * speech format and the images path.
 */

export type SchemaPlacement = 'nested' | 'sibling'
export type JsonMode = 'json_schema' | 'json_object'

export interface EndpointProfile {
  id: string
  label: string
  defaultBaseUrl: string
  defaultAuthMode: AuthMode
  schemaPlacement: SchemaPlacement
  jsonMode: JsonMode
  defaultVoice: string
  /** Primary speech `response_format`; null = the capability is not offered by this profile. */
  audioResponseFormat: string | null
  /** Retried once after an HTTP 400 (Gemini/HeyGen accept only pcm, MiniMax only mp3). */
  altAudioResponseFormat: string | null
  /** Used to wrap raw 16-bit LE PCM into a WAV container so browsers can play it. */
  pcmSampleRate: number
  pcmChannels: number
  /** The images endpoint path (relative to baseUrl); null = no images. */
  imagesPath: string | null
  /** The learner's key IS sent. False for local servers that require any non-empty value. */
  sendRealKey: boolean
  /** Cross-origin workaround hint shown when a request fails with a TypeError (FR-039). */
  corsHint: string | null
  /** Optional query string appended to `GET {baseUrl}/models` (OpenRouter: output_modalities=all). */
  modelsFilter: string | null
}

export const PROVIDER_PROFILES: Record<string, EndpointProfile> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: 'mp3',
    altAudioResponseFormat: 'pcm',
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: '/images/generations',
    sendRealKey: true,
    corsHint: null,
    modelsFilter: null,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    // pcm is the API's default and the only format Gemini TTS / HeyGen accept; raw 16-bit LE PCM
    // is wrapped into a WAV container client-side so it plays in a browser <audio> element.
    audioResponseFormat: 'pcm',
    altAudioResponseFormat: 'mp3',
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: '/images',
    sendRealKey: true,
    corsHint: null,
    // The unfiltered list hides every TTS model (they declare output_modalities: ["speech"] and
    // are excluded from the default text-only listing); `all` returns chat, speech and image.
    modelsFilter: '?output_modalities=all',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: 'wav',
    altAudioResponseFormat: null,
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: null,
    // Ollama ignores the key but requires a non-empty one — send a placeholder, not the real key.
    sendRealKey: false,
    corsHint:
      'OLLAMA_ORIGINS="http://localhost:5173" ollama serve  (or: ollama origin add <origin>)',
    modelsFilter: null,
  },
  llamacpp: {
    id: 'llamacpp',
    label: 'llama.cpp',
    defaultBaseUrl: 'http://localhost:9931/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'sibling',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: null,
    altAudioResponseFormat: null,
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: null,
    sendRealKey: true,
    corsHint: 'llama-server --cors-origins "http://localhost:5173"',
    modelsFilter: null,
  },
  vllm: {
    id: 'vllm',
    label: 'vLLM',
    defaultBaseUrl: 'http://localhost:8000/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: null,
    altAudioResponseFormat: null,
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: null,
    sendRealKey: true,
    corsHint:
      'vllm serve <model> --allowed-origins \'["http://localhost:5173"]\'  (empty by default since v0.32)',
    modelsFilter: null,
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: null,
    altAudioResponseFormat: null,
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: null,
    sendRealKey: true,
    corsHint: null, // no documented flag (verified: none found)
    modelsFilter: null,
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    // No standard address — the Settings screen leaves the field alone for this profile.
    defaultBaseUrl: '',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: 'mp3',
    altAudioResponseFormat: 'pcm',
    pcmSampleRate: 24000,
    pcmChannels: 1,
    imagesPath: '/images/generations',
    sendRealKey: true,
    corsHint: "Allow the app origin in your server's CORS configuration.",
    modelsFilter: null,
  },
}

export function profileById(id: string): EndpointProfile {
  return PROVIDER_PROFILES[id] ?? PROVIDER_PROFILES.custom
}

/** The default service address for a profile id (empty for `custom`). */
export function addressForProfile(id: string): string {
  return profileById(id).defaultBaseUrl
}

/**
 * Whether the current service address is auto-filled and may be replaced when the profile
 * changes: it is empty, or it still equals the previous profile's default address. A manually
 * entered address is never overwritten (settings-profile.md §2.1).
 */
export function shouldPrefillAddress(current: string, oldProfileId: string): boolean {
  const value = current.trim()
  if (!value) return true
  const previous = addressForProfile(oldProfileId)
  if (!previous) return false
  return value.replace(/\/+$/, '') === previous.replace(/\/+$/, '')
}

/** Whether the current auth style is still the old profile's default (safe to replace). */
export function shouldResetAuthMode(current: AuthMode, oldProfileId: string): boolean {
  return current === profileById(oldProfileId).defaultAuthMode
}

/* ------------------------------------------------------------------ */
/* Model list classification (settings-profile.md §2.1)                */
/* ------------------------------------------------------------------ */

/** One entry of `GET {baseUrl}/models`, with the capability hints the server declares. */
export interface ModelInfo {
  id: string
  /** The model's declared output modalities (e.g. `['text']`, `['text', 'audio']`). */
  outputModalities: string[]
}

export interface ClassifiedModels {
  chat: string[]
  speech: string[]
  image: string[]
}

/** Profiles whose servers expose only chat models — never speech or images. */
const CHAT_ONLY_PROFILES = new Set(['llamacpp', 'vllm', 'lmstudio'])

/**
 * Natural ordering for model ids — "3.8" before "3.10", "gpt-4" before "gpt-10"
 * (settings-profile.md §2.1).
 */
const MODEL_COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export function sortNatural(ids: string[]): string[] {
  return [...ids].sort(MODEL_COLLATOR.compare)
}

/**
 * Split a model list into the three Settings fields. The classification is a suggestion only —
 * the learner can still type any model name.
 *
 * Servers that declare `output_modalities` (OpenRouter) are trusted — note that TTS models
 * declare `"speech"`, not `"audio"` (`audio` means chat-with-audio-output on /chat/completions,
 * which is not our /audio/speech). Modalities outside text/speech/image — embeddings, rerank,
 * decisions, video, transcription — fit none of the three fields and are dropped.
 *
 * Everyone else (OpenAI, Ollama, Custom) declares nothing and is classified by name:
 *  - speech: `tts` / `speech` / `voice`, never `whisper` / `transcribe` (those are ASR);
 *  - image: `image`, `dall-e`, `flux`, `imagen`, `sdxl`;
 *  - the rest are chat models.
 */
export function classifyModels(profileId: string, models: ModelInfo[]): ClassifiedModels {
  if (CHAT_ONLY_PROFILES.has(profileId)) {
    return {
      chat: sortNatural(models.map((m) => m.id).filter(Boolean)),
      speech: [],
      image: [],
    }
  }
  const speech = new Set<string>()
  const image = new Set<string>()
  const chat = new Set<string>()
  for (const m of models) {
    const id = m.id.trim()
    if (!id) continue
    const mods = m.outputModalities
    if (mods.length > 0) {
      // Declared modalities are trusted.
      if (mods.includes('speech')) speech.add(id)
      if (mods.includes('image')) image.add(id)
      if (mods.includes('text')) chat.add(id)
      continue
    }
    const lower = id.toLowerCase()
    if (/\b(tts|speech|voice)\b/.test(lower) && !/\b(whisper|transcrib)\b/.test(lower)) {
      speech.add(id)
    } else if (/\bimage\b|dall-?e|flux|imagen|sdxl/.test(lower)) {
      image.add(id)
    } else {
      chat.add(id)
    }
  }
  return {
    chat: sortNatural([...chat]),
    speech: sortNatural([...speech]),
    image: sortNatural([...image]),
  }
}

/**
 * Whether the generate-picture button may be offered (FR-028 as amended). The three conditions
 * must hold: an image model is configured, the current provider profile exposes an images path
 * (ollama/llama.cpp/vLLM/LM Studio never do — a button there would always fail), and the service
 * has not already declined the images endpoint.
 */
export function canGenerateImages(service: ServiceConfig, imagesAvailable: boolean): boolean {
  return (
    !!service.imageModel?.trim() &&
    !!profileById(service.providerProfile).imagesPath &&
    imagesAvailable
  )
}

/** Guess a profile from a base URL (used as the initial suggestion in Settings). */
export function guessProfileFromUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().toLowerCase()
  if (normalized.includes('openrouter')) return 'openrouter'
  if (normalized.includes('api.openai.com') || normalized.includes('openai')) return 'openai'
  if (normalized.includes('ollama') || /:\/\/localhost:11434/.test(normalized)) return 'ollama'
  if (normalized.includes('llamacpp') || normalized.includes('llama') || /:9931/.test(normalized))
    return 'llamacpp'
  if (normalized.includes('vllm') || /:8000/.test(normalized)) return 'vllm'
  if (normalized.includes('lmstudio') || /:1234/.test(normalized)) return 'lmstudio'
  return 'custom'
}

/** The cross-origin hint for a provider id (FR-039). */
export function corsHintFor(profileId: string): string | null {
  return profileById(profileId).corsHint
}
