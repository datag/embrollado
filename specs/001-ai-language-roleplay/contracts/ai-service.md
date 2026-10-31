# Contract: The AI Service (OpenAI-compatible, BYOK)

**Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Research**: [../research.md](../research.md)

The app talks to **one** endpoint that the learner configures. Every request goes directly from
the browser to that address (spec FR-038). This contract defines what the app sends, what it
accepts, and how failures are surfaced.

---

## 1. Configuration the learner provides

| Setting       | Example                     | Notes                                                          |
| ------------- | --------------------------- | -------------------------------------------------------------- |
| `baseUrl`     | `https://api.openai.com/v1` | Absolute http(s) URL; no trailing `/v1` is added automatically |
| `apiKey`      | `sk-…`                      | Stored locally only; never logged, never exported              |
| `authMode`    | `bearer`                    | `bearer` (default), `x-api-key`, `api-key`                     |
| `chatModel`   | `gpt-6-luna`                | Required                                                       |
| `speechModel` | `gpt-4o-mini-tts`           | Optional; absent ⇒ the speech button is hidden                 |
| `speechVoice` | `alloy`                     | Optional; model-specific, empty ⇒ profile default              |
| `imageModel`  | `gpt-image-2`               | Optional; absent ⇒ no illustrations                            |

## 2. Endpoints the app uses

| Purpose        | Path                                             | Method | Notes                                                       |
| -------------- | ------------------------------------------------ | ------ | ----------------------------------------------------------- |
| Chat (a turn)  | `{baseUrl}/chat/completions`                     | POST   | The only mandatory call                                     |
| Chat, streamed | `{baseUrl}/chat/completions` with `stream: true` | POST   | Same body plus `stream`/`stream_options`                    |
| Models         | `{baseUrl}/models`                               | GET    | Optional — offered as a hint in Settings; never required    |
| Speech         | `{baseUrl}/audio/speech`                         | POST   | Optional capability                                         |
| Images         | `{baseUrl}/images/generations`                   | POST   | Optional capability; **OpenRouter uses `/images`** (see §7) |

`baseUrl` already contains the provider's version prefix (`/v1`, `/api/v1`). Azure-style endpoints
are modelled with a URL template that appends `?api-version=…` to every path.

## 3. Request: one turn

```http
POST {baseUrl}/chat/completions
Authorization: Bearer {apiKey}
Content-Type: application/json
```

```json
{
  "model": "gpt-6-luna",
  "stream": true,
  "stream_options": { "include_usage": true },
  "messages": [
    { "role": "system", "content": "<system prompt — see contracts/turn-payload.md §4>" },
    { "role": "system", "content": "<learner profile and session setup>" },
    { "role": "user", "content": "<the learner's answer>" }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "embrollado_turn",
      "strict": true,
      "schema": { "…": "see contracts/turn-payload.md §2" }
    }
  }
}
```

**Fallback**: if the endpoint rejects `response_format` with a 4xx, the app retries **once** with
`{"response_format": {"type": "json_object"}}` and the schema embedded in the system prompt, then
parses the result leniently (extract the first balanced JSON object, tolerate unknown keys).

**Model refusals**: `message.refusal` is set and `message.content` is empty — the app shows the
refusal as a readable message and never renders it as feedback.

## 4. Response: one turn

```json
{
  "id": "chatcmpl-…",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "<the JSON turn>" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 81, "completion_tokens": 11, "total_tokens": 92 }
}
```

`finish_reason` handling: `stop` ⇒ parse the content; `length` ⇒ the JSON was truncated, so the
app reports a failure and offers to retry; `content_filter` ⇒ reported as a refusal.

## 5. Streaming

- Wire format: `data: <json>\n\n` frames, terminated by `data: [DONE]`.
- The app parses frames itself; it never uses `EventSource` (it cannot POST).
- The parser must tolerate: comment frames (`:` prefix), keepalive frames, a missing `choices`
  array, and OpenRouter's final usage frame that carries a non-empty `choices`.
- The **accumulated text is never parsed as JSON while the stream is running**. It is parsed once,
  after the stream ends.
- Only the `partnerText` field is rendered progressively. The rest of the turn — including the
  line's own translation (FR-057) — appears when the stream completes (spec FR-035).
- If the endpoint does not stream (it answers with a normal JSON body), the app renders the
  complete turn — the fallback is required by FR-035 and is not an error.

## 6. Errors

The app normalises every failure into one internal kind:

```ts
type AiErrorKind =
  | 'auth'
  | 'permission'
  | 'quota'
  | 'rate_limit'
  | 'bad_request'
  | 'not_found'
  | 'overloaded'
  | 'provider'
  | 'content_filter'
  | 'refusal'
  | 'timeout'
  | 'network'
  | 'cors'
  | 'unknown'
```

| Situation                                                 | Detection                                             | Learner-facing outcome                                                         |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| OpenAI shape `{ error: { message, type, param, code } }`  | `error.type`                                          | mapped by `type`                                                               |
| OpenRouter shape `{ error: { code, message, metadata } }` | `error.code` (a number) + `error.metadata.error_type` | mapped by `error_type`                                                         |
| Error body with **HTTP 200**                              | body has `error` and no `choices`                     | treated as an error (OpenRouter does this)                                     |
| HTTP 401 / 403                                            | status                                                | "the service rejected the key" → link to Settings                              |
| HTTP 402                                                  | status                                                | "the account has no credit left" (OpenRouter only)                             |
| HTTP 429                                                  | status                                                | "the service is rate limiting" → retry later, text kept                        |
| HTTP 5xx                                                  | status                                                | "the service is unavailable" → retry                                           |
| `fetch` rejects with `TypeError`                          | no response object                                    | **cross-origin or offline** — the app shows the provider-specific hint from §7 |
| Non-JSON body                                             | parse fails                                           | "the service answered in an unexpected format"                                 |

**Backoff**: `Retry-After` is not readable cross-origin (neither OpenAI nor OpenRouter expose it),
so the app uses its own schedule: wait 2 s, 4 s, 8 s, at most 3 attempts, only for `rate_limit`,
`overloaded` and `provider`. The learner's typed text is kept and can be sent again manually.

**Redaction**: the API key is replaced with `***` in every log line, error message and copyable
diagnostic before it reaches the UI or the console (FR-022).

## 7. Provider profiles

The app ships profiles for the common endpoints. The profile is chosen in Settings and **leads**:
selecting one pre-fills the service address with the profile's standard URL while the address is
still auto-filled (empty or the previous profile's default); a manually entered address is never
overwritten. Typing an address never changes the profile — when it matches another profile, a
hint offers to switch, applied only on tap. The auth style is replaced on a profile switch only
while it still is the previous profile's default. Two **presets** (OpenAI, OpenRouter) apply a
curated model set in one tap — profile, address (while auto-filled), chat/speech/image models and
the TTS voice; the API key is never touched.

| Profile      | Base URL                       | Auth                 | Schema placement        | JSON mode     | Audio format                                                                            | Images path           |
| ------------ | ------------------------------ | -------------------- | ----------------------- | ------------- | --------------------------------------------------------------------------------------- | --------------------- |
| `openai`     | `https://api.openai.com/v1`    | `bearer`             | nested                  | `json_schema` | `mp3`                                                                                   | `/images/generations` |
| `openrouter` | `https://openrouter.ai/api/v1` | `bearer`             | nested                  | `json_schema` | `pcm` (default; Gemini TTS/HeyGen accept only pcm, MiniMax only mp3 → one 400-fallback) | `/images`             |
| `ollama`     | `http://localhost:11434/v1`    | `bearer` (any value) | nested                  | `json_schema` | `wav`                                                                                   | —                     |
| `llamacpp`   | `http://localhost:9931/v1`     | `bearer`             | **sibling** (send both) | `json_schema` | —                                                                                       | —                     |
| `vllm`       | `http://localhost:8000/v1`     | `bearer`             | nested                  | `json_schema` | —                                                                                       | —                     |
| `lmstudio`   | `http://localhost:1234/v1`     | `bearer`             | nested                  | `json_schema` | —                                                                                       | —                     |
| `custom`     | anything else                  | selectable           | selectable              | selectable    | selectable                                                                              | selectable            |

Notes carried by a profile:

- `authMode: 'x-api-key'` sends `x-api-key` and **no** `Authorization` header; `api-key` sends
  `api-key` (Azure-style).
- A URL template profile appends `?api-version=…` to every path (Azure).
- `response_format` for speech is always sent explicitly, because the servers' defaults differ and
  unsupported values are hard errors.
- Ollama ignores the API key but requires a non-empty one; the app sends a placeholder rather
  than the learner's real key to a local server when the profile says so.

## 8. Cross-origin guidance (spec FR-039)

When the request fails with a `TypeError` (no status, no body), the app explains that the service
did not allow the request from the browser and shows the matching hint:

| Service             | Hint                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Ollama              | `OLLAMA_ORIGINS="http://localhost:5173" ollama serve` (or `ollama origin add <origin>`)               |
| llama.cpp           | `llama-server --cors-origins "http://localhost:5173"`                                                 |
| vLLM                | `vllm serve <model> --allowed-origins '["http://localhost:5173"]'` — **empty by default since v0.32** |
| LM Studio           | unknown — no documented flag (verified: no documentation found)                                       |
| OpenAI / OpenRouter | not applicable — both allow browser origins                                                           |

The app never suggests a proxy of our own: FR-038 forbids one.

## 9. Speech

```http
POST {baseUrl}/audio/speech
{ "model": "…", "input": "<the line, max 4096 characters>", "voice": "…", "response_format": "mp3|pcm" }
```

The response is **raw audio bytes**, not JSON. The app wraps them in a `Blob` and plays them from
the object URL; it never hands a provider URL to an `<audio>` element.

- The profile picks the primary format (`mp3` for OpenAI, `pcm` for OpenRouter — its default, and
  the only format Gemini TTS / HeyGen Voice accept, while MiniMax only accepts `mp3`). On an HTTP
  400 the app retries **once** with the alternate format.
- A `pcm` response is header-less raw 16-bit little-endian audio, which a browser `<audio>` cannot
  play: the app wraps it in a WAV container client-side (24 kHz mono by default) before storage and
  playback, so `pcm`-only services work transparently.

If the endpoint answers 404/405, the speech capability is marked unavailable: the button is hidden
or disabled with a one-line explanation, and the dialogue continues (FR-027).

## 10. Images

```http
POST {baseUrl}/images/generations
{ "model": "…", "prompt": "<scene>", "size": "1024x1024", "output_format": "webp", "n": 1 }
```

- The app requests **base64** output. A provider that answers with a `url` pointing at another
  host is not used: the bytes are fetched once at generation time, converted to a `Blob` and stored
  locally, so no third-party address is ever contacted when the picture is displayed (FR-029).
- The image request is **not** part of the turn request. It is a separate, explicit call for the
  start, the key moments and the end (FR-028), so a failing image service never blocks the
  conversation (FR-030).
- Base64 inflates the payload by 4/3; `output_format: "webp"` with compression is requested where
  the model supports it, and the stored bytes are what the app displays regardless of the
  declared format.

## 11. Capability detection

| Capability        | How it is determined                                           | When                   |
| ----------------- | -------------------------------------------------------------- | ---------------------- |
| Chat              | assumed; verified by the first successful request              | first use              |
| Structured output | the first response parses as the expected shape                | first use              |
| Streaming         | the response is an SSE stream                                  | first use              |
| Models list       | `GET {baseUrl}/models` succeeds                                | on request in Settings |
| Speech            | `POST {baseUrl}/audio/speech` does not fail with 404/405       | on request in Settings |
| Images            | `POST {baseUrl}/images/generations` does not fail with 404/405 | on request in Settings |

Detection never spends money: the speech and image probes are **not** sent automatically. The
learner triggers a "test this service" action in Settings, and the result is remembered for the
session.

`GET {baseUrl}/models` is offered as a suggestion source for the chat, speech and image fields.
OpenRouter is asked with `?output_modalities=all` (the unfiltered listing hides every TTS model —
they declare `output_modalities: ["speech"]` and are excluded from the default text-only list).
The split trusts the server's declared `output_modalities` when present: `speech` ⇒ speech,
`image` ⇒ image, `text` ⇒ chat, other modalities (embeddings, rerank, video, transcription) are
dropped. `audio` is chat-with-audio-output, not TTS. Without declared modalities the split is a
name-based heuristic (`tts`/`speech`/`voice` ⇒ speech, never `whisper`/`transcribe`; `image`/
`dall-e`/`flux`/`imagen`/`sdxl` ⇒ image) and remains a suggestion — the fields are free text and
nothing is ever applied automatically. Lists are sorted naturally.

## 12. What the app must never do

- Send anything to an origin other than the configured `baseUrl` (SC-007).
- Send a request the learner did not trigger (FR-023).
- Log, export or display the API key (FR-022).
- Route a request through an intermediary of our own (FR-038).
