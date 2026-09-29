# PROJ-1 — Technisches Design: Registrierung & Login

> Das technische Design (das WIE) zu `spec.md`. Zwei Leser: du (zur Freigabe) und `/build` (baut direkt danach). Kein Code, aber so genau, dass niemand raten muss.
> Owner: `/architecture`. Der Vertrag (WAS) steht in `spec.md`, die Aufgabenliste später in `tasks.md`.
> Kein Status und kein Datum hier: Der Status lebt nur in `features/INDEX.md`.

## Überblick in einem Absatz

Supabase Auth übernimmt Konten, Passwörter, E-Mail-Bestätigung und Links zum Zurücksetzen. Alles, was ein Passwort prüft oder eine Mail auslöst, läuft **über den Next.js-Server** (Server Actions) und nicht direkt vom Browser zu Supabase. Nur so sitzt unsere eigene Login-Bremse zuverlässig davor. Die Bremse zählt Versuche in einer eigenen Tabelle in der Datenbank, die nur der Server lesen und schreiben kann. Aufräumjobs in der Datenbank löschen alte Einträge und unbestätigte Konten. Der Zugriffsschutz greift doppelt: Die App prüft die Anmeldung vor jeder geschützten Seite, und die Datenbank lässt per Row Level Security jeden nur seine eigenen Zeilen sehen.

## Seiten und Adressen

Adressen sind Code und bleiben deshalb englisch. Alle Texte auf den Seiten sind deutsch.

| Adresse | Was dort passiert | Wer darf hin | → AC / EC |
|---|---|---|---|
| `/login` | Login-Formular, Links „Passwort vergessen?“, „Konto anlegen“, „Datenschutz“ | nur abgemeldet (angemeldet → `/`) | AC-7, AC-8, AC-9, AC-11, AC-23, AC-24 |
| `/register` | Registrierungsformular, danach der Zustand „Prüfe dein Postfach“ auf derselben Seite | nur abgemeldet (angemeldet → `/`) | AC-1, AC-2, AC-5, AC-6, AC-26, AC-30 |
| `/forgot-password` | Formular „Passwort vergessen“, danach die neutrale Bestätigung | nur abgemeldet (angemeldet → `/`) | AC-16, AC-25 |
| `/auth/confirm` | Keine Seite, sondern ein Server-Endpunkt: nimmt den Link aus der Mail entgegen, prüft ihn und leitet weiter | alle | AC-3, AC-17, EC-1–EC-4 |
| `/auth/link-expired` | „Dieser Link ist abgelaufen oder wurde schon benutzt.“ mit Formular für eine neue Mail und Link zum Login | alle | EC-1, EC-2 |
| `/reset-password` | „Neues Passwort festlegen“ | nur mit Anmeldung (entsteht durch den Link aus der Mail), sonst → `/login` | AC-17, AC-18 |
| `/privacy` | Datenschutzerklärung (Platzhaltertext) | alle, ohne Anmeldung | AC-30 |
| `/` | Startseite: Platzhalter bis PROJ-2, dann Sessions-Übersicht | nur angemeldet | AC-3, AC-7 |
| `/account` | Konto-Seite | nur angemeldet | AC-19–AC-22, AC-27–AC-29 |
| `/account/export` | Server-Endpunkt: liefert die Export-Datei zum Herunterladen | nur angemeldet | AC-29 |

**Hinweise auf der Login-Seite** kommen über einen kurzen Code in der Adresse, zum Beispiel `/login?notice=account-deleted`. Erlaubt sind nur `account-deleted` („Dein Konto wurde gelöscht.“), `session-ended` („Bitte melde dich erneut an.“) und `email-confirmed` („E-Mail-Adresse bestätigt. Bitte melde dich an.“). Unbekannte Codes werden ignoriert. **Nie steht eine E-Mail-Adresse, ein Passwort oder ein Token in einer Adresse, die die App selbst erzeugt.** Deshalb zeigt `/register` den Zustand „Prüfe dein Postfach“ auf derselben Seite, statt mit der Adresse in der URL weiterzuleiten.

## Komponenten-Struktur

```
Seiten für Abgemeldete (eigenes Layout: dunkler Wald-Hintergrund mit Papier-Textur,
                        Schriftzug „Petrilog“ in Zilla Slab 46 px, keine Tab-Leiste)
+-- /login
|   +-- Hinweis-Notice (aus ?notice=…, Erfolgston bzw. neutral)
|   +-- Login-Formular
|   |   +-- E-Mail-Feld
|   |   +-- Passwortfeld mit „Passwort anzeigen“
|   |   +-- Fehler-Notice im Warnton (falsche Daten, Sperre, keine Verbindung)
|   |   +-- Hinweis „Bitte bestätige zuerst …“ mit Button „Mail erneut senden“ (nur bei unbestätigtem Konto)
|   |   +-- Hauptbutton „Anmelden“ (unten, volle Breite, während der Verarbeitung gesperrt)
|   +-- Links: „Passwort vergessen?“ · „Konto anlegen“ · „Datenschutz“
+-- /register
|   +-- Registrierungsformular
|   |   +-- E-Mail-Feld
|   |   +-- Passwortfeld mit „Passwort anzeigen“ und dem Hinweis „mindestens 8 Zeichen“
|   |   +-- Satz „Mit der Registrierung gilt unsere Datenschutzerklärung.“ (Link)
|   |   +-- Fehler-Notice im Warnton
|   |   +-- Hauptbutton „Konto anlegen“
|   +-- Zustand „Prüfe dein Postfach“ (ersetzt das Formular nach dem Abschicken)
|   |   +-- Adresse, an die der Link ging
|   |   +-- „Du hast schon ein Konto? Dann melde dich an oder setze dein Passwort zurück.“ (zwei Links)
|   |   +-- Button „Mail erneut senden“ (mit Notice für Erfolg bzw. Wartezeit)
|   +-- Link „Schon ein Konto? Anmelden“
+-- /forgot-password
    +-- Formular: E-Mail-Feld, Hauptbutton „Link senden“
    +-- Neutrale Bestätigung (ersetzt das Formular)

Seiten ohne Rahmen (hell, mittige Spalte, kompakte Kopfzeile mit Titel)
+-- /auth/link-expired
|   +-- Meldung, Formular „Neue Mail anfordern“ (E-Mail-Feld), Link „Zum Login“
+-- /reset-password
|   +-- Formular: neues Passwort mit „Passwort anzeigen“, Hauptbutton „Passwort speichern“
+-- /privacy
    +-- Platzhaltertext der Datenschutzerklärung, Link zurück

Angemeldeter Bereich (Layout prüft die Anmeldung; Kopfzeile und Tab-Leiste kommen mit PROJ-2)
+-- / Startseite (Platzhalter): Begrüßung, Link „Konto“
+-- /account Konto-Seite
    +-- E-Mail-Adresse (nur Anzeige)
    +-- Zeile „Passwort ändern“ → öffnet ein Sheet von unten
    |   +-- Feld „Aktuelles Passwort“, Feld „Neues Passwort“ (beide mit „Passwort anzeigen“)
    |   +-- Fehler-Notice, Hauptbutton „Passwort ändern“
    +-- Zeile „Meine Daten exportieren“ → lädt die JSON-Datei herunter
    +-- Link „Datenschutz“
    +-- Button „Abmelden“
    +-- Button „Konto löschen“ (Warnton) → Bestätigungsdialog
        +-- Text: Konto, alle Sessions, Fänge und Positionen werden endgültig gelöscht
        +-- Passwortfeld, Fehler-Notice
        +-- Buttons „Abbrechen“ · „Endgültig löschen“

Rückmeldungen
+-- Erfolgs-Notice oben, verschwindet nach ca. 2 s (sonner): „Passwort geändert“, „Mail gesendet“
```

**Wiederverwendete shadcn/ui-Bausteine** (alle schon installiert): `input`, `button`, `label`, `form`, `alert` (Notices), `alert-dialog` (Löschdialog), `sheet` (Passwort ändern), `sonner` (Erfolgs-Notice), `separator`, `card`. Neu gebaut wird nur das **Passwortfeld mit Anzeige-Knopf**, zusammengesetzt aus `input` und `button`. Es ist keine eigene Variante einer shadcn-Komponente.

**Formulare:** Die Felder prüfen sofort im Browser (react-hook-form mit Zod) und zeigen die Fehlermeldung am Feld. Abgeschickt wird per Server Action aus dem Submit-Handler, also immer als POST und ohne dass die Felder geleert werden. Dieselben Zod-Regeln prüft der Server noch einmal (AC-5). Die Eingabefelder bekommen passende Angaben für Tastatur und Autofill: bei der E-Mail die E-Mail-Tastatur, keine automatische Großschreibung und `autocomplete=email`; beim Passwort `current-password` bzw. `new-password`, damit Passwort-Manager funktionieren.

## Eingaberegeln (gemeinsam für Browser und Server)

- **E-Mail-Adresse:** Leerzeichen am Anfang und Ende werden entfernt, alles wird kleingeschrieben (EC-7). Pflichtfeld, gültiges Format, höchstens 254 Zeichen. Fehlermeldung: „Bitte gib eine gültige E-Mail-Adresse ein.“
- **Neues Passwort** (Registrierung, Zurücksetzen, Ändern): mindestens 8 und höchstens 72 Zeichen. 72 ist die technische Obergrenze des Passwort-Hashings. Keine Pflicht-Zeichenklassen, Leerzeichen erlaubt, nichts wird abgeschnitten. Meldungen: „Das Passwort muss mindestens 8 Zeichen haben.“ bzw. „Das Passwort darf höchstens 72 Zeichen haben.“
- **Bestehendes Passwort** (Login, aktuelles Passwort, Löschdialog): nur Pflichtfeld, höchstens 72 Zeichen. Die Mindestlänge wird hier nicht geprüft, sonst würde die Meldung Hinweise über das Passwort geben.

## Datenmodell

### profiles — das Profil eines Anglers (neu)

Jedes Profil hat:
- **id**: eindeutige Kennung, identisch mit der Kennung des Supabase-Auth-Kontos. Pflicht, Primärschlüssel, verweist auf das Auth-Konto. Wird das Konto gelöscht, verschwindet das Profil automatisch mit.
- **created_at**: Zeitpunkt der Anlage, Pflicht, wird automatisch gesetzt.

Weitere Felder gibt es bewusst nicht (Datensparsamkeit). Die E-Mail-Adresse liegt nur im Auth-Konto und wird nicht doppelt gespeichert.

- **Angelegt:** automatisch durch die Datenbank, sobald ein Auth-Konto entsteht, genau eins pro Konto (AC-4).
- **Zugriff:** Ein angemeldeter Nutzer darf **nur sein eigenes** Profil lesen. Anlegen, Ändern und Löschen dürfen Nutzer nicht selbst, das erledigen die Datenbank (Anlegen) und die Löschung des Kontos (Löschen). Nicht angemeldete Aufrufer sehen nichts (AC-14, AC-15).
- **Gespeichert bis:** Das Konto wird gelöscht (AC-28), oder bei unbestätigten Konten 7 Tage nach der Registrierung (AC-32).

**Verbindlich für PROJ-2 und PROJ-3:** Jede Tabelle mit Nutzerdaten verweist auf den Besitzer so, dass sie beim Löschen des Kontos automatisch mitgelöscht wird. Sie hat Row Level Security mit „nur eigene Zeilen“ (`user_id` = angemeldeter Nutzer) und ergänzt den Datenexport um ihre Daten. So bleibt nach „Konto löschen“ garantiert nichts zurück (EC-12).

### auth_throttle_events — Protokoll für die Login-Bremse (neu, nur für den Server)

Jeder Eintrag hat:
- **id**: eindeutige Kennung, automatisch.
- **kind**: Art des Eintrags, Pflicht, einer von:
  - `login_attempt`: jede Passwortprüfung (Login, aktuelles Passwort bei „Passwort ändern“, Passwort im Löschdialog)
  - `mail_request`: jede angeforderte Mail (Registrierung, „Mail erneut senden“, „Passwort vergessen“, neue Mail auf `/auth/link-expired`)
  - `signup`: jede angenommene Registrierung
- **email**: normalisierte E-Mail-Adresse, höchstens 254 Zeichen. Pflicht bei `login_attempt` und `mail_request`, **leer** bei `signup` (Datensparsamkeit: dort zählt nur die IP).
- **ip**: IP-Adresse des Aufrufers, höchstens 45 Zeichen. `unknown`, wenn sie sich nicht ermitteln lässt.
- **outcome**: Ergebnis, Pflicht, einer von:
  - `pending`: Prüfung läuft. Zählt wie ein Fehlversuch, solange sie läuft.
  - `failed`: falsches Passwort oder unbekannte Adresse
  - `succeeded`: Passwort richtig. Dazu zählt auch „richtig, aber Konto noch nicht bestätigt“.
  - `allowed`: Mail bzw. Registrierung wurde zugelassen
  - `blocked`: wegen einer Sperre abgelehnt. Zählt nie mit.
- **created_at**: Zeitpunkt, Pflicht, automatisch.

- **Zugriff:** **Kein** Nutzer und kein anonymer Aufrufer darf lesen oder schreiben: Row Level Security ist an, es gibt keine Regeln, und alle Rechte für die öffentlichen Rollen sind entzogen. Nur der Next.js-Server greift mit dem Server-Schlüssel darauf zu.
- **Suchpfade:** Die Tabelle wird nach (Art, E-Mail, Zeitpunkt) und (Art, IP, Zeitpunkt) abgefragt. Für beide gibt es einen Index.
- **Gespeichert bis:** höchstens 24 Stunden. Ein stündlicher Aufräumjob löscht ältere Einträge (AC-31).

### Hilfsfunktion „Kontostatus einer Adresse“ (neu, nur für den Server)

Eine Datenbankfunktion bekommt eine normalisierte E-Mail-Adresse und antwortet mit einem von drei Werten: `none` (kein Konto), `unconfirmed` (Konto, noch nicht bestätigt) oder `confirmed` (bestätigtes Konto). Aufrufen darf sie **nur** der Server mit dem Server-Schlüssel. Für anonyme und angemeldete Rollen ist sie gesperrt, sonst wäre sie ein Werkzeug, um herauszufinden, wer ein Konto hat. Sie wird nur bei der Registrierung gebraucht (EC-8).

### Aufräumjobs in der Datenbank (neu)

Die Jobs laufen stündlich über die in Supabase eingebaute Zeitsteuerung (pg_cron):
- **Protokoll aufräumen:** löscht Einträge in `auth_throttle_events`, die älter als 24 Stunden sind (AC-31).
- **Unbestätigte Konten löschen:** löscht Auth-Konten, die nicht bestätigt wurden und deren Registrierung mehr als 7 Tage zurückliegt. Das Profil verschwindet automatisch mit (AC-32).

### Was Supabase Auth selbst speichert

Supabase speichert E-Mail-Adresse, Passwort-Hash, die Zeitpunkte von Anlage, Bestätigung, letzter Anmeldung und letzter Mail zum Zurücksetzen sowie die Anmelde-Sitzungen. Daran ändern wir nichts. Diese Daten werden mit dem Konto gelöscht.

## Abläufe und Zugriffsregeln

### Die Login-Bremse (eine gemeinsame Prüfung für alle Passwortabfragen)

Jede Passwortprüfung (Login, aktuelles Passwort, Löschdialog) läuft durch denselben Baustein:

1. **Erst eintragen, dann zählen.** Der Server legt einen Eintrag `login_attempt` mit `pending` an und zählt danach die Einträge `pending` und `failed` der letzten 15 Minuten, einmal für diese E-Mail-Adresse und einmal für diese IP. Der eigene Eintrag zählt mit.
2. **Gesperrt**, wenn es für die Adresse **mehr als 5** Einträge sind (also schon 5 Fehlversuche vorlagen) oder für die IP **mehr als 20**. Der eigene Eintrag wird dann `blocked`, das Passwort wird **gar nicht geprüft**, und der Nutzer sieht „Zu viele Versuche. Bitte versuche es in X Minuten erneut.“ X ist die aufgerundete Zeit bis 15 Minuten nach dem jüngsten gezählten Fehlversuch, mindestens 1. Gilt die Sperre für Adresse und IP, zählt die längere Wartezeit. Ein abgelehnter Versuch verlängert die Sperre nicht (AC-23, AC-24).
3. **Sonst prüft Supabase das Passwort.** Ist es richtig, wird der Eintrag `succeeded`. Das gilt auch, wenn das Konto noch unbestätigt ist, denn das Passwort war ja richtig. Ist es falsch oder die Adresse unbekannt, wird der Eintrag `failed`. Ist Supabase nicht erreichbar, wird der Eintrag gelöscht und der Nutzer sieht die Verbindungs-Notice (EC-6).

Warum „erst eintragen, dann zählen“: Schickt ein Skript 50 Versuche gleichzeitig, sieht jeder einzelne die anderen schon als `pending` und wird abgelehnt. Würde erst gezählt und danach eingetragen, kämen alle 50 durch.

Die Sperre hängt nur an Adresse und IP, nie daran, ob es das Konto gibt. Deshalb verrät auch die Sperrmeldung nichts.

### Mail-Grenze und Registrierungs-Grenze

- **Mail-Grenze (AC-25):** Bei jeder Mail-Anforderung legt der Server zuerst einen Eintrag `mail_request` an und zählt dann die zugelassenen Einträge der letzten 60 Minuten für diese Adresse, den eigenen mitgezählt. Bei **mehr als 3** wird der Eintrag `blocked`, es geht keine Mail raus, und der Nutzer sieht „Bitte warte etwas, bevor du eine weitere Mail anforderst.“ Sonst wird er `allowed`. Gezählt wird **unabhängig davon, ob es das Konto gibt**.
- **Registrierungs-Grenze (AC-26):** Bei jeder Registrierung, die die Eingabeprüfung bestanden hat, legt der Server einen Eintrag `signup` (nur IP) an und zählt die zugelassenen der letzten 60 Minuten für diese IP. Bei **mehr als 5** sieht der Besucher „Zu viele Registrierungen. Bitte versuche es später erneut.“, und es passiert nichts weiter.

### Registrierung (AC-1, AC-2, AC-4, AC-5, AC-6, AC-26, EC-5, EC-8)

1. Der Server prüft die Eingaben mit Zod. Fehler gehen an die Felder zurück (AC-5).
2. Registrierungs-Grenze pro IP, danach Mail-Grenze pro Adresse.
3. Die Hilfsfunktion liefert den Kontostatus der Adresse:
   - `none`: Supabase legt das Konto an und verschickt die Bestätigungsmail. Die Datenbank legt dabei das Profil an (AC-4).
   - `unconfirmed`: Die Bestätigungsmail wird **erneut verschickt**, das Konto wird aber **nicht** neu registriert. So bleibt das erste Passwort garantiert unverändert (EC-8).
   - `confirmed`: Es passiert nichts, auch keine Mail (AC-6).
4. In allen drei Fällen zeigt die Seite denselben Zustand „Prüfe dein Postfach“ mit der eingegebenen Adresse.

„Konto anlegen“ ist gesperrt, solange die Anfrage läuft. Kommt ein Doppelklick trotzdem doppelt an, verhindert die Datenbank ein zweites Konto, weil jede Adresse nur einmal vorkommen darf. Supabase verschickt pro Konto höchstens eine Mail je 10 Sekunden (EC-5).

### E-Mail-Bestätigung und Links aus Mails (AC-3, AC-17, EC-1–EC-4)

- Die Mails (deutsche Vorlagen) enthalten einen Link auf `/auth/confirm` mit einem einmaligen Token und dem Typ (`email` für die Bestätigung, `recovery` für das Zurücksetzen).
- `/auth/confirm` akzeptiert nur diese beiden Typen und lässt Supabase das Token prüfen. Danach leitet es **immer** auf eine Adresse ohne Token weiter.
  - Bestätigung gültig → der Nutzer ist angemeldet → `/` (AC-3). Entsteht dabei ausnahmsweise keine Anmeldung → `/login?notice=email-confirmed` (EC-4).
  - Zurücksetzen gültig → angemeldet → `/reset-password`. Wurde der Link aber vor **mehr als 1 Stunde** angefordert (Supabase merkt sich den Zeitpunkt der letzten Mail zum Zurücksetzen), meldet der Server den Nutzer sofort wieder ab und schickt ihn zu `/auth/link-expired` (AC-17).
  - Ungültig, abgelaufen oder schon benutzt → `/auth/link-expired?type=signup` bzw. `?type=recovery` (EC-1, EC-2).
- **Gültigkeit:** Supabase kennt nur eine Laufzeit für alle Mail-Links. Wir setzen sie auf 24 Stunden (AC-3). Die kürzere Stunde für das Zurücksetzen erzwingt die App wie oben beschrieben.
- **Nur der neueste Link zum Zurücksetzen gilt (EC-3):** Supabase hält pro Konto genau ein gültiges Token dieser Art, jede neue Anforderung ersetzt das alte. `/qa` prüft das ausdrücklich.
- **Anderes Gerät (EC-4):** Weil das Token im Link selbst steckt und nicht an den Browser der Registrierung gebunden ist, funktioniert die Bestätigung in jedem Browser.
- `/auth/link-expired` bietet „Neue Mail anfordern“ an (E-Mail-Feld, Mail-Grenze). Bei `signup` wird die Bestätigungsmail erneut verschickt, aber nur für ein unbestätigtes Konto, bei `recovery` eine neue Mail zum Zurücksetzen. Die Rückmeldung ist immer neutral: „Falls es dazu ein Konto gibt, haben wir dir eine neue Mail geschickt.“ Daneben steht immer der Link „Zum Login“ (EC-1).

### Login (AC-7–AC-11, AC-23, AC-24, EC-10)

1. Eingaben prüfen, dann durch die Login-Bremse.
2. Ergebnis:
   - richtig → angemeldet → `/` (AC-7)
   - falsch oder Adresse unbekannt → „E-Mail oder Passwort ist falsch.“, die E-Mail-Adresse bleibt im Feld (AC-8)
   - richtig, aber unbestätigt → Hinweis „Bitte bestätige zuerst deine E-Mail-Adresse.“ mit „Mail erneut senden“ (Mail-Grenze) (AC-9). Supabase meldet „unbestätigt“ erst **nach** einem richtigen Passwort, das verrät also nichts.
3. **Angemeldet bleiben (AC-10):** Die Anmeldung erneuert sich bei jedem Aufruf von selbst und läuft nicht ab. Sie endet nur durch Abmelden, Zurücksetzen oder Ändern des Passworts oder Löschen des Kontos.
4. **Gesperrte Adresse (EC-10):** Der Link zum Zurücksetzen meldet den Besitzer direkt an, ohne Login-Formular. Die Sperre hält ihn deshalb nicht aus seinem Konto.

**Gleiche Antwortzeit:** Login, Registrierung, „Passwort vergessen“ und „Neue Mail anfordern“ antworten frühestens **500 ms** nach dem Abschicken. Eine unbekannte Adresse ist dadurch nicht an einer schnelleren Antwort zu erkennen.

### Zugriffsschutz (AC-11, AC-13–AC-15, AC-22, EC-9)

- **Vor jeder Anfrage** (Next.js-Proxy, `src/proxy.ts`): Die Anmeldung wird erneuert. Wer nicht angemeldet ist und eine nicht öffentliche Adresse aufruft, wird zu `/login` umgeleitet. Wer angemeldet ist und `/login`, `/register` oder `/forgot-password` aufruft, landet auf `/`. Öffentlich sind nur `/login`, `/register`, `/forgot-password`, `/auth/confirm`, `/auth/link-expired` und `/privacy`.
- **In jeder geschützten Seite** (Layout des angemeldeten Bereichs, außerdem `/reset-password` und `/account/export`): Der Server fragt Supabase direkt, ob die Anmeldung **noch gilt**. Er verlässt sich nicht nur auf das Cookie. Wurde sie auf einem anderen Gerät beendet (Passwort zurückgesetzt oder geändert, Konto gelöscht), geht es zu `/login?notice=session-ended` (EC-9).
- **In der Datenbank:** Row Level Security auf jeder Nutzertabelle, siehe Datenmodell (AC-14, AC-15).
- **Abmelden (AC-22):** Der Server beendet die Anmeldung auf diesem Gerät, verwirft zwischengespeicherte Seiten des angemeldeten Bereichs und leitet zu `/login`. Geschützte Seiten werden nie im Browser-Cache gespeichert, deshalb zeigt die Zurück-Taste nichts mehr an.

### Passwort vergessen und neu festlegen (AC-16–AC-18)

- `/forgot-password`: Eingaben prüfen, dann die Mail-Grenze. Danach bittet der Server Supabase, eine Mail zum Zurücksetzen zu verschicken. Supabase schickt sie nur, wenn es das Konto gibt, und antwortet in beiden Fällen gleich. Der Nutzer sieht immer „Falls es ein Konto zu dieser Adresse gibt, haben wir dir einen Link geschickt.“
- `/reset-password`: neues Passwort (Regeln oben). Der Server speichert es, meldet **alle anderen Geräte** ab und leitet zu `/` mit der Erfolgs-Notice „Passwort geändert“ (AC-17, AC-18). Ist das neue Passwort gleich dem alten, meldet Supabase das, und der Nutzer sieht „Das neue Passwort muss sich vom bisherigen unterscheiden.“

### Konto-Seite (AC-19–AC-21, AC-27–AC-29, EC-11, EC-12)

- **Passwort ändern:** aktuelles Passwort durch die Login-Bremse. Falsch → „Das aktuelle Passwort ist falsch.“, nichts ändert sich (AC-21). Richtig → neues Passwort speichern, alle anderen Geräte abmelden, dieses Gerät bleibt angemeldet, Erfolgs-Notice „Passwort geändert“ (AC-20). Gleiches Passwort → dieselbe Meldung wie beim Zurücksetzen.
- **Meine Daten exportieren (AC-29):** `/account/export` liefert eine Datei `petrilog-export-JJJJ-MM-TT.json` zum Herunterladen, nie aus dem Cache. Die Datei enthält eine Formatkennung (`petrilog-export`, Version 1), den Zeitpunkt des Exports, das Konto (E-Mail-Adresse, Registrierung, Bestätigung, letzte Anmeldung) und das Profil (Kennung, Anlage). Die Feldnamen sind englisch, wie im übrigen Code. PROJ-2 ergänzt die Datei um Sessions mit ihren Fängen.
- **Konto löschen (AC-27, AC-28, EC-11, EC-12):** Passwort durch die Login-Bremse. Falsch → „Das Passwort ist falsch.“, nichts wird gelöscht. Der Fehlversuch zählt zur Sperre. Richtig → der Server löscht das Auth-Konto mit dem Server-Schlüssel. Profil und alle anderen Nutzerdaten verschwinden automatisch mit (siehe Datenmodell). Danach werden die Anmelde-Cookies gelöscht, und es geht weiter zu `/login?notice=account-deleted`. Andere Geräte fliegen beim nächsten Seitenaufruf raus (EC-9).

### Wer darf was (Zusammenfassung)

| Aktion | Wer | Abgelehnt, wenn |
|---|---|---|
| Registrieren, Login, „Passwort vergessen“, neue Mail anfordern | jeder Besucher | Eingaben ungültig, eine Grenze ist erreicht, oder (Login, Registrierung) der Besucher ist schon angemeldet |
| Neues Passwort festlegen | nur mit Anmeldung aus dem Link zum Zurücksetzen oder regulär angemeldet | nicht angemeldet |
| Konto-Seite, Passwort ändern, Export, Löschen, Abmelden | nur angemeldet, immer nur fürs eigene Konto | nicht angemeldet, Anmeldung nicht mehr gültig, Passwort falsch, Sperre |
| Eigenes Profil lesen | angemeldeter Besitzer | jede andere Person |
| Protokoll der Login-Bremse, Kontostatus, Konto löschen (Datenbank) | nur der Next.js-Server mit dem Server-Schlüssel | jeder Aufruf aus dem Browser oder mit öffentlichem Schlüssel |

## Grundlagen, die PROJ-1 als erstes Feature mitbringt

- **Design-System anwenden:** Farben aus `docs/design-system.md` als Tokens in `src/app/globals.css` (hell und dunkel), die Schriften Zilla Slab, Barlow und IBM Plex Mono über `next/font`, die Sprache der Seite auf Deutsch (`lang="de"`), Titel und Beschreibung der App. PROJ-2 baut darauf auf.
- **Sicherheits-Header** in `next.config` nach `docs/stacks/framework-nextjs.md`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin` und `Strict-Transport-Security` mit `includeSubDomains`. Der Referrer-Schutz sorgt außerdem dafür, dass kein Token aus einem Mail-Link an fremde Seiten weitergegeben wird.
- **Startseite `/`:** ersetzt die Beispielseite von Next.js durch einen schlichten Platzhalter. Mit PROJ-2 wird sie zur Sessions-Übersicht.

## Wo die Teile liegen (für `/build`)

- `src/proxy.ts`: Anmeldung erneuern, Umleitungen
- `src/lib/supabase/admin.ts`: Supabase-Zugang mit Server-Schlüssel, nur auf dem Server nutzbar
- `src/lib/auth/`: Eingaberegeln, alle deutschen Meldungen an einer Stelle (damit gleiche Fälle garantiert gleich lauten), Login-Bremse, Mail- und Registrierungs-Grenze, Ermittlung der IP-Adresse, Server Actions
- `src/app/(auth)/`: Layout für Abgemeldete sowie `login`, `register`, `forgot-password`
- `src/app/(app)/`: Layout mit Anmeldeprüfung, Startseite `/`, `account/` mit dem Endpunkt `export`
- `src/app/auth/confirm` (Endpunkt), `src/app/auth/link-expired`, `src/app/reset-password`, `src/app/privacy`
- `src/components/auth/`: Passwortfeld, Formulare, „Prüfe dein Postfach“
- `src/components/account/`: Sheet „Passwort ändern“, Löschdialog, Zeilen der Konto-Seite
- `supabase/migrations/`: Profile samt automatischer Anlage und Row Level Security, Protokoll der Login-Bremse, Kontostatus-Funktion, Aufräumjobs
- `supabase/templates/`: deutsche Mailvorlagen (Bestätigung, Zurücksetzen)
- `supabase/config.toml`: siehe unten

## Einstellungen der lokalen Supabase (baut `/build` in `supabase/config.toml`)

| Einstellung | Wert | Warum | → AC |
|---|---|---|---|
| Adresse der App (`site_url`) | `http://localhost:3000`, als zusätzliche Weiterleitungsziele `http://localhost:3000/**` und `http://127.0.0.1:3000/**` | Mail-Links müssen auf dieselbe Adresse führen, unter der die App läuft. Sonst landet die Anmeldung in einem anderen Cookie-Bereich. | AC-3, AC-17 |
| E-Mail-Bestätigung | an | Produktentscheidung | AC-1, AC-9 |
| Mindestlänge Passwort | 8 | zweite Absicherung neben der App | AC-5 |
| Gültigkeit der Mail-Links | 24 Stunden (86 400 s) | Bestätigung; das Zurücksetzen verkürzt die App auf 1 Stunde | AC-3, AC-17 |
| Mindestabstand zwischen Mails pro Konto | 10 Sekunden | Doppelklick erzeugt keine zweite Mail | EC-5 |
| Supabase-eigene Grenzen für Mails, Anmeldungen und Link-Prüfungen | lokal großzügig (100 Mails pro Stunde; 100 Anmeldungen bzw. Link-Prüfungen pro 5 Minuten) | Lokal ist die Bremse der App die maßgebliche, und `/qa` misst sie. Die Supabase-Grenzen würden sonst vorher auslösen. | AC-23–AC-26 |
| Mailvorlagen Bestätigung und Zurücksetzen | deutsche Vorlagen mit Link auf `/auth/confirm` (Token + Typ). Betreff: „Bestätige deine E-Mail-Adresse für Petrilog“ bzw. „Neues Passwort für Petrilog“. Die Bestätigungsmail sagt zusätzlich: „Du hast dich nicht registriert? Dann ignoriere diese Mail.“ | Sprache und Link-Format | AC-1, AC-16 |

Die Änderungen greifen erst nach einem Neustart der lokalen Supabase (`supabase stop` und `supabase start`). Das erledigt `/build`.

## Abhängigkeiten (Pakete)

- `server-only`: sorgt beim Bauen für einen Fehler, falls der Zugang mit dem Server-Schlüssel versehentlich in Browser-Code landet

Sonst nichts Neues: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner` und die shadcn-Komponenten sind schon installiert.

## Einstellungen, die du selbst machst

| Einstellung | Wo | Wann | Wert | Warum | → AC |
| --- | --- | --- | --- | --- | --- |
| Server-Schlüssel der lokalen Supabase | `.env.local`, neue Zeile `SUPABASE_SERVICE_ROLE_KEY=…` (Platzhalter kommt in `.env.local.example`) | now | der „Secret key“ bzw. `service_role key`, den `supabase status` ausgibt. **Ohne** `NEXT_PUBLIC_` davor, er darf nie in den Browser. | Login-Bremse, Kontostatus und Konto-Löschung brauchen ihn | AC-23–AC-26, AC-28, AC-31, EC-8 |
| Server-Schlüssel des gehosteten Projekts | Umgebungsvariablen beim Hoster | go-live | aus dem gehosteten Supabase-Projekt → Settings → API | wie oben | wie oben |
| E-Mail-Bestätigung an, Mindestlänge 8, Link-Gültigkeit 24 h, Mindestabstand 10 s | gehostetes Supabase → Authentication → Sign In / Providers → Email (oder `supabase config push`, falls die CLI es kann) | go-live | wie in der Tabelle oben | Das gehostete Projekt liest `config.toml` nicht von selbst | AC-1, AC-3, AC-5, EC-5 |
| Site URL und Weiterleitungsziele | gehostetes Supabase → Authentication → URL Configuration | go-live | die Produktions-Adresse | Mail-Links müssen auf die echte App zeigen | AC-3, AC-17 |
| Deutsche Mailvorlagen | gehostetes Supabase → Authentication → Emails → Templates | go-live | Inhalt der Dateien in `supabase/templates/` | wie lokal | AC-1, AC-16 |
| Eigener Mail-Dienst (SMTP) | gehostetes Supabase → Authentication → Emails → SMTP Settings | go-live | Zugangsdaten des gewählten Dienstes (offene Frage in der Spec) | Der eingebaute Versand von Supabase schafft nur wenige Mails pro Stunde und nur an Team-Mitglieder | AC-1, AC-16 |
| Supabase-eigene Grenzen | gehostetes Supabase → Authentication → Rate Limits | go-live | Mails pro Stunde passend zum Mail-Dienst, sonst die Standardwerte | Supabase-Schutz als zweite Ebene | AC-23–AC-26 |
| AVV mit Supabase | Supabase → Organization Settings → Legal Documents | go-live | annehmen | Auftragsverarbeitung (`docs/privacy.md`) | — |

Für `/qa` blockiert nur die erste Zeile. Alle `go-live`-Zeilen sind Aufgaben für den ersten `/deploy`.

## Technische Entscheidungen

| Entscheidung | Begründung | Alternative | Nachteil | Datum |
| --- | --- | --- | --- | --- |
| Login-Bremse als Tabelle in der eigenen Datenbank | Kein neuer externer Dienst, kein weiterer Auftragsverarbeiter mit E-Mail- und IP-Adressen. Läuft lokal ohne Konto irgendwo. Aufgeräumt wird mit denselben Datenbank-Jobs. | Upstash Redis (Vorschlag des Stack-Packs) | Eine Datenbankabfrage mehr pro Login. Bei den erwarteten Nutzerzahlen unerheblich. | 2026-09-29 |
| Alle Passwortprüfungen und Mail-Anforderungen laufen über Server Actions statt direkt vom Browser zu Supabase | Nur so sitzt die eigene Bremse sicher im Weg, und Formulare schicken per POST | Browser spricht direkt mit Supabase, geschützt nur durch dessen Grenzen | Wer die öffentliche Supabase-Schnittstelle **direkt** aufruft, umgeht die App-Bremse. Dort greift nur die feste Grenze pro IP von Supabase. Lokal ist das kein Risiko, die App ist von außen nicht erreichbar. Geschlossen wird die Lücke vor dem Hosting durch das CAPTCHA von Supabase, das auch direkte Aufrufe verlangt (offene Frage in der Spec). | 2026-09-29 |
| Kein Hook von Supabase für Passwortversuche | Der Hook würde auch direkte Aufrufe pro Konto bremsen, gibt es aber nur in den Tarifen Team und Enterprise | Hook im Free-Plan | Siehe Zeile davor | 2026-09-29 |
| „Erst eintragen, dann zählen“ bei jeder Grenze | Gleichzeitige Versuche sehen sich gegenseitig, ein Schwall paralleler Anfragen kommt nicht durch | Erst zählen, dann eintragen | Im Extremfall wird bei gleichzeitigen Anfragen einer mehr abgelehnt als nötig. Das geht zulasten des Angreifers. | 2026-09-29 |
| Server-Schlüssel nur in einem einzigen Server-Baustein, abgesichert mit `server-only` | Bremse, Kontostatus und Löschen brauchen Rechte über die eigenen Daten hinaus. Ein einziger Ort lässt sich leicht prüfen. | Datenbankfunktionen, die auch anonyme Aufrufer nutzen dürfen | Der Schlüssel umgeht Row Level Security und muss geheim bleiben. Die Alternative hätte aber jedem erlaubt, Zähler zu manipulieren oder den Kontostatus fremder Adressen abzufragen. | 2026-09-29 |
| Registrierung fragt zuerst den Kontostatus ab und verschickt bei unbestätigten Konten nur die Mail erneut | Garantiert, dass das erste Passwort bleibt (EC-8) und ein bestätigtes Konto unberührt bleibt (AC-6), egal wie Supabase eine Doppel-Registrierung gerade behandelt (je nach Einstellung Schein-Antwort oder Fehler „User already registered“, bei unbestätigten Konten eventuell mit neuen Daten) | Immer die Registrierung von Supabase aufrufen | Eine Datenbankabfrage mehr pro Registrierung | 2026-09-29 |
| Mail-Links mit Token-Hash auf einen eigenen Server-Endpunkt `/auth/confirm` | Funktioniert in jedem Browser und auf jedem Gerät (EC-4), wird auf dem Server geprüft, das Token verschwindet sofort per Weiterleitung aus der Adresse | Code-Verfahren (PKCE) mit Rücksprung in denselben Browser | Das Token steht kurz in der Adresse des Mail-Links. Es gilt nur einmal, läuft ab und wird durch die Referrer-Regel nicht weitergegeben. | 2026-09-29 |
| Eine Link-Laufzeit von 24 h in Supabase, 1 h für das Zurücksetzen erzwingt die App | Supabase kennt nur eine Laufzeit für alle Mail-Links | Beide Links 24 h oder beide 1 h | Ein kleiner Prüfschritt mehr in `/auth/confirm` | 2026-09-29 |
| Geschützte Seiten fragen Supabase, ob die Anmeldung noch gilt; der Proxy prüft nur das Cookie | Beendete Anmeldungen auf anderen Geräten fallen beim nächsten Seitenaufruf auf (EC-9) | Nur das Cookie prüfen (schneller) | Eine Anfrage an Supabase pro Seitenaufruf | 2026-09-29 |
| Konto löschen über die Admin-Funktion von Supabase, alles andere per automatischem Mitlöschen in der Datenbank | Die Datenbank garantiert, dass nichts zurückbleibt, auch bei künftigen Tabellen (EC-12) | Jede Tabelle einzeln im Code löschen | Jede künftige Tabelle **muss** so an den Besitzer gebunden sein (steht verbindlich im Datenmodell) | 2026-09-29 |
| Aufräumen per stündlichem Datenbank-Job (pg_cron) | Läuft zuverlässig, auch wenn niemand die App benutzt. Ist lokal und im Free-Plan verfügbar. | Aufräumen bei jedem Login | Einträge können bis zu 1 Stunde länger als 24 h bzw. 7 Tage leben | 2026-09-29 |
| Aktuelles Passwort (Ändern, Löschen) per normaler Passwortprüfung durch die Bremse kontrollieren | Einheitlich gebremst (EC-11). Hängt nicht von einer Supabase-Einstellung für „aktuelles Passwort verlangen“ ab. | Parameter „aktuelles Passwort“ beim Speichern des neuen Passworts | Die Prüfung erneuert nebenbei die Anmeldung auf diesem Gerät. Das ist harmlos. | 2026-09-29 |
| Formulare mit react-hook-form + Zod im Browser, abgeschickt per Server Action aus dem Submit-Handler | Sofortige Fehler am Feld, POST, Eingaben bleiben bei Fehlern stehen (EC-6). Dieselben Zod-Regeln prüft der Server. | Reines Formular-Action-Verfahren von React | Etwas mehr Code pro Formular | 2026-09-29 |
| Mindestantwortzeit 500 ms für Login, Registrierung und Mail-Anforderungen | Ob eine Adresse existiert, lässt sich nicht an der Antwortzeit ablesen | Keine Angleichung | Jede dieser Aktionen dauert mindestens eine halbe Sekunde | 2026-09-29 |
| IP-Adresse aus dem ersten Eintrag von `x-forwarded-for`, sonst `unknown` | Standard hinter einem Hoster, der den Header setzt | Eigene Proxy-Konfiguration | Lokal haben alle Anfragen dieselbe bzw. keine IP. Die Grenze pro IP wirkt lokal also für alle zusammen. Ohne vertrauenswürdigen Proxy davor ließe sich der Header fälschen, beim Hosting prüfen. | 2026-09-29 |
| Protokoll-Einträge der Registrierung ohne E-Mail-Adresse | Für die Grenze pro IP wird die Adresse nicht gebraucht (Datensparsamkeit) | E-Mail mit speichern | keiner | 2026-09-29 |
| Design-System, Schriften und Sicherheits-Header kommen mit PROJ-1 | Erstes Feature mit Oberfläche. Die Header sind laut Sicherheitsregeln für jedes Web-Projekt Pflicht. | Später mit PROJ-2 | PROJ-1 wird etwas größer | 2026-09-29 |

## Offene Fragen

- [ ] Beim Hosting ruft der Next.js-Server Supabase Auth auf. Supabase sieht dann für alle Nutzer die IP des Servers, und die festen Supabase-Grenzen pro IP gelten für alle zusammen. Vor dem ersten `/deploy` klären, ob sich die echte IP weiterreichen lässt oder die Grenzen passend eingestellt werden müssen (auch in `spec.md` → Offene Fragen).
