import type { EndpointProfile } from '@/ai/providers'

/**
 * App attribution — the app identifies itself to providers that attribute traffic to apps
 * (OpenRouter's app page, its rankings and the per-app analytics; FR-066).
 *
 * **Why headers and not a `User-Agent`:** the `User-Agent` header belongs to the browser, which
 * silently discards a value set from JavaScript — `fetch(url, { headers: { 'User-Agent': … } })`
 * arrives with the browser's own UA. A browser app therefore cannot put its name into the UA.
 *
 * **Why not a field in the payload:** the OpenAI-compatible body has no field for the calling
 * app (`user` identifies the end user, not the app), and strict OpenAI-compatible servers reject
 * unknown fields with an HTTP 400.
 *
 * **Why per profile and not everywhere:** these are non-simple headers, so the browser sends a
 * CORS preflight first. A server that does not list them in `Access-Control-Allow-Headers`
 * rejects the request outright — Ollama, for example, allows only `Authorization`, `Content-Type`,
 * `User-Agent`, `Accept`, `X-Requested-With`, `OpenAI-Beta` and the `x-stainless-*` headers. Only
 * a profile that documents the headers receives them.
 */

/** The app's canonical URL — the identity OpenRouter keys its app page on. */
export const APP_REFERER_URL = 'https://datag.github.io/embrollado/'

/** The display name in the rankings and in the app analytics. */
export const APP_TITLE = 'Embrollado'

/** OpenRouter marketplace category ("roleplay" = role-play and character-based chat apps). */
export const APP_CATEGORIES = 'roleplay'

/**
 * The attribution headers for a provider profile — empty when the profile does not support them.
 *
 * The values are app constants; they never carry anything about the learner (Principle II).
 */
export function attributionHeaders(profile: EndpointProfile): Record<string, string> {
  switch (profile.attributionScheme) {
    case 'openrouter':
      return {
        // Required: without it OpenRouter creates no app page and counts no ranking.
        'HTTP-Referer': APP_REFERER_URL,
        // The display name; `X-Title` is the legacy spelling and is not needed.
        'X-OpenRouter-Title': APP_TITLE,
        'X-OpenRouter-Categories': APP_CATEGORIES,
        // Keeps the app out of the public rankings and the marketplace: the attribution still
        // works and the usage shows up in our own analytics.
        'X-OpenRouter-App-Visibility': 'hidden',
      }
    default:
      return {}
  }
}
