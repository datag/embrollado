# TODO

Offene Punkte, nach Themen gruppiert.

## Development

- [x] Ein Debug-Panel (auch im Prod-Build) in dem man alle AI-Requests der aktuellen Session (keine Persistenz) nachsehen/prüfen kann. Der JSON-Request und -Response sollte formatted und highlighted dargestellt werden. Längere Payloads (z.B. base64-kodierte Bildaten) sollen mit jeweils 5 Zeichen vorne/hinten und zwischendrin `<TRUNCATED>` abgekürzt werden. Das Panel kann mit einem Icon in der rechten unteren Ecke getoggelt werden. Das Panel zeigt eine Listenansicht (sortiert nach Datum absteigend) mit Datum/Uhrzeit, Request oder Response, Art (Chat, TTS, Image, Sonstige). Ein Klick auf ein Item soll die Details inklusive Header (Default zugeklappt, und API-Key als `<REDACTED>`) und insbesondere der Payload zeigen. _(Toggle über einen „Debug“-Eintrag im Footer statt eines Icons in der Ecke.)_

## Build & Deployment

## Conversation List

## Conversations Settings

- [ ] Konversations-Settings: festlegen, wer beginnt (User oder AI) inkl. Default.

## Conversation

- [ ] Beendetes Gespräch: entweder die Beenden-Funktion entfernen oder das Wiedereröffnen erlauben.
- [ ] Eingabe-Hilfe (Button-Zeile) für Akzente und Zeichen wie ¿ und ¡
- [ ] Eingabe-Hilfe für eine Gap/Lücke `???`
- [ ] Emoji für Stimmungen/Mimik?
- [ ] HTML5-Attribut für Input-Sprache?

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

## Profil & Persona

- [ ] Zielgruppe einstellbar (Kind vs. Erwachsener) oder automatisch aus dem Alter ableiten. Hinweis: Ableitung aus dem Alter schließt ein „Alter-Ego“ aus.

## Settings & Konfiguration
