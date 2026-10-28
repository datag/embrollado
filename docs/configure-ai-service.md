# Configure the AI service

Embrollado talks to any OpenAI-compatible service. Everything below happens in
**Settings → AI service**.

## The four common fields

| Field                | Meaning                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service address**  | Absolute http(s) URL including the version prefix. `https://api.openai.com/v1`, `https://openrouter.ai/api/v1`, `http://localhost:11434/v1`, …                                                          |
| **API key**          | Stored locally only; sent nowhere except your service; never exported or logged.                                                                                                                        |
| **Auth style**       | `Bearer` (default), `x-api-key`, or `api-key` (Azure-style).                                                                                                                                            |
| **Provider profile** | Picked automatically from the address; override when your server differs. It selects the auth style default, where the structured-output schema goes, the speech `response_format` and the images path. |
| **Chat model**       | The model used for every turn and for "Explain to me".                                                                                                                                                  |
| **Speech model**     | Optional — empty hides the playback button.                                                                                                                                                             |
| **Image model**      | Optional — empty disables the situation illustrations.                                                                                                                                                  |

## Provider notes

| Provider   | Profile      | Notes                                                                                                                                                                     |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI     | `openai`     | Works out of the box from a browser. Speech: `mp3`. Images: `/images/generations`.                                                                                        |
| OpenRouter | `openrouter` | Works out of the box from a browser. Speech format `pcm`, images at `/images`. OpenRouter may answer errors with HTTP 200 — Embrollado handles that.                      |
| Ollama     | `ollama`     | **Cross-origin must be enabled**: `OLLAMA_ORIGINS="http://localhost:5173" ollama serve` (or `ollama origin add <origin>`). The key field is required but any value works. |
| llama.cpp  | `llamacpp`   | Start with `llama-server --cors-origins "http://localhost:5173"`. The profile also sends the schema as a sibling of `type`, which llama.cpp documents. No speech/images.  |
| vLLM       | `vllm`       | **`--allowed-origins` is empty by default since v0.32**: `vllm serve <model> --allowed-origins '["http://localhost:5173"]'`.                                              |
| LM Studio  | `lmstudio`   | No documented CORS flag (verified: none found). If the connection test reports a cross-origin issue, check LM Studio's server settings.                                   |

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

## Structured output

Every turn is requested as a strict JSON document (`response_format: json_schema`). If a server
rejects the schema (HTTP 400), Embrollado retries once with `json_object` and the schema embedded
in the prompt, then parses leniently. Models that support `json_schema` earn noticeably more
reliable feedback.
