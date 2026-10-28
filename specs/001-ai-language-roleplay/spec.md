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

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a practice conversation with a chosen person and situation (Priority: P1)

A learner who wants to practise a foreign language picks a target language, a proficiency level, a
situation and a conversation partner (for example: language Spanish, level intermediate, situation
"at the washroom of a camping site", partner "Nicole, 38, confectioner"). The app immediately opens
the conversation with the partner's first line, spoken in the target language, so that the learner
can start role-playing a realistic situation within a minute.

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
   **Then** at least one situation with a person such as "Nicole, 38, confectioner" is selectable
   together with a "washroom at a camping site" setting.
3. **Given** a level of beginner, intermediate or advanced, **When** the first line is generated,
   **Then** the vocabulary, sentence length and grammatical complexity correspond to that level.
4. **Given** the learner has started a session, **When** the learner switches to another situation
   and persona, **Then** a new, separate conversation is started and the previous one is preserved.

---

### User Story 2 - Get feedback on my own answer (Priority: P1)

After each answer, the learner sees a translation of the partner's preceding line, a corrected
version of their own answer, an interpretation of what they actually said, the gaps that were
filled with clearly labelled assumptions, and an overall assessment of their language. A single
"Explain to me" action gives additional information about the semantics of the phrase or about the
specific mistake.

**Why this priority**: Feedback is the pedagogical core of the app. A conversation without feedback
is just chatting, and without feedback the learner cannot learn from the situation.

**Independent Test**: Send one answer containing a deliberate mistake and an unknown word, and
verify that all five feedback elements appear and that the "Explain to me" action returns further
information.

**Acceptance Scenarios**:

1. **Given** the partner asked a question, **When** the learner sends an answer, **Then** the app
   shows the translation of the partner's question, the corrected learner answer, the interpretation
   of the answer, any filled-in assumptions, and an overall language assessment for that turn.
2. **Given** the learner writes an unknown word as "???" or writes it in their native language,
   **When** the feedback is generated, **Then** the gap is filled with a contextually plausible
   assumption and that assumption is visibly marked as an assumption.
3. **Given** a completed turn with feedback, **When** the learner activates "Explain to me",
   **Then** additional information about the meaning of the phrase or about the specific error is
   shown without losing the existing feedback.
4. **Given** a turn that is already correct, **When** the feedback is generated, **Then** the
   correction confirms the answer and the assessment reports the answer as correct, without
   inventing errors.
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

### User Story 5 - Hear the partner and see the situation (Priority: P3)

The learner can have the partner's lines read aloud in the target language and can see an
illustration of the current situation, for example at the start of the session, at a key moment and
at the end. If the configured AI service cannot produce speech or images, the app states this
clearly and the conversation continues normally.

**Why this priority**: Spoken and visual context increase immersion and are explicitly desired,
but the conversation, the feedback and the session history carry the learning value and come first.

**Independent Test**: Start a session on a service that supports speech and images and verify that
the partner's line can be played and that an illustration appears for the situation; repeat on a
service without those capabilities and verify the graceful fallback.

**Acceptance Scenarios**:

1. **Given** the configured AI service can produce speech, **When** the learner activates playback
   on a partner line, **Then** the line is read aloud in the target language.
2. **Given** the configured AI service cannot produce speech, **When** the learner opens the
   playback control, **Then** the app explains that the service does not support it and the
   conversation is not interrupted.
3. **Given** a session is running, **When** the situation, a key moment or the end is reached,
   **Then** an illustration for that moment is shown in the app and remains available afterwards.
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
- The learner changes the language or level during an ongoing session: the change applies from the
  next partner line onwards, and the session header reflects the new setting.
- The AI service returns an incomplete, malformed or unexpected answer: the app shows a
  comprehensible error, keeps the learner's typed text and never loses the session.
- The AI service is unreachable, rejects the key, or reports a rate limit: the app shows what
  happened and how to proceed, and the learner's pending answer stays editable and sendable.
- The network drops while a partner answer is being requested: the app reports the interruption and
  allows the request to be repeated without losing the turn.
- The session grows beyond dozens of exchanges: the transcript stays navigable and the app remains
  responsive.
- The learner leaves the app in the middle of a reply: after returning, the session is intact and
  the pending answer is still available.
- The learner deletes a session: the deletion is confirmed first and cannot be undone afterwards.
- The AI service supports neither speech nor images: the core conversation, the feedback and the
  session history remain fully usable.
- The learner has not configured an AI service yet: the app explains how to do this and does not
  fail with a technical error.

## Requirements *(mandatory)*

### Functional Requirements

**Session setup**

- **FR-001**: The learner MUST be able to start a practice session by selecting a target language, a
  proficiency level, a situation and a conversation partner before the first partner line is shown.
- **FR-002**: The system MUST offer a selectable list of target languages and a selectable list of
  proficiency levels, where each level carries a short, plain-language description of what it means.
- **FR-003**: The system MUST offer a catalogue of situations and conversation partners, each
  situation with a setting description and each partner with a name, an age and an occupation, and
  the catalogue MUST allow browsing and searching by keyword.
- **FR-004**: The catalogue MUST be available without a network connection, so that a learner can
  start a session while offline as far as the situation and partner selection are concerned.
- **FR-005**: The system MUST show the chosen situation, partner, language and level in the session
  header of a running session.

**Dialogue cycle**

- **FR-006**: The partner MUST open the conversation with a single line or question in the target
  language that fits the chosen situation, partner and level.
- **FR-007**: The learner MUST be able to type an answer in the target language and send it, and the
  send control MUST be reachable on a phone-sized screen.
- **FR-008**: After each answer, the system MUST show, in one place: a translation of the partner's
  preceding line, an optional explanation of that line, a corrected version of the learner's answer,
  an interpretation of the learner's answer, the gaps that were filled with assumptions, and an
  overall assessment of the learner's language in that turn.
- **FR-009**: Where the learner's answer contains an explicit gap marker (`???`) or a word given in
  the learner's native language, the system MUST fill the gap with a plausible, context-appropriate
  assumption and MUST visibly mark that text as an assumption.
- **FR-010**: The system MUST provide an "Explain to me" action on every turn that returns further
  information about the semantics of the phrase, the error, or both, and MUST keep the existing
  feedback visible while doing so.
- **FR-011**: The partner MUST react to the learner's answer and continue the conversation, and the
  cycle MUST repeat until the learner ends the session.
- **FR-012**: The partner's language MUST stay in the target language and MUST respect the selected
  level in vocabulary, sentence length and grammatical complexity.
- **FR-013**: The correction, the interpretation and the assessment of the learner's answer MUST
  take the selected level into account.
- **FR-014**: The system MUST present the feedback for a turn in a fixed, predictable order so that
  the learner always knows where to look for the translation, the correction and the assessment.

**Sessions and history**

- **FR-015**: The system MUST keep every session with its situation, partner, language, level, date,
  number of exchanges and complete transcript, and MUST make it available after a reload or a
  device restart.
- **FR-016**: The learner MUST be able to list all sessions, open any of them and read the complete
  transcript including all feedback.
- **FR-017**: The learner MUST be able to search and filter the session list by language, situation
  and keyword.
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

**Audio and illustration (optional capabilities)**

- **FR-026**: If the configured AI service can produce speech, the learner MUST be able to have the
  partner's lines read aloud in the target language.
- **FR-027**: If the configured AI service cannot produce speech, the app MUST state this clearly
  and MUST NOT interrupt or block the conversation.
- **FR-028**: The system SHOULD be able to show an illustration for the situation at the start of a
  session, for key moments within it, and at the end.
- **FR-029**: Illustrations MUST be stored on the learner's own device and MUST NOT be loaded from a
  third-party address when displayed.
- **FR-030**: If the AI service cannot produce images, the app MUST continue without illustrations
  and MUST NOT show an error that interrupts the conversation.

**Presentation and privacy**

- **FR-031**: The whole app MUST be usable on a screen that is 320 pixels wide, MUST NOT require
  horizontal scrolling for primary content, and MUST offer interactive controls of at least
  44 by 44 pixels that work without hover and without a physical keyboard.
- **FR-032**: The app MUST NOT contain analytics, tracking or crash reporting, and MUST NOT transmit
  the learner's data to any destination other than the configured AI service.
- **FR-033**: The interface language of the app MUST be [NEEDS CLARIFICATION: German only, or
  selectable to match the learner's native language, which also decides the target language of the
  translation and explanation?]
- **FR-034**: The delivery of a partner's turn MUST be [NEEDS CLARIFICATION: should the text appear
  progressively while it is being generated, or only as a complete turn once the service has
  answered?]
- **FR-035**: The scope of the first release MUST be
  [NEEDS CLARIFICATION: should the illustration and speech capabilities (FR-026 to FR-030) be part
  of the first release, or only planned for a later iteration?]

**Scope boundaries for the first release**

- Out of scope: pronunciation scoring or phonetic ratings, flashcards and spaced repetition,
  accounts and cross-device synchronisation, teacher or classroom management, a catalogue that is
  fetched from a server, and any analysis of the learner's progress across sessions beyond the
  per-turn assessment.
- In scope: the dialogue cycle with per-turn feedback, the situation and partner catalogue, session
  management with export and import, and the configuration of the AI service.

### Key Entities

- **Session**: A single practice conversation. Attributes: identifier, title, target language,
  proficiency level, situation, partner, creation and last activity date, number of exchanges,
  state (active or ended).
- **Turn**: One cycle step of a session. Attributes: position in the session, partner line, the
  learner's answer, translation of the partner line, explanation of that line, corrected learner
  answer, interpretation of the learner's answer, filled-in assumptions with their markers, overall
  language assessment, and the additional explanation retrieved via "Explain to me".
- **Persona (conversation partner)**: A character the learner talks to. Attributes: name, age,
  occupation, short description, and the situations the person belongs to.
- **Situation**: A scenario the conversation takes place in. Attributes: name, setting description,
  key moments, and the personas available for it.
- **Learner profile and settings**: The learner's configuration. Attributes: target language,
  proficiency level, native language, the address, credentials and model of the AI service, and the
  settings for speech and illustrations.
- **Illustration**: A generated picture for a situation moment. Attributes: referenced session and
  turn, the moment it depicts, and the locally stored asset.
- **Explanation**: Additional information about a turn, retrieved on demand. Attributes: referenced
  turn, content, and the kind of information (meaning of a phrase, a specific error, or both).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can go from opening the app to seeing the partner's first line in at most
  4 selections and 60 seconds.
- **SC-002**: At least 90% of first-time test users complete an exchange of 10 or more turns in one
  sitting without leaving the dialogue view on a phone-sized screen.
- **SC-003**: 100% of turns that the learner sends receive a translation, a correction, an
  interpretation, a list of filled-in assumptions and an overall assessment.
- **SC-004**: The complete feedback for a turn is visible within 10 seconds of sending an answer in
  at least 95% of turns under normal network conditions.
- **SC-005**: Every session opened after a device restart shows the full transcript including all
  feedback, in 100% of cases.
- **SC-006**: At least 85% of test users state that the "Explain to me" action told them what to
  improve, without needing a further explanation.
- **SC-007**: In a full practice session, a network trace shows no request to any destination other
  than the configured AI service.
- **SC-008**: With the network disconnected, all functions that do not require the AI service
  (session list, transcript, settings, export) remain fully usable.
- **SC-009**: On a 320-pixel-wide screen, the primary flow is usable without horizontal scrolling
  and every interactive control is at least 44 by 44 pixels.
- **SC-010**: At least 80% of test users find a previously started session and resume reading it
  within 30 seconds.
- **SC-011**: At least 75% of test users rate the situation and partner choice as feeling
  "realistic" rather than artificial.

## Assumptions

- The app is used by a single learner per device, without accounts, without a server and without
  synchronisation between devices. All data lives in the learner's browser.
- The interface language of the first release is German; the language being practised is always a
  separate, selectable choice.
- The AI service is an OpenAI-compatible service that the learner configures themselves. The app
  does not ship with a service, a key or a model.
- The service must be able to return the content the dialogue cycle needs. Where a service cannot
  guarantee a structured answer, the app asks for the required pieces in plain text and is
  tolerant about their order.
- Illustrations and speech are optional capabilities that depend on what the configured service
  supports; the core dialogue, feedback and session history never depend on them.
- The first release delivers partner answers as complete turns; progressive display is an
  enhancement for a later iteration, and the interface always shows a visible progress indication
  while a request is running.
- The language assessment is limited to semantics, grammar and vocabulary. A rating of the
  learner's pronunciation is a later feature and is not part of the first release.
- The situation and partner catalogue is part of the shipped app and is maintained with it, so that
  it is available offline and requires no external service.
- The learner may mark a word they cannot express with `???` or by writing it in their native
  language; both are treated as an explicit gap to be filled with a labelled assumption.
- The feature branch for this work is `001-ai-language-roleplay`.
