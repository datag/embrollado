import type { AuthMode } from '@/domain/types'

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
  /** Explicit speech `response_format`; null = the capability is not offered by this profile. */
  audioResponseFormat: string | null
  /** The images endpoint path (relative to baseUrl); null = no images. */
  imagesPath: string | null
  /** The learner's key IS sent. False for local servers that require any non-empty value. */
  sendRealKey: boolean
  /** Cross-origin workaround hint shown when a request fails with a TypeError (FR-039). */
  corsHint: string | null
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
    imagesPath: '/images/generations',
    sendRealKey: true,
    corsHint: null,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: 'pcm',
    imagesPath: '/images',
    sendRealKey: true,
    corsHint: null,
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
    imagesPath: null,
    // Ollama ignores the key but requires a non-empty one — send a placeholder, not the real key.
    sendRealKey: false,
    corsHint: 'OLLAMA_ORIGINS="http://localhost:5173" ollama serve  (or: ollama origin add <origin>)',
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
    imagesPath: null,
    sendRealKey: true,
    corsHint: 'llama-server --cors-origins "http://localhost:5173"',
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
    imagesPath: null,
    sendRealKey: true,
    corsHint:
      'vllm serve <model> --allowed-origins \'["http://localhost:5173"]\'  (empty by default since v0.32)',
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
    imagesPath: null,
    sendRealKey: true,
    corsHint: null, // no documented flag (verified: none found)
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultAuthMode: 'bearer',
    schemaPlacement: 'nested',
    jsonMode: 'json_schema',
    defaultVoice: 'alloy',
    audioResponseFormat: 'mp3',
    imagesPath: '/images/generations',
    sendRealKey: true,
    corsHint: 'Allow the app origin in your server\'s CORS configuration.',
  },
}

export function profileById(id: string): EndpointProfile {
  return PROVIDER_PROFILES[id] ?? PROVIDER_PROFILES.custom
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