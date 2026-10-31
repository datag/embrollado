# TODO

Offene Punkte, nach Themen gruppiert.

## Development

- [x] AGENTS.md mit /init erzeugen
  - [x] Faustregel: Stets committen (wenn mehrere Features/Fixes angefragt, möglichst atomar), aber nicht pushen

## Build & Deployment

- [ ] HTML-Kommentare mit Verweisen auf Specs entfernen – oder sicherstellen, dass sie im finalen Build nicht sichtbar sind.
- [ ] FavIcon ergänzen. Möglicherweise etwas mit einem "E"? SVG?
- [ ] Datenschutzerklärung-Verlinkung Englisch/Deutsch (zwei Links "Privacy Policy" und "Datenschutzerklärung", selbe URL, aber named anchor #en und #de) mittels Env- bzw. GitHub-Repository-Vars (analog zu anderen Projekten, z.B. ~/projects/wizzy-weasel) im Footer. Sind die Variablen nicht gesetzt, gibt es diese Links nicht im Footer.
- [ ] Zusätzlich eine Env- bzw. GitHub-Repository-Var gestützte Code-Abfrage, die den Zugriff auf die App beschränkt. Es handelt sich hier lediglich um eine weiche Maßnahme "nicht direkt der Öffentlichkeit zugänglich", und nicht um einen Sicherheitsmechanismus. Das Passwort ist "letmein" und ist das Hash im Code hinterlegt. Nur wenn das Setting existiert, kommt unmittelbar vor dem Rendern einer Seite die Code-Abfrage. Ist der Code richtig, so wird ein Marker im localStorage (achte auf den App-Namen-Prefix) hinterlegt, an dem festgestellt werden kann, dass bereits einmal ein gültiger Code eingegeben wurde. In diesem Fall kommt keine Anfrage.

## Conversation List

- [x] Absteigend nach Datum (oder letzter Aktivität, falls vorhanden) sorieren

## Conversations Settings

- [ ] Konversations-Settings: festlegen, wer beginnt (User oder AI) inkl. Default.

## Conversation

- [ ] Beendetes Gespräch: entweder die Beenden-Funktion entfernen oder das Wiedereröffnen erlauben.
- [ ] Eingabe-Hilfe (Button-Zeile) für Akzente und Zeichen wie ¿ und ¡
- [ ] Eingabe-Hilfe für eine Gap/Lücke `???`
- [ ] Emoji für Stimmungen/Mimik?
- [ ] Retry-Function bei Fail?
- [x] Bewertung scheint hin und wieder Einfluss auf die Antwort zu nehmen; Manchmal AI-Antwort in Feedback-Language. Prompt schärfen, dass nicht die Sprache aus Erklärung relevant, sondern die Zielsprache.

### Darstellung

- [ ] Lücken visuell hervorgehoben rendern
- [ ] "Was du verbessern kannst":  Die mit `whitespace-nowrap` gestylten Korrekturen fließen bei langen Texten aus dem Layout. Gibt es eine Klasse, die Umbrüche vermeidet, aber nicht verbietet?

### Feedback & Bewertung

- [ ] Bewertung: Akzente explizit mitbewerten; Typografie nur als Anmerkung. Ggf. konfigurierbar machen.
- [x] Untersuchen: Wenn in Explanation ein Fehler (Rechtschreibfehler in Wort) erwähnt wird, dann sollte dieser Fund auch in den Korrekturen auftauchen.
- [x] Bei Verbesserungsvorschlägen kein Imperativ wie "bitte korrigieren", denn diese Funktion ist nicht vorgesehen.
- [x] Zu klären: Bewertung geht häufig bereits auf die AI-Antwort ein. Unsicher, ob wir das wollen.
  - [ ] Nochmals erwägen, die Evaluation in einen separaten Request zu machen, um das zu verhindern.
- [x] Bewertung wirklich nur auf die letzte User-Antwort, niemals das zuvor korrigieren/bewerten, jedoch ggf. als zusätzlich Kontext verwenden.

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
