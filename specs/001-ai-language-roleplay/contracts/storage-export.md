# Contract: Local Storage and Export / Import

**Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Model**: [../data-model.md](../data-model.md)

Covers FR-019, FR-029, FR-050, FR-051, FR-053…FR-056 and Principle II of the constitution.

---

## 1. Where things live

```text
IndexedDB  "embrollado"   → embrollado:sessions, embrollado:turns,
                             embrollado:illustrations, embrollado:audio, embrollado:meta
localStorage               → embrollado.settings.v1, embrollado.service.v1
```

Every name is prefixed with the app name (owner requirement). `localStorage` holds only the two
small documents below; all transcripts, pictures and cached audio live in IndexedDB, because
`localStorage` is synchronous and capped around 5 MiB per origin.

**Never stored anywhere else.** No telemetry, no analytics, no crash reporting, no server (FR-032).

## 2. The settings document (`embrollado.settings.v1`)

```json
{
  "schema": 1,
  "data": {
    "interfaceLanguage": "en",
    "nativeLanguage": null,
    "theme": "auto",
    "speechEnabled": true,
    "illustrationsEnabled": true,
    "cachedSpeechLines": 20,
    "learnerName": "",
    "learnerDetails": ""
  }
}
```

Read path: parse → if `schema` is lower than the current one, run the migration → if it is
**higher**, ignore the document and use the defaults (forward compatibility) → write the migrated
value back. The version lives both in the key suffix and in the payload.

## 3. The service document (`embrollado.service.v1`)

```json
{
  "schema": 1,
  "data": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-…",
    "authMode": "bearer",
    "chatModel": "gpt-4o-mini",
    "speechModel": null,
    "imageModel": null,
    "providerProfile": "openai"
  }
}
```

**This document is never part of an export.** The API key and the endpoint are the learner's
credentials and travel nowhere (FR-022, FR-032).

## 4. Export file format

A single JSON file, UTF-8, named `embrollado-export-YYYY-MM-DD-HHmm.json`.

```json
{
  "format": "embrollado.export",
  "version": 1,
  "exportedAt": "2026-10-28T14:05:00.000Z",
  "app": { "name": "embrollado", "schema": 1 },
  "sessions": [
    {
      "id": "5f2c9d6e-…",
      "schema": 1,
      "title": "Waschraum auf dem Campingplatz",
      "language": "es",
      "level": "intermediate",
      "situation": { "id": "builtin:campsite-washroom", "name": "…", "setting": "…", "custom": false },
      "partner":   { "id": "builtin:nicole", "name": "Nicole", "age": 38, "occupation": "Konditorin", "custom": false },
      "learnerName": "Sam",
      "state": "ended",
      "createdAt": "2026-10-28T13:40:00.000Z",
      "updatedAt": "2026-10-28T14:04:00.000Z",
      "turns": [
        {
          "position": 1,
          "partnerText": "…",
          "translation": "…",
          "explanation": null,
          "learnerText": "…",
          "correctedText": "…",
          "interpretation": "…",
          "assumptions": [{ "original": "???", "filled": "…", "reason": "…" }],
          "badge": { "tier": "good", "label": "Good!" },
          "issues": [{ "category": "grammar", "detail": "…", "suggestion": null }],
          "feedbackLanguage": "en",
          "createdAt": "…"
        }
      ]
    }
  ]
}
```

Rules:

- `format` and `version` are the format's own version, independent of the IndexedDB schema
  version and of the settings schema version.
- The **badge label is stored with the turn** so a transcript keeps the wording the learner saw,
  even after the translation files change (FR-042).
- **Pictures are excluded** from the default export (base64 inflates the file by 4/3). A separate
  "export with pictures" option adds an `images` array of `{ id, sessionId, turnId, moment, mimeType, bytes }`.
- **Cached audio is never exported** — it is a cache, and old lines are refetched on demand
  (FR-029, FR-050).
- The **learner's settings and service configuration are not exported** either; an import restores
  the conversations, not the credentials.
- The file is assembled from **chunked `BlobPart`s** (one `JSON.stringify` per session), so the
  whole export is never one giant string in memory.

## 5. Import

1. The learner picks a file (`<input type="file" accept="application/json,.json">`).
2. The app checks the **size** first (reject above 250 MB) and reads it with `file.text()`.
3. It validates: parseable JSON → `format === "embrollado.export"` → `version` is an integer ≥ 1
   → `sessions` is an array → every session has a string `id`.
4. It **migrates** the document through the migration chain up to the current version.
5. It shows the **warning**: how many conversations on the device will be replaced or overwritten,
   naming the ones whose identifier already exists. The import runs only after the learner
   confirms (FR-055).
6. It replaces the device's conversations in **one transaction** over the sessions, turns,
   illustrations and audio stores (FR-054). A conversation in the file with the same UUID
   overwrites the one on the device.
7. If the file's `version` is **higher** than the app supports, the import is refused and nothing
   on the device changes (FR-056).

A failed validation changes nothing — there is no partial import.

## 6. Migrations

```ts
const migrations: Record<number, (doc: ExportDoc) => ExportDoc> = {
  // 1 → 2: add "learnerName" to every session
};
```

Rules:

- Migrations run in ascending order from the file's version to the current one.
- Every migration is a pure function and is covered by a unit test that feeds it a v1 fixture.
- A version that is newer than the app supports is refused, never guessed.
- The same pattern applies to the settings document (`schema` inside the payload) and to the
  IndexedDB schema (`onupgradeneeded` → `oldVersion`/`newVersion`).

## 7. Download and upload

```ts
// Download
const url = URL.createObjectURL(blob);
const a = Object.assign(document.createElement("a"), {
  href: url,
  download: `embrollado-export-${stamp()}.json`,
});
a.click();
setTimeout(() => URL.revokeObjectURL(revocationDelay), 0);
```

- The file name contains no `:` (Windows).
- The object URL is revoked on a later task, not synchronously, so the download is not cancelled.

The Share action is a menu with three entries:

| Entry | Availability |
|---|---|
| **Download file** | always |
| **Import file** | always |
| **Share to another app** | only when `navigator.canShare({ files: [file] })` is true |

The share entry is built from the **same** export blob, so "share" and "download" always produce
the same file. Web Share needs a user gesture and a secure context; it is never the only path.

## 8. Storage pressure

| Situation | Behaviour |
|---|---|
| `QuotaExceededError` on a write | Prune the oldest cached audio, retry once; if it still fails, keep the picture out of the cache and tell the learner — never delete a transcript or a picture (FR-051) |
| `navigator.storage.estimate()` reports little headroom | Warn in Settings before the next picture is generated |
| `navigator.storage.persist()` denied | Nothing breaks; the app simply stays on best-effort storage. The learner can be told that the browser may clear the data |
| The browser evicts the origin's data | Nothing the app can do — this is why the export exists |

## 9. What the app must never do

- Store anything outside the two stores and the two keys above.
- Send a session, a picture or the API key to any origin other than the configured AI service.
- Export the API key, the endpoint or the settings.
- Delete a transcript or a picture to free space.
