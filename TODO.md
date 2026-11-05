# TODO

Offene Punkte, nach Themen gruppiert.

## Development

## Build & Deployment

## Conversation List

## Conversations Settings

- [ ] Konversations-Settings: festlegen, wer beginnt (User oder AI) inkl. Default.
- [ ] Überlegung: User-Kontext ebenfalls in den Konversation-Start verschieben und dort auch mehrere User-Persona ermöglichen
- [x] Situation/Persona per KI erzeugen lassen (🪄-Button im „Eigene Eintrag“-Formular) — FR-064/T134
  - Die App würfelt strukturierte Seed-Elemente (Art der Begegnung, Ort, konkretes Anliegen bzw. Beruf,
    ca. 1/3 mal eine latente Wendung, plus zwei weiche Zusatzwörter) und der Prompt zwingt das Modell,
    diese wörtlich zu verwenden — so ist die Vielfalt garantiert statt dem Modell überlassen. Der
    Entwurf füllt die Formularfelder (erneutes Drücken überschreibt), wird vor dem Befüllen validiert
    (ein fehlerhafter Entwurf überschreibt nichts) und das Formular ist während des Requests gesperrt.
  - Offen: `keyMoments` werden weiterhin nirgends ausgewertet (tote Daten) — der Szenenbogen könnte
    später in den Dialog-Prompt aufgenommen werden, das wäre aber eine eigene Änderung mit
    Regressionstests, weil es jede Session betrifft.

## Conversation

- [ ] Beendetes Gespräch: entweder die Beenden-Funktion entfernen oder das Wiedereröffnen erlauben.
- [ ] Eingabe-Hilfe (Button-Zeile) für Akzente und Zeichen wie ¿ und ¡
- [ ] Eingabe-Hilfe für eine Gap/Lücke `???`
- [ ] Emoji für Stimmungen/Mimik?
- [ ] HTML5-Attribut für Input-Sprache?
- [ ] Untersuchen; möglicher BUG: Situation/Persona und auch User-Kontext ist für eine Konversation fix. Auch wenn sich zwischenzeitlich z.B. die Infos zum User geändert haben, muss die Konversation stets mit den urspünglichen Settings laufen. Sicherstellen, dass die Settings nicht live herausgezogen werden, sondern direkt an den Metadaten der Konversation inkl. Persistenz stecken. Andere Settings wie z.B. Modell etc. sollen hingegen live herangezogen werden.
- [x] Streamed responses mit unserem structured JSON überhaupt sinnvoll bzw. partielles Rendern der Chunks möglich?
  - Die Partnerline wird jetzt progressiv gerendert (der SSE-Frame war nie bis zum Model-Text extrahiert
    worden — T127). Der Bewertungsblock selbst wird weiterhin als ein Block geliefert; Abschnitt für
    Abschnitt wäre machbar (die JSON-Feldreihenfolge entspricht der Blockreihenfolge), ist aber
    bewusst offen — siehe D15 in `research.md`.

### Darstellung

- [ ] Lücken visuell hervorgehoben rendern
- [ ] "Was du verbessern kannst": Die mit `whitespace-nowrap` gestylten Korrekturen fließen bei langen Texten aus dem Layout. Gibt es eine Klasse, die Umbrüche vermeidet, aber nicht verbietet?
- [ ] Dropdowns im Darkmode schwer lesbar, da hellgrauer Hintergrund

### Feedback & Bewertung

- [ ] Bewertung: Akzente explizit mitbewerten; Typografie nur als Anmerkung. Ggf. konfigurierbar machen.
- [x] Zu klären: Bewertung geht häufig bereits auf die AI-Antwort ein. Unsicher, ob wir das wollen.
  - [ ] Nochmals erwägen, die Evaluation in einen separaten Request zu machen, um das zu verhindern.
- [ ] Bei schwachen Modellen (?) ist die Explanation hin und wieder immer noch aus der Perspektive der AI-Persona. Es soll jedoch objektiv bzw. aus Erzählerperspektive bzw. von Lehrer aus dem Off kommen. Negativbeispiel: "Du fragst höflich nach meiner Herkunft,"

## TTS / Audio

- [ ] TTS Voices auswählbar (männlich/weiblich, jung/alt); in Settings jeweils konfigurierbar für male/female/other und dann anhand Kontext entscheiden?
- [ ] TTS auch für die eigene (User-)Message? Ggf. als Einstellung.
- [ ] Option für lokales TTS (browser-feature oder local model).

## Image Generation

- [ ] Prüfen: Bekommt Image-Gen den vollen Kontext, inkl. Aussehen der Personen? Negativbeispiel: Persona-Kontext "blaue Jeans und weißes Oberteil", und (schwaches?) Bild-Modell macht ein Blumenkleid daraus.
- [ ] Bildstil (Illustrationen) festlegen. Notiz: Stil einmalig mit LLM aus gespeicherten Bildern als JSON beschreiben lassen.
- [ ] Konsistente Images (also bei Folge-Bildern)

## Sonstiges AI

- [ ] Kosten, sofern in Responses geliefert, aufaddieren und anzeigen.

## Profil & Persona

- [ ] Zielgruppe einstellbar (Kind vs. Erwachsener) oder automatisch aus dem Alter ableiten. Hinweis: Ableitung aus dem Alter schließt ein „Alter-Ego“ aus.

## Settings & Konfiguration
