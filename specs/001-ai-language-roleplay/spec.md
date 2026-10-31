# Feature Specification: Embrollado – AI Language Practice Conversations

**Feature Branch**: `001-ai-language-roleplay`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description:
> Entwickle die App Embrollado:
>
> * eLearning-App (Web-based) mit AI-generierten Dialogen in einer Fremdsprache
> * App-Name: Embrollado (Partizip von embrollo, verworrene Situation)
> * Hauptidee ist ein möglichst praxisnahes/realitätsnahes Gespräch mit einer anderen Person (AI) zu führen in einer Sprache, die man üben möchte.
>   * Persona und Themenwahl (z.B. Thema: Auf dem Campingplatz im Waschhaus; Persona: Nicole, 38w, Konditorin)
>   * Idee: Bildgenerierung zu bestimmten Situationen, z.B. zum Start, Key-Points, Ende.
>   * Idee: TTS (AI)
> * ChatGPT-like
>   * mehrere Unterhaltungen/Sessions
>   * Sprache wählbar
>   * Niveau wählbar
>   * optional: Tokens live einfliegen lassen, sofern möglich (bei structured JSON vermutlich schwierig...?)
> * Ablauf:
>   1) AI gibt einen Satz/Frage vor.
>   2) User antwortet.
>   3) Urspünglicher Satz/Frage wird nachträglich zusätzlich übersetzt; ggf. mit Erläuterung. Eigene Antwort wird korrigiert und interpretiert (z.B. fehlende Worte (Platzhalter ??? bzw. Angabe Muttersprache) mit Annahmen befüllt und Gesamtinterpretation/Sprachbewertung gegeben. Erkläre-mir-Button, welcher weitere Infos zur Semantik und/oder zum Fehler abruft.
>   4) AI antwortet bzw. Cycle startet von Neuem.

## Clarifications

### Session 2026-10-28

- Q: When the app talks to the AI service that the learner configured, should the request go straight from the browser to that service, or may it go through a small helper that runs on the learner's own computer? → A: Direct browser-to-service calls only; if the service refuses browser requests, the app explains how to allow them on the service side
- Q: What should the overall assessment of the learner's answer contain? → A: A four-tier quality badge (perfect or very good, good, acceptable, unsatisfactory) shown in colour with a short label whose wording varies between turns and comes from the translation files, instead of a score
- Q: Which situations and conversation partners should the app ship with in the first release? → A: The target language is selectable from a list of the most common languages; the three levels are beginner, intermediate and expert; 13 situations and 5 partners are predefined; learners may define their own, either saved as a reusable template or given on the fly when starting a session
- Q: How long should the spoken audio and the generated pictures be kept on the learner's device? → A: The pictures are kept permanently, while only a bounded number of the most recent spoken lines per session are cached and older ones are requested again from the AI service when they are played
- Q: When the learner imports a file of conversations they exported earlier, what should happen if a conversation already exists on the device? → A: The import replaces the conversations on the device with the contents of the file; a conversation with the same identifier is overwritten and a warning is shown before the import runs; a conversation is identified by a UUID

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a practice conversation with a chosen person and situation (Priority: P1)

A learner who wants to practise a foreign language picks a target language, a proficiency level, a
situation and a conversation partner (for example: language Spanish, level intermediate, situation
"at the washroom of a camping site", partner "Nicole, 38, confectioner"). The app immediately opens
the conversation with the partner's first line, spoken in the target language, so that the learner
can start role-playing a realistic situation within a minute. The learner may also bring their own
partner or their own situation, either saved beforehand as a reusable template or written on the fly
when starting the session.

**Why this priority**: Without a configurable situation, a persona and a first line, there is no
practice at all. Every other story builds on this one, so it is the smallest slice that delivers
value on its own.

**Independent Test**: Start the app, choose language, level, situation and persona, and verify that
the partner's first line appears in the target language and matches the chosen situation and level.
No feedback features are required for this story to be considered complete.

**Acceptance Scenarios**:

1. **Given** the app is opened for the first time, **When** the learner chooses a target language,
   a level, a situation and a persona and starts, **Then** the partner's first line or question is
   shown in the target language, and the situation and partner are visible in the session header.
2. **Given** a language and level are selected, **When** the learner opens the situation catalogue,
   **Then** 13 situations and 5 partners are selectable, including a person such as "Nicole, 38,
   confectioner" together with a "washroom at a camping site" setting, and every situation can be
   combined with every partner.
3. **Given** a level of beginner, intermediate or expert, **When** the first line is generated,
   **Then** the vocabulary, sentence length and grammatical complexity correspond to that level.
4. **Given** the learner has started a session, **When** the learner switches to another situation
   and persona, **Then** a new, separate conversation is started and the previous one is preserved.
5. **Given** the learner writes their own partner or situation while starting a session,
   **When** the session begins, **Then** the partner speaks in that situation, and the entry is used
   for that session only and is not added to the catalogue.
6. **Given** the learner saves their own partner as a template, **When** the learner starts a later
   session, **Then** the saved partner is offered in the catalogue and can be used again.

---

### User Story 2 - Get feedback on my own answer (Priority: P1)

After each answer, the learner sees a corrected version of their own answer, an explanation and an
interpretation of what they actually said, the gaps that were filled with clearly labelled
assumptions, and a quality badge that rates the answer. The translation of the partner's line sits
muted under the line itself (FR-057).

**Why this priority**: Feedback is the pedagogical core of the app. A conversation without feedback
is just chatting, and without feedback the learner cannot learn from the situation.

**Independent Test**: Send one answer containing a deliberate mistake and an unknown word, and
verify that all feedback elements appear.

**Acceptance Scenarios**:

1. **Given** the partner asked a question, **When** the learner sends an answer, **Then** the app
   shows the corrected learner answer, the interpretation of the answer, any filled-in assumptions,
   and a quality badge for that turn, and the translation of the partner's question becomes visible
   under the question itself (FR-057).
2. **Given** the learner writes an unknown word as "???" or writes it in their native language,
   **When** the feedback is generated, **Then** the gap is filled with a contextually plausible
   assumption and that assumption is visibly marked as an assumption.
3. **Given** a turn that is already correct, **When** the feedback is generated, **Then** the
   correction confirms the answer and the quality badge shows the top tier, without inventing
   errors.
5. **Given** the learner writes a completely empty answer, **When** they attempt to send it,
   **Then** the app does not contact the AI service and shows an inline hint instead.

---

### User Story 3 - Review and manage my conversations (Priority: P2)

The learner can see all past conversations in one list, open any of them and read the full
transcript including all feedback, and manage the list by renaming and deleting entries. The
learner can also export all conversations to a file and import them again, so that their practice
history is never lost and never locked in.

**Why this priority**: Practice value grows with history, and a ChatGPT-like list of sessions is
what makes the app feel like a real learning tool. It is, however, not required for the first
practice loop to work.

**Independent Test**: Run two sessions with different personas, close the app, reopen it, and
verify that both sessions are listed, that a reopened session shows its complete transcript with
feedback, and that export and import reproduce the same data.

**Acceptance Scenarios**:

1. **Given** two or more completed sessions, **When** the learner opens the session list,
   **Then** each entry shows the situation, the partner, the language, the level, the date and the
   number of exchanges.
2. **Given** a stored session, **When** the learner opens it, **Then** the complete transcript is
   shown, including the partner's lines, the learner's answers, and every feedback element.
3. **Given** a session list, **When** the learner searches or filters by language, situation or a
   keyword, **Then** only matching sessions remain visible.
4. **Given** the learner deletes a session, **When** the deletion is confirmed, **Then** the
   session and its transcript are removed permanently.
5. **Given** sessions exist, **When** the learner exports them and later imports the file on a
   clean device, **Then** all sessions and their feedback are restored.

---

### User Story 4 - Keep my practice data on my own device (Priority: P2)

All conversations, settings and the AI service configuration stay on the learner's device. The app
works without a network connection for everything that does not require the AI service, and it
never sends the learner's data anywhere except to the AI service the learner configured.

**Why this priority**: The app is local-first by definition; without this, the learner's private
practice data would be stored elsewhere and the app would be unusable offline.

**Independent Test**: Disconnect the network, reload the app and browse sessions, and verify that
stored conversations are still there and readable, that only AI actions report a missing
connection, and that a network trace of a full session shows requests only to the configured AI
service.

**Acceptance Scenarios**:

1. **Given** stored sessions, **When** the device is restarted or the page is reloaded,
   **Then** all sessions, settings and the service configuration are still present.
2. **Given** no network connection, **When** the learner opens the app and reads a stored
   conversation, **Then** everything works, and only starting or continuing a dialogue reports the
   missing connection.
3. **Given** a full practice session is performed, **When** the network traffic is inspected,
   **Then** no data is sent to any destination other than the AI service configured by the learner.
4. **Given** the learner configures a new AI service address, key or model, **When** the settings
   are saved, **Then** they take effect for the next request and are not part of the shipped app.

---

### User Story 5 - Hear the partner and see the situation (Priority: P2)

The learner can have the partner's lines read aloud in the target language and can request an
illustration of the current moment of their conversation. Both the speech and the pictures are
generated by the AI service the learner configured. If that service cannot produce speech or
images, the app states this clearly and the conversation continues normally.

**Why this priority**: Both capabilities are part of the first release: spoken and visual context
are what turn a text exchange into a realistic situation. They still form a separable slice, since
the dialogue cycle, the feedback and the session history deliver their value without them.

**Independent Test**: Start a session on a service that supports speech and images and verify that
the partner's line can be played and that a picture appears after the learner requests it; repeat
on a service without those capabilities and verify the graceful fallback.

**Acceptance Scenarios**:

1. **Given** the configured AI service can produce speech, **When** the learner activates playback
   on a partner line, **Then** the line is read aloud in the target language.
2. **Given** the configured AI service cannot produce speech, **When** the learner opens the
   playback control, **Then** the app explains that the service does not support it and the
   conversation is not interrupted.
3. **Given** a session is running and an image model is configured, **When** the learner requests a
   picture, **Then** an illustration of the current moment is generated by the AI service and shown
   in the dialogue, and it remains available afterwards.
4. **Given** an illustration exists, **When** the learner views the session afterwards,
   **Then** the illustration is displayed from the learner's own device and no further image is
   loaded from a third-party address.

---

### Edge Cases

- The learner answers in the wrong language, in their native language, or mixes both: the app
  responds without blocking, shows the translation into the learner's language and points out that
  the answer was not in the target language.
- The learner's answer contains no understandable content at all: the app asks for a clarification
  instead of pretending to understand.
- The learner's answer is very long, contains emojis, quotes or characters from other alphabets:
  the answer is stored and displayed unchanged, and the feedback still refers to the actual content.
- The learner sends an empty message, only spaces or only a placeholder: no AI request is made.
- The learner taps "send" repeatedly or twice quickly: exactly one request per answer is issued and
  no duplicated turn appears.
- Two consecutive answers of the same quality show different badge wordings, such as "Good!" and
  "Well done": this is expected, the tier stays the same, and the learner is never shown two
  different tiers for one answer.
- The learner changes the language or level during an ongoing session: the change applies from the
  next partner line onwards, and the session header reflects the new setting.
- The AI service returns an incomplete, malformed or unexpected answer: the app shows a
  comprehensible error, keeps the learner's typed text and never loses the session.
- The AI service is unreachable, rejects the key, or reports a rate limit: the app shows what
  happened and how to proceed, and the learner's pending answer stays editable and sendable.
- The configured AI service refuses browser requests because of its cross-origin policy: the app
  says that the service is not allowing browser requests, points out that no intermediary is used,
  and shows how to allow the requests on the service side; the session and the typed answer stay
  intact.
- The network drops while a partner answer is being requested: the app reports the interruption and
  allows the request to be repeated without losing the turn.
- The session grows beyond dozens of exchanges: the transcript stays navigable and the app remains
  responsive.
- The learner leaves the app in the middle of a reply: after returning, the session is intact and
  the pending answer is still available.
- The learner deletes a session: the deletion is confirmed first and cannot be undone afterwards.
- The learner imports a file that contains a conversation with the same identifier as one on the
  device: the conversation from the file replaces the one on the device, and the app named the
  affected conversations in the warning before the import ran.
- The learner cancels the import after the warning: nothing on the device changes.
- The learner imports a file from an older version of the app: the app recognises the older
  format, converts it, and keeps every conversation; if it cannot read the file, it says so and
  changes nothing on the device.
- The AI service supports neither speech nor images: the core conversation, the feedback and the
  session history remain fully usable.
- The learner plays an older line whose audio is no longer cached: the app asks the AI service for
  it again, shows that it is loading, and plays it when it arrives; if the request fails, the app
  says so and leaves the text in place.
- The AI service cannot be reached and the learner plays an older line whose audio is no longer
  cached: the app says the audio cannot be fetched right now and shows the text of the line
  instead.
- The storage of the device is nearly full: the app stops caching new audio, tells the learner, and
  keeps every picture and transcript.
- The learner lowers the number of cached spoken lines: the app applies the smaller number from
  that moment on and keeps the sessions and pictures that are already stored.
- The learner has not configured an AI service yet: the app explains how to do this and does not
  fail with a technical error.
- The learner switches the interface language in the middle of a session: the new language applies
  to the app's own texts and to the feedback of the following turns, while the turns already stored
  keep the language they were written in.
- The learner sets a native language that differs from the interface language: the translation, the
  explanation and the badge label are given in the native language, the interface stays in the
  interface language, and the corrected answer stays in the target language.
- The learner edits or deletes a partner or situation that they saved as a template: the sessions
  that were practised with it stay readable and still show the partner and situation as they were
  at the time, because each session keeps its own copy of those details.
- The learner names a partner or situation the same as an existing one: the app keeps both entries
  apart, and the one used in a session is always the one shown in the session header.
- The service delivers the partner's line only in parts and then fails halfway: the app keeps the
  text already shown, does not repeat it, and offers to repeat the request.
- The learner has stored a name and personal details but did not enable "The AI partner already
  knows you": the partner starts the talk without knowing the learner and does not address them by
  name until the learner offers it.
- The learner is at a phone-call situation: the partner perceives only what it can hear (voice,
  approximate age, gender) and never mentions the learner's appearance.
- The learner's profile has no perceivable traits at all: the partner relies on the situation and
  on what the learner reveals, and never invents an appearance.

## Requirements *(mandatory)*

### Functional Requirements

**Session setup**

- **FR-001**: The learner MUST be able to start a practice session by selecting a target language, a
  proficiency level, a situation and a conversation partner before the first partner line is shown.
- **FR-002**: The system MUST offer a selectable list of the most common target languages and
  exactly three proficiency levels, named beginner, intermediate and expert, where each level
  carries a short, plain-language description of what it means.
- **FR-003**: The system MUST offer a catalogue of 13 situations and 5 conversation partners, each
  situation with a setting description and each partner with a name, an age and an occupation, and
  the catalogue MUST allow browsing and searching by keyword.
- **FR-004**: The catalogue MUST be available without a network connection, so that a learner can
  start a session while offline as far as the situation and partner selection are concerned.
- **FR-005**: The system MUST show the chosen situation, partner, language and level in the session
  header of a running session.
- **FR-059**: The AI partner MUST only know about the learner what is perceivable (aspect, voice,
  approximate age, gender), what the situation establishes, or what the learner reveals during the
  conversation. The partner MUST NOT use a name or a personal detail the learner has not offered
  and MUST NOT invent any fact about the learner to fill the gaps.
- **FR-060**: The learner MUST be able to enable, per session and when starting a conversation, an
  option that the AI partner already knows them from the start (default off). Enabled, the partner
  receives the stored name and personal details from the first line on.

**Dialogue cycle**

- **FR-006**: The partner MUST open the conversation with a single line or question in the target
  language that fits the chosen situation, partner and level.
- **FR-007**: The learner MUST be able to type an answer in the target language and send it, and the
  send control MUST be reachable on a phone-sized screen.
- **FR-008**: After each answer, the system MUST show, in one place: an optional explanation of the
  learner's answer, a corrected version of the learner's answer, an interpretation of the learner's
  answer, the gaps that were filled with assumptions, and a quality badge that rates the answer.
- **FR-009**: Where the learner's answer contains an explicit gap marker (`???`) or a word given in
  the learner's native language, the system MUST fill the gap with a plausible, context-appropriate
  assumption and MUST visibly mark that text as an assumption. The app only shows an assumption
  when the answer contained `???` or the reported original is a single word that differs from the
  fill — a phrase the learner wrote in the target language is never shown as a gap.
- **FR-010**: *(removed in this iteration — owner decision. The `explanation` field already covers
  the learner's answer per turn, so the on-demand "Explain to me" action has been removed along
  with its button and its separate request.)*
- **FR-011**: The partner MUST react to the learner's answer and continue the conversation, and the
  cycle MUST repeat until the learner ends the session.
- **FR-012**: The partner's language MUST stay in the target language and MUST respect the selected
  level in vocabulary, sentence length and grammatical complexity.
- **FR-013**: The correction, the interpretation and the quality badge of the learner's answer MUST
  take the selected level into account.
- **FR-014**: The system MUST present the feedback for a turn in a fixed, predictable order so that
  the learner always knows where to look for the correction and the quality badge.

**Sessions and history**

- **FR-015**: The system MUST keep every session with its situation, partner, language, level, date,
  number of exchanges and complete transcript, and MUST make it available after a reload or a
  device restart.
- **FR-016**: The learner MUST be able to list all sessions, open any of them and read the complete
  transcript including all feedback. The list MUST be ordered by the last activity — the newest of
  the last turn, the last update and the creation — with the most recent conversation first.
- **FR-017**: The learner MUST be able to search and filter the session list by language, situation
  and keyword. The filtered list MUST keep the order of FR-016.
- **FR-018**: The learner MUST be able to rename and delete sessions; deleting a session MUST ask
  for confirmation and MUST be permanent.
- **FR-019**: The learner MUST be able to export all sessions with their feedback to a portable
  file, and MUST be able to import such a file again, including on another device.
- **FR-020**: The session list MUST NOT require a network connection.

**AI service configuration**

- **FR-021**: The learner MUST be able to enter and later change the address, the credentials and
  the model of the AI service, and the app MUST work with any OpenAI-compatible service.
- **FR-022**: The configured address, credentials and model MUST be stored only on the learner's
  device and MUST NOT be part of the shipped application or any default configuration.
- **FR-023**: The system MUST NOT send any request to the AI service that the learner has not
  explicitly triggered through a dialogue action.
- **FR-024**: If the AI service is unreachable, rejects the credentials or reports a rate limit,
  the system MUST show a comprehensible message with a way forward, MUST keep the learner's typed
  text, and MUST NOT lose stored sessions.
- **FR-025**: If the AI service returns an answer that does not match the expected content, the
  system MUST show a comprehensible error instead of displaying the answer as if it were valid
  feedback.

**Speech and illustration**

- **FR-026**: The learner MUST be able to have the partner's lines read aloud in the target
  language, and the spoken audio MUST be produced by the configured AI service.
- **FR-027**: If the configured AI service cannot produce speech, the app MUST state this clearly
  and MUST NOT interrupt or block the conversation.
- **FR-028**: The system MUST let the learner generate an illustration of the current moment on
  explicit request (a button beside the composer input). The picture MUST be produced by the
  configured AI service and MUST reflect the situation, the people involved (including the
  learner's profile from Settings) and the conversation so far. Only the configured image model
  decides whether the button is offered at all.
- **FR-029**: Illustrations MUST be kept on the learner's own device and MUST NOT be loaded from a
  third-party address when displayed. Spoken audio MUST be cached on the device for a bounded number
  of the most recent lines of a session, and older lines MUST be requested again from the
  configured AI service when the learner plays them. Such a request MUST go to the configured AI
  service only, and to no other address.
- **FR-030**: If the AI service cannot produce images, the app MUST continue without illustrations
  and MUST NOT show an error that interrupts the conversation.

**Presentation and privacy**

- **FR-031**: The whole app MUST be usable on a screen that is 320 pixels wide, MUST NOT require
  horizontal scrolling for primary content, and MUST offer interactive controls of at least
  44 by 44 pixels that work without hover and without a physical keyboard.
- **FR-032**: The app MUST NOT contain analytics, tracking or crash reporting, and MUST NOT transmit
  the learner's data to any destination other than the configured AI service.
- **FR-033**: The interface MUST be available in English and German, the learner MUST be able to
  switch between them at any time, and the choice MUST apply to every screen and every message of
  the app.
- **FR-034**: The learner MUST be able to set a separate native language for the feedback; while
  it is not set, the app MUST use the interface language as the native language.
- **FR-035**: The delivery of a partner's turn MUST show the partner's line progressively while it
  is being generated, and the feedback for the turn MUST appear as one complete block afterwards.
  If the service cannot deliver the line in parts, the app MUST fall back to showing the complete
  turn at once, without duplicated or incomplete text.
- **FR-036**: The translation of the partner's line, the explanation of the learner's answer, the
  interpretation, the filled-in assumptions and the quality badge MUST be delivered in the
  learner's native language, while the corrected version of the learner's answer MUST remain in
  the target language.
- **FR-061**: The explanation of the learner's answer, the issues and the reasons of the
  filled-in assumptions MUST be written as an objective note that addresses the learner directly
  ("your answer", "you say") and MUST NOT describe the partner's reactions in the partner's
  first person or report the partner's own feelings or opinions; references to the partner use
  the third person ("that she had warned you beforehand", never "you had warned me"). The
  interpretation keeps the learner's own voice and the translation keeps the partner's voice —
  the rule does not apply to these two fields. The opening turn has no learner answer and
  therefore no explanation.
- **FR-057**: The translation of a partner line MUST arrive with the same request as the line itself
  and MUST be shown muted directly under the line in the learner's native language. While the line
  is still open it MUST be hidden by default; the learner MUST be able to reveal or hide it per
  line with a toggle ("peek"), and once the learner has sent an answer to the line the translation
  MUST become visible immediately so the learner can check their reading.
- **FR-037**: The first release MUST include the AI-generated speech output and the AI-generated
  illustrations described in FR-026 to FR-030.

**Cross-origin access to the AI service**

- **FR-038**: Every request to the AI service MUST go directly from the learner's browser to the
  configured address. The app MUST NOT route requests through an intermediary, a relay, or a
  service of its own.
- **FR-039**: If the configured service refuses a request because it does not allow requests from
  the learner's browser, the app MUST report the refusal as such and MUST show guidance on how to
  allow the requests on the service side.

**Quality badge**

- **FR-040**: Every rated answer MUST show a quality badge that places the answer in exactly one
  of four tiers: perfect or very good, good, acceptable, and unsatisfactory.
- **FR-041**: Each tier MUST be shown with a distinct colour and a short label, and the label MUST
  be taken from the wording variants held in the translation files for the learner's language.
- **FR-042**: Each tier MUST offer several wording variants, and the app MUST be able to show a
  different wording than in the previous turn without changing the tier.
- **FR-043**: The tier MUST be derived from the correctness and the quality of the answer relative
  to the selected level, and MUST NOT be expressed as a numeric score.
- **FR-058**: When no rating can be determined (the model omitted or malformed the badge), the app
  MUST show a grey `unknown` assessment — it MUST NOT invent a rating. `unknown` is an app-side
  state, never a tier the model returns.

**Catalogue content and learner-defined entries**

- **FR-044**: Each of the 13 predefined situations MUST be usable with each of the 5 predefined
  partners. The catalogue MUST NOT restrict which situation and partner can be combined.
- **FR-045**: The learner MUST be able to create their own partner and their own situation and
  save them as a template, and a saved template MUST stay available for later sessions.
- **FR-046**: The learner MUST be able to give a partner or a situation directly when starting a
  session without saving it. Such an entry MUST NOT be stored as a template and MAY only live for
  the current browser tab: it remains available after a reload but is gone once the tab closes.
- **FR-047**: The learner MUST be able to edit (including renaming) and delete their own saved
  templates, and editing or deleting a template MUST NOT delete or rewrite the sessions that were
  practised with it.
- **FR-048**: A learner-defined partner MUST have at least a name, and a learner-defined situation
  MUST have at least a short description. The app MUST say what is missing when either is
  incomplete.
- **FR-049**: Learner-defined entries MUST be stored on the learner's own device only and MUST NOT
  be uploaded anywhere.

**Keeping speech and illustrations**

- **FR-050**: The number of spoken lines cached per session MUST default to the 20 most recent
  lines, and the learner MUST be able to change that number in the settings. A smaller number MUST
  take effect straight away and MUST NOT damage the sessions already stored.
- **FR-051**: When the storage of the device is nearly full, the app MUST stop caching new audio
  and MUST tell the learner. It MUST NOT delete pictures or transcripts to make room, and it MUST
  NOT lose the session that is currently running.
- **FR-052**: Pictures MUST be kept for as long as the session exists and MUST survive a device
  restart.

**Import and export**

- **FR-053**: Every session MUST be identified by a UUID that is unique on the device. The same
  identifier MUST be written to the exported file and MUST be used again when the session is
  imported, so that a session keeps its identity across devices.
- **FR-054**: An imported file MUST replace the conversations stored on the device with the
  conversations contained in the file. A conversation in the file that carries the same identifier
  as one on the device MUST overwrite that conversation.
- **FR-055**: Before an import is carried out, the app MUST warn the learner that the conversations
  on the device will be replaced, naming how many conversations are affected, and MUST only carry
  out the import after the learner confirms.
- **FR-056**: The exported file MUST carry a format version. When the learner imports a file from
  an older version of the app, the app MUST recognise it and convert it; if the file cannot be
  read, the app MUST say so and MUST leave the conversations on the device untouched.

**Scope boundaries for the first release**

- Out of scope: pronunciation scoring or phonetic ratings, flashcards and spaced repetition,
  accounts and cross-device synchronisation, teacher or classroom management, a catalogue that is
  fetched from a server, any analysis of the learner's progress across sessions beyond the
  per-turn quality badge, and any proxy, relay or backend of our own for reaching the AI service.
- In scope: the dialogue cycle with per-turn feedback, the situation and partner catalogue, session
  management with export and import, the configuration of the AI service, the English and German
  interface with a separate native-language setting, the AI-generated speech output for the
  partner's lines, and the AI-generated illustrations of the current moment, produced on the
  learner's request.

### Key Entities

- **Session**: A single practice conversation. Attributes: identifier (a UUID that is unique on the
  device and is kept in the exported file), title, target language, proficiency level, situation,
  partner, a snapshot of the situation and partner as they were described when the session started,
  creation and last activity date, number of exchanges, state (active or ended).
- **Turn**: One cycle step of a session. Attributes: position in the session, partner line, the
  learner's answer, translation of the partner line, explanation of the learner's answer, corrected
  learner answer, interpretation of the learner's answer, filled-in assumptions with their markers,
  and quality badge.
- **Quality badge**: The rating shown for a learner's answer. Attributes: tier (perfect or very
  good, good, acceptable, or unsatisfactory), the tier's colour, and the label wording shown to the
  learner. The label wordings are variants held in the translation files, for example "Very good!",
  "Good!", "Acceptable", "Not quite" or "What?".
- **Persona (conversation partner)**: A character the learner talks to. Attributes: name, age,
  gender, occupation, short description, the situations the person belongs to, and whether the
  person is predefined or defined by the learner, and whether the learner saved it as a template or
  used it for one session only.
- **Situation**: A scenario the conversation takes place in. Attributes: name, setting description,
  key moments, the personas available for it, and whether the situation is predefined or defined by
  the learner, and whether the learner saved it as a template or used it for one session only.
- **Learner profile and settings**: The learner's configuration. Attributes: target language,
  proficiency level, native language, the address, credentials and model of the AI service, the
  settings for speech and illustrations, and the number of spoken lines kept in the local cache.
- **Illustration**: A generated picture of the current moment of a conversation, produced on the
  learner's request. Attributes: referenced session and turn, the moment it depicts, and the
  locally stored asset, which is kept as long as the session exists.
- **Explanation**: The coaching note on the learner's latest answer, delivered with the turn. It
  says what the answer expresses, how well it fits the situation and what to correct, written in
  the learner's native language as an objective note that addresses the learner directly — never
  in the partner's first person (FR-008, FR-061).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can go from opening the app to seeing the partner's first line in at most
  4 selections and 60 seconds.
- **SC-002**: At least 90% of first-time test users complete an exchange of 10 or more turns in one
  sitting without leaving the dialogue view on a phone-sized screen.
- **SC-003**: 100% of turns that the learner sends receive a translation, a correction, an
  interpretation, a list of filled-in assumptions and a quality badge in one of the four tiers.
- **SC-004**: The complete feedback for a turn is visible within 10 seconds of sending an answer in
  at least 95% of turns under normal network conditions.
- **SC-005**: Every session opened after a device restart shows the full transcript including all
  feedback, in 100% of cases.
- **SC-006**: *(removed with FR-010 — the "Explain to me" action no longer exists.)*
- **SC-007**: In a full practice session, a network trace shows no request to any destination other
  than the configured AI service, and every request reaches that address directly, without any
  intermediary.
- **SC-008**: With the network disconnected, all functions that do not require the AI service
  (session list, transcript, settings, export) remain fully usable.
- **SC-009**: On a 320-pixel-wide screen, the primary flow is usable without horizontal scrolling
  and every interactive control is at least 44 by 44 pixels.
- **SC-010**: At least 80% of test users find a previously started session and resume reading it
  within 30 seconds.
- **SC-011**: At least 75% of test users rate the situation and partner choice as feeling
  "realistic" rather than artificial.
- **SC-012**: In at least 90% of turns, the first words of the partner's line are visible within 2
  seconds of sending an answer, and the progressively displayed text matches the final turn in
  100% of cases.
- **SC-013**: On a service that supports the AI-generated speech and illustrations, at least 95% of
  partner lines can be played back in the target language, and every session shows at least one
  illustration for its situation.
- **SC-014**: All interface texts and all feedback are shown in the language the learner selected,
  in English or German, with the native-language setting applied where the learner has set it, in
  100% of cases.
- **SC-015**: Every rated turn shows exactly one of the four tiers with its own colour and a label
  taken from the translation files, in 100% of cases, and consecutive turns of the same tier may
  show different wordings without being rated differently.
- **SC-016**: The first release offers 13 situations and 5 partners, and every situation can be
  combined with every partner, in 100% of combinations.
- **SC-017**: A partner or situation that the learner saved as a template is still offered after a
  device restart and can be used in a later session, in 100% of cases, and a partner or situation
  given on the fly is never stored as a template and is gone as soon as the browser tab is closed.
- **SC-018**: After practising in 50 sessions, the app still starts, lists and opens every one of
  them, and the stored transcripts and pictures are intact, in 100% of cases.
- **SC-019**: Playing an older line whose audio is no longer cached fetches it again from the AI
  service and plays it, in at least 95% of cases with the service reachable, and the text of the
  line stays visible in the meantime.
- **SC-020**: An import replaces the conversations on the device with the conversations of the
  file, a conversation with the same identifier is overwritten, and the app warned before anything
  changed, in 100% of imports.
- **SC-021**: A file exported on one device and imported on another reproduces every conversation
  with all of its feedback and keeps the same identifiers, in 100% of cases.
- **SC-022**: A learner can edit (including renaming) and delete their own template; the sessions
  practised with it stay readable and keep the situation and partner as they were at the time, in
  100% of cases.

## Assumptions

- The app is used by a single learner per device, without accounts, without a server and without
  synchronisation between devices. All data lives in the learner's browser.
- The interface of the first release is available in English and German. The learner's native
  language is a separate setting that falls back to the interface language when it is not set; the
  language being practised is always a separate, selectable choice.
- The AI service is an OpenAI-compatible service that the learner configures themselves. The app
  does not ship with a service, a key or a model.
- The app contains no server component and no intermediary of any kind. Every request goes
  directly from the browser to the configured address, so the service must allow requests from the
  learner's browser; a service that refuses them cannot be used with the app.
- The service must be able to return the content the dialogue cycle needs. Where a service cannot
  guarantee a structured answer, the app asks for the required pieces in plain text and is
  tolerant about their order.
- Speech output and illustrations are part of the first release and are produced by the same
  configured AI service, never by another provider. They are optional at runtime in the sense that
  the app continues without them when the service does not support them; the core dialogue, the
  feedback and the session history never depend on them.
- Pictures are kept on the device as long as the session exists. Spoken lines are cached for the 20
  most recent lines of a session by default; older lines are requested again from the AI service
  when the learner plays them, which costs the learner a request but keeps the storage small.
- The partner's line is displayed progressively while it is being generated, and the feedback for
  the turn arrives as one block afterwards. Where the service cannot deliver partial text, the app
  falls back to the complete turn at once, and the interface always shows a visible progress
  indication while a request is running.
- The quality badge is based on semantics, grammar and vocabulary. A rating of the learner's
  pronunciation is a later feature and is not part of the first release.
- The situation and partner catalogue is part of the shipped app and is maintained with it, so that
  it is available offline and requires no external service. The first release ships 13 situations
  and 5 partners, which can be combined freely, and the target-language list covers the most
  commonly spoken languages, for example English, German, French, Spanish, Italian, Portuguese,
  Dutch, Polish, Turkish, Russian, Japanese and Chinese.
- The three proficiency levels are beginner, intermediate and expert.
- The learner may mark a word they cannot express with `???` or by writing it in their native
  language; both are treated as an explicit gap to be filled with a labelled assumption.
- The export format is a JSON file that carries a format version, and every session keeps the same
  UUID for its whole life, on every device it is carried to.
- The feature branch for this work is `001-ai-language-roleplay`.
