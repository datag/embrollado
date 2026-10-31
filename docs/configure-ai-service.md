# Configure the AI service

Embrollado talks to any OpenAI-compatible service. Everything below happens in
**Settings → AI service**.

## The fields

| Field                | Meaning                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider profile** | Selects the endpoint behaviour: auth style default, where the structured-output schema goes, the speech `response_format` and the images path. Picking a profile pre-fills the service address with the provider's standard URL (only while the address is still empty or was auto-filled — a manually entered address is never overwritten). |
| **Auth style**       | `Bearer` (default), `x-api-key`, or `api-key` (Azure-style). A manually chosen style survives a profile switch.                                                                                                                                                                                                                               |
| **Service address**  | Absolute http(s) URL including the version prefix. `https://api.openai.com/v1`, `https://openrouter.ai/api/v1`, `http://localhost:11434/v1`, … When you type an address that matches another profile, a hint below the field offers to switch the profile — it is never applied automatically.                                                |
| **API key**          | Stored locally only; sent nowhere except your service; never exported or logged.                                                                                                                                                                                                                                                              |
| **Chat model**       | The model used for every turn.                                                                                                                                                                                                                                                                                                                |
| **Speech model**     | Optional — empty hides the playback button.                                                                                                                                                                                                                                                                                                   |
| **Voice (TTS)**      | Optional — the voice for your speech model. Voices are model-specific (OpenAI: `alloy`…; Gemini TTS: `Kore`, `Zephyr`, …; Mistral TTS: `en_paul_neutral`, …); empty uses the profile default. A voice your model does not know is the most common cause of an HTTP 400 ("Provider returned 400").                                             |
| **Image model**      | Optional — empty hides the picture button beside the input box. The button only appears when the provider profile supports images (OpenAI/OpenRouter/Custom). Pressing it narrates the current moment with the chat model — situation, partner, your profile and the conversation so far — and then asks the image model to render it.        |

## Provider notes

| Provider   | Profile      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI     | `openai`     | Works out of the box from a browser. Speech: `mp3`. Images: `/images/generations`.                                                                                                                                                                                                                                                                                                                                                                           |
| OpenRouter | `openrouter` | Works out of the box from a browser. Speech is requested as `pcm` (OpenRouter's default and the **only** format Gemini TTS / HeyGen Voice accept; MiniMax only accepts `mp3` — Embrollado retries with the alternative format once on a 400). Raw `pcm` is wrapped into a WAV container client-side so it plays in the browser. Voices must match your TTS model. Images at `/images`. OpenRouter may answer errors with HTTP 200 — Embrollado handles that. |
| Ollama     | `ollama`     | **Cross-origin must be enabled**: `OLLAMA_ORIGINS="http://localhost:5173" ollama serve` (or `ollama origin add <origin>`). The key field is required but any value works.                                                                                                                                                                                                                                                                                    |
| llama.cpp  | `llamacpp`   | Start with `llama-server --cors-origins "http://localhost:5173"`. The profile also sends the schema as a sibling of `type`, which llama.cpp documents. No speech/images.                                                                                                                                                                                                                                                                                     |
| vLLM       | `vllm`       | **`--allowed-origins` is empty by default since v0.32**: `vllm serve <model> --allowed-origins '["http://localhost:5173"]'`.                                                                                                                                                                                                                                                                                                                                 |
| LM Studio  | `lmstudio`   | No documented CORS flag (verified: none found). If the connection test reports a cross-origin issue, check LM Studio's server settings.                                                                                                                                                                                                                                                                                                                      |

When a request fails because the service did not allow the browser origin, Embrollado shows the
matching flag for the selected profile (spec FR-039).

## How the connection test works

"Test the connection" sends **one minimal chat request** (`{"reply":"ok"}`) and reports:

- **Connected** — the service accepted the key and answered.
- **The service rejected the key** — HTTP 401/403.
- **The service is rate limiting** — HTTP 429.
- **The service did not allow the request from the browser** — a `fetch` `TypeError` (CORS or
  offline); the hint for the selected provider is shown.

The test is the only automatic request Embrollado ever makes, and it only runs when you press the
button.

## Fetching model suggestions

"Fetch models" sends **one** `GET {baseUrl}/models` and fills three suggestion lists — one under
the chat, speech and image fields. Tapping a suggestion applies it to that field; you can always
type any name instead. The classification is a suggestion, not a promise, and every list is sorted
naturally (`3.8` before `3.10`, `gpt-4` before `gpt-10`):

- **OpenRouter** declares capabilities per model and is asked for **all** output modalities
  (`?output_modalities=all`) — the default listing would hide every TTS model, because they declare
  `"speech"` rather than `"audio"` (which is chat-with-audio-output, not text-to-speech). Models
  with `speech` output go to speech, `image` output to image, `text` output to chat, and anything
  else (embeddings, rerank, video, transcription, …) is dropped — it cannot be used here.
- **OpenAI, Ollama, Custom** declare nothing, so the split is by name: names containing
  `tts`/`speech`/`voice` go to speech (never `whisper`/`transcribe`, those are speech-to-text),
  names containing `image`/`dall-e`/`flux`/`imagen`/`sdxl` go to image.
- **llama.cpp, vLLM, LM Studio** serve chat models only — speech and image stay empty, because
  these servers have no `/audio/speech` or `/images` endpoint at all.

The fetch is the only automatic request besides the connection test; Embrollado never probes
`/audio/speech` or `/images` on its own.

## Structured output

Every turn is requested as a strict JSON document (`response_format: json_schema`). If a server
rejects the schema (HTTP 400), Embrollado retries once with `json_object` and the schema embedded
in the prompt, then parses leniently. Models that support `json_schema` earn noticeably more
reliable feedback.
