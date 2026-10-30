# TODO

Offene Punkte, nach Themen gruppiert.

## Development

- [ ] AGENTS.md mit /init erzeugen
  - [ ] Faustregel: Stets committen, aber nicht pushen

## Build & Deployment

- [ ] HTML-Kommentare mit Verweisen auf Specs entfernen – oder sicherstellen, dass sie im finalen Build nicht sichtbar sind.
- [ ] FavIcon ergänzen.
- [ ] Datenschutzerklärung-Verlinkung Englisch/Deutsch mittels Env- bzw. GitHub-Repository-Vars (analog zu anderen Projekten)

## Konversations-Settings

- [ ] Konversations-Settings: festlegen, wer beginnt (User oder AI) inkl. Default.
- [x] Custom konfigurierte Situation/Persona ist nicht als „ausgewählt“ erkennbar.
- [x] Eigene Vorlagen bearbeiten/umbenennen (FR-047: edit inkl. rename umgesetzt; Delete bereits).

## Konversation

- [ ] Beendetes Gespräch: entweder die Beenden-Funktion entfernen oder das Wiedereröffnen erlauben.
- [ ] Eingabe-Hilfe (Button-Zeile) für Akzente und Zeichen wie ¿ und ¡
- [ ] Eingabe-Hilfe für eine Gap/Lücke `???`
- [ ] Emoji für Stimmungen?

### Darstellung

- [ ] Lücken besonders rendern

### Feedback & Bewertung

- [ ] Bewertung: Akzente explizit mitbewerten; Typografie nur als Anmerkung. Ggf. konfigurierbar machen.
- [ ] Untersuchen: Wenn in Explanation ein Fehler (Rechtschreibfehler in Wort) erwähnt wird, dann sollte dieser Fund auch in den Korrekturen auftauchen.

## TTS / Audio

- [ ] TTS Voices auswählbar (männlich/weiblich, jung/alt); in Settings jeweils konfigurierbar für male/female/other und dann anhand Kontext entscheiden?
- [ ] TTS auch für die eigene (User-)Message? Ggf. als Einstellung.
- [ ] Option für lokales TTS (browser-feature oder local model).

## Image Generation

- [ ] Prüfen: Bekommt Image-Gen den vollen Kontext, inkl. Aussehen der Personen?
- [ ] Bildstil (Illustrationen) festlegen.
- [ ] Konsistente Images (also bei Folge-Bildern)

## Profil & Persona

- [ ] Zielgruppe einstellbar (Kind vs. Erwachsener) oder automatisch aus dem Alter ableiten. Hinweis: Ableitung aus dem Alter schließt ein „Alter-Ego“ aus.

## Settings & Konfiguration

- [ ] Auth-style / Provider-Profil – URL als separate Option anbieten?
