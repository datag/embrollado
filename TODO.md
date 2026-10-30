# TODO

Offene Punkte, nach Themen gruppiert.

## Feedback & Bewertung

- [ ] Explanation sollte objektiv formuliert sein und nicht aus der Perspektive der AI („ich“). Beispiel: `Explanation – Deine Antwort ist natürlich und grammatisch korrekt. Du bestätigst, dass du ein Entwickler bist, und sagst dann, dass du mich ja vorher gewarnt hast. Das passt gut zur Situation. Nichts zu korrigieren.`
- [ ] Bewertung: Akzente mitbewerten; Typografie nur als Anmerkung. Ggf. konfigurierbar machen.

## Development

- [ ] AGENTS.md mit /init erzeugen
  - [ ] Faustregel: Stets committen, aber nicht pushen

## Build & Deployment

- [ ] HTML-Kommentare mit Verweisen auf Specs entfernen – oder sicherstellen, dass sie im finalen Build nicht sichtbar sind.
- [ ] FavIcon ergänzen.

## Konversations-Settings

- [ ] Konversations-Settings: festlegen, wer beginnt (User oder AI) inkl. Default.
- [ ] Eigene konfigurierte Situation/Persona ist nicht als „ausgewählt“ erkennbar.

## Konversation

- [ ] Beendetes Gespräch: entweder die Beenden-Funktion entfernen oder das Wiedereröffnen erlauben.


## TTS / Audio

- [ ] TTS Voices auswählbar (männlich/weiblich, jung/alt); in Settings jeweils konfigurierbar für male/female/other und dann anhand Kontext entscheiden?
- [ ] TTS auch für die eigene (User-)Message? Ggf. als Einstellung.
- [ ] Option für lokales TTS (browser-feature oder local model).

## Image Generation

- [ ] Prüfen: Bekommt Image-Gen den vollen Kontext, inkl. Aussehen der Personen?
- [ ] Konsistente Images (also bei Folge-Bildern)

## Darstellung

- [ ] Emoji für Stimmungen?
- [ ] Bildstil (Illustrationen) festlegen.
- [ ] AJAX-/AI-Request-Loading soll visuell ansprechender sein

## Profil & Persona

- [ ] Zielgruppe einstellbar (Kind vs. Erwachsener) oder automatisch aus dem Alter ableiten. Hinweis: Ableitung aus dem Alter schließt ein „Alter-Ego“ aus.

## Settings & Konfiguration

- [ ] Auth-style / Provider-Profil – URL als separate Option anbieten?
