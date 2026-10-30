# TODO

Offene Punkte, nach Themen gruppiert.

## AI-Persona & Kontext

- [x] AI-Persona darf den gesamten Kontext (Name, eigene Situation etc.) nicht kennen, solange er im Gespräch noch nicht erwähnt wurde. _(Umsetzung: Profil in wahrnehmbare Merkmale + sonstige Daten getrennt; Name/Angaben nur bei Option „KI-Persona kennt dich bereits" oder im Bild-Kontext; 13. Situation „Am Telefon" ergänzt.)_

## Feedback & Bewertung

- [ ] Explanation sollte objektiv formuliert sein und nicht aus der Perspektive der AI („ich“). Beispiel: `Explanation – Deine Antwort ist natürlich und grammatisch korrekt. Du bestätigst, dass du ein Entwickler bist, und sagst dann, dass du mich ja vorher gewarnt hast. Das passt gut zur Situation. Nichts zu korrigieren.`
- [ ] Bewertung: Akzente mitbewerten; Typografie nur als Anmerkung. Ggf. konfigurierbar machen.

## Development

- [ ] AGENTS.md mit /init erzeugen

## Build & Deployment

- [ ] HTML-Kommentare mit Verweisen auf Specs entfernen – oder sicherstellen, dass sie im finalen Build nicht sichtbar sind.
- [ ] FavIcon ergänzen.

## Conversation Settings

- [ ] Konversations-Settings: festlegen, wer beginnt (User oder AI) inkl. Default.
- [ ] Eigene Situation/Persona nicht als „ausgewählt“ erkenntlich machen.

## Konversation

- [x] Klären, was genau "Filled-in gaps" macht. Möglicherweise false positives damit. _(Geklärt: Der Abschnitt zeigt nur noch echte Lücken — `???`-Marker oder ein einzelnes Wort in der Muttersprache. `validateAssumptions` verwirft Phrasen in der Zielsprache, No-op-Assumptions (original = filled) und Originale, die nicht in der Antwort vorkommen; Prompt-Regel geschärft; `tests/unit/assumptions.test.ts` ergänzt.)_
- [x] Input-Fokus soll nach jedem AI-Feedback ins Input-Feld wandern. _(Umsetzung: `DialogueView` fokussiert das Composer-Textarea nach jedem abgeschlossenen AI-Response — Feedback, Eröffnungszeile oder Fehler — über einen Phasen-Watcher (`generating`/`partner-streaming` → `waiting-answer`/`failed`); ebenso beim Wechsel/Öffnen einer bereits bestehenden Konversation (`idle` → `waiting-answer`); kein Fokus-Diebstahl bei beendeten Sessions; `tests/e2e/dialogue.spec.ts` ergänzt.)_
- [ ] Falls AI am Zuge ist (laufender Request), dann Absenden-Button nicht aktivieren


## Profil & Persona

- [ ] Profile-Setting: Zielgruppe einstellbar (Kind vs. Erwachsener) oder automatisch aus dem Alter ableiten. Hinweis: Ableitung aus dem Alter schließt ein „Alter-Ego“ aus.

## TTS / Audio

- [ ] TTS Voices auswählbar (männlich/weiblich, jung/alt).
- [ ] TTS auch für die eigene (User-)Message? Ggf. als Einstellung.
- [ ] Option für lokales TTS (browser-feature oder local model).

## Darstellung

- [x] User-Message sofort rendern, während AI-Request noch passiert. _(Umsetzung: `useSession` exponiert `pendingLearnerText` — die getippte Antwort wird synchron beim Senden als Lernenden-Bubble gerendert und erst nach Erfolg durch den gespeicherten Turn ersetzt; bei Fehlern bleibt sie sichtbar.)_
- [ ] Emoji für Stimmungen?
- [ ] Bildstil (Illustrationen) festlegen.

## Gesprächs-Lebenszyklus

- [ ] Beendetes Gespräch: entweder die Beenden-Funktion entfernen oder das Wiedereröffnen erlauben.

## Settings & Konfiguration

- [ ] Settings: Auth-style / Provider-Profil – URL als separate Option anbieten?
