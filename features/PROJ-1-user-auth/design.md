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
| `/reset-password` | „Neues Passwort festlegen“ | nur mit einer gültigen **Freigabe zum Festlegen** (entsteht beim Öffnen des Links aus der Mail, gilt 15 Minuten), angemeldet ohne Freigabe → `/account`, nicht angemeldet → `/login` | AC-17, AC-18, AC-33, EC-13 |
| `/privacy` | Datenschutzerklärung (Platzhaltertext) | alle, ohne Anmeldung | AC-30 |
| `/` | Startseite: Platzhalter bis PROJ-2, dann Sessions-Übersicht | nur angemeldet | AC-3, AC-7 |
| `/account` | Konto-Seite | nur angemeldet | AC-19–AC-22, AC-27–AC-29 |
| `/account/export` | Server-Endpunkt: liefert die Export-Datei zum Herunterladen | nur angemeldet | AC-29 |

**Hinweise auf der Login-Seite** kommen über einen kurzen Code in der Adresse, zum Beispiel `/login?notice=account-deleted`. Erlaubt sind nur `account-deleted` („Dein Konto wurde gelöscht.“), `session-ended` („Bitte melde dich erneut an.“) und `email-confirmed` („E-Mail-Adresse bestätigt. Bitte melde dich an.“). Unbekannte Codes werden ignoriert. Die Konto-Seite nimmt genauso genau einen Code an: `/account?notice=reset-expired` zeigt im Warnton „Die Zeit zum Festlegen ist abgelaufen. Ändere dein Passwort hier mit dem aktuellen Passwort oder melde dich ab und fordere über „Passwort vergessen“ einen neuen Link an.“ (EC-13). **Nie steht eine E-Mail-Adresse, ein Passwort oder ein Token in einer Adresse, die die App selbst erzeugt.** Deshalb zeigt `/register` den Zustand „Prüfe dein Postfach“ auf derselben Seite, statt mit der Adresse in der URL weiterzuleiten.

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
+-- Warn-Notice auf der Konto-Seite aus ?notice=reset-expired (bleibt stehen, bis der Nutzer die Seite verlässt)

Unbekannte Adresse (für alle, hell, ohne Rahmen)
+-- „Diese Seite gibt es nicht.“ mit Link „Zur Startseite“ (ersetzt die englische Standardseite von Next.js)
```

**Wiederverwendete shadcn/ui-Bausteine** (alle schon installiert): `input`, `button`, `label`, `form`, `alert` (Notices), `alert-dialog` (Löschdialog), `sheet` (Passwort ändern), `sonner` (Erfolgs-Notice), `separator`, `card`. Neu gebaut wird nur das **Passwortfeld mit Anzeige-Knopf**, zusammengesetzt aus `input` und `button`. Es ist keine eigene Variante einer shadcn-Komponente.

**Formulare:** Die Felder prüfen sofort im Browser (react-hook-form mit Zod) und zeigen die Fehlermeldung am Feld. Abgeschickt wird per Server Action aus dem Submit-Handler, also immer als POST und ohne dass die Felder geleert werden. Dieselben Zod-Regeln prüft der Server noch einmal (AC-5). Die Eingabefelder bekommen passende Angaben für Tastatur und Autofill: bei der E-Mail die E-Mail-Tastatur, keine automatische Großschreibung und `autocomplete=email`; beim Passwort `current-password` bzw. `new-password`, damit Passwort-Manager funktionieren.

## Eingaberegeln (gemeinsam für Browser und Server)

- **E-Mail-Adresse:** Leerzeichen am Anfang und Ende werden entfernt, alles wird kleingeschrieben (EC-7). Pflichtfeld, gültiges Format, höchstens 254 Zeichen. Fehlermeldung: „Bitte gib eine gültige E-Mail-Adresse ein.“
- **Neues Passwort** (Registrierung, Zurücksetzen, Ändern): mindestens 8 **Zeichen** und höchstens 72 **Bytes** in UTF-8-Kodierung (AC-34). 72 Bytes ist die technische Obergrenze des Passwort-Hashings. Ein einfaches Zeichen ist 1 Byte, ein Umlaut 2, ein Emoji 4. Keine Pflicht-Zeichenklassen, Leerzeichen erlaubt, nichts wird abgeschnitten. Meldungen: „Das Passwort muss mindestens 8 Zeichen haben.“ bzw. „Das Passwort ist zu lang. Erlaubt sind 72 Zeichen, Umlaute und Emojis zählen mehrfach.“ Weil die Eingabeprüfung vor jeder Grenze läuft, verbraucht ein zu langes Passwort kein Kontingent (AC-34).
- **Bestehendes Passwort** (Login, aktuelles Passwort, Löschdialog): nur Pflichtfeld, höchstens 72 Bytes. Ein längeres wird ohne Prüfung bei Supabase wie ein falsches behandelt („E-Mail oder Passwort ist falsch.“ bzw. „Das aktuelle Passwort ist falsch.“), zählt aber als Fehlversuch zur Bremse. Die Mindestlänge wird hier nicht geprüft, sonst würde die Meldung Hinweise über das Passwort geben.
- **Kaputte Anfragen** (eine Server Action bekommt statt eines Formulars z. B. nichts oder eine Liste): Die Antwort ist die allgemeine Meldung „Bitte prüfe deine Eingaben.“, nie ein roher englischer Text der Prüfbibliothek.

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
- **ip**: IP-Adresse des Aufrufers, höchstens 45 Zeichen. Sie kommt nur aus einer vertrauenswürdigen Quelle (Abschnitt „IP-Adresse des Aufrufers“), sonst steht dort `untrusted`.
- **outcome**: Ergebnis, Pflicht, einer von:
  - `pending`: Prüfung läuft. Zählt wie ein Fehlversuch, solange sie läuft.
  - `failed`: falsches Passwort oder unbekannte Adresse
  - `succeeded`: Passwort richtig. Dazu zählt auch „richtig, aber Konto noch nicht bestätigt“.
  - `allowed`: Mail bzw. Registrierung wurde zugelassen
  - `blocked`: wegen einer Sperre abgelehnt. Zählt nie mit.
  - `duplicate`: nur bei `mail_request`. Dieselbe Mail wurde für diese Adresse in den letzten 10 Sekunden schon zugelassen (Doppel-Tipp, EC-5). Es geht keine zweite Mail raus, und der Eintrag zählt nicht zur Mail-Grenze.
- **created_at**: Zeitpunkt, Pflicht, automatisch.

- **Zugriff:** **Kein** Nutzer und kein anonymer Aufrufer darf lesen oder schreiben: Row Level Security ist an, es gibt keine Regeln, und alle Rechte für die öffentlichen Rollen sind entzogen. Nur der Next.js-Server greift mit dem Server-Schlüssel darauf zu.
- **Suchpfade:** Die Tabelle wird nach (Art, E-Mail, Zeitpunkt) und (Art, IP, Zeitpunkt) abgefragt. Für beide gibt es einen Index.
- **Gespeichert bis:** höchstens 24 Stunden. Ein stündlicher Aufräumjob löscht ältere Einträge (AC-31).

### Hilfsfunktion „Kontostatus einer Adresse“ (neu, nur für den Server)

Eine Datenbankfunktion bekommt eine normalisierte E-Mail-Adresse und antwortet mit einem von drei Werten: `none` (kein Konto), `unconfirmed` (Konto, noch nicht bestätigt) oder `confirmed` (bestätigtes Konto). Aufrufen darf sie **nur** der Server mit dem Server-Schlüssel. Für anonyme und angemeldete Rollen ist sie gesperrt, sonst wäre sie ein Werkzeug, um herauszufinden, wer ein Konto hat. Sie wird nur bei der Registrierung gebraucht (EC-8).

### Hilfsfunktion „Mail-Freigabe“ (neu, nur für den Server)

Eine Datenbankfunktion entscheidet über jede Mail-Anforderung in **einem** Schritt. Sie bekommt die normalisierte E-Mail-Adresse und die IP und hält während der Entscheidung eine Sperre **pro Adresse**, sodass zwei gleichzeitige Anforderungen für dieselbe Adresse nacheinander drankommen. In diesem Schritt:
1. Gibt es für die Adresse einen zugelassenen Eintrag `mail_request`, der jünger als 10 Sekunden ist, wird ein Eintrag `duplicate` angelegt, und die Antwort lautet **„schon unterwegs“**.
2. Sonst: Gibt es in den letzten 60 Minuten schon 3 zugelassene Einträge, wird ein Eintrag `blocked` angelegt, und die Antwort lautet **„Grenze erreicht“** (AC-25).
3. Sonst wird ein Eintrag `allowed` angelegt, und die Antwort lautet **„senden“**.

Aufrufen darf sie **nur** der Server mit dem Server-Schlüssel, wie die Kontostatus-Funktion. Das ist die Garantie hinter EC-5: Bei einem Doppel-Tipp bekommt genau eine Anforderung „senden“.

### Freigabe zum Festlegen eines neuen Passworts (neu, am Auth-Konto)

Kein eigener Tabelleneintrag, sondern ein Vermerk in den **App-Metadaten** des Supabase-Auth-Kontos. Diese kann nur der Server mit dem Server-Schlüssel schreiben, der Nutzer selbst kann sie nicht ändern.
- **password_reset.session_id**: Kennung der Anmeldung, die beim Öffnen des Links entstanden ist (Text, Pflicht). Die Freigabe gilt nur für diese Anmeldung, also nur auf diesem Gerät und in diesem Browser.
- **password_reset.expires_at**: Zeitpunkt, Pflicht, 15 Minuten nach dem Öffnen des Links.
- **Angelegt:** von `/auth/confirm`, wenn ein gültiger Link zum Zurücksetzen geöffnet wird. Eine neue Freigabe überschreibt die alte.
- **Entfernt:** sobald das neue Passwort gespeichert ist. Ist sie beim Aufruf abgelaufen, wird sie ebenfalls entfernt. Mit dem Konto verschwindet sie ohnehin (AC-28).
- **Gespeichert bis:** höchstens bis zur nächsten Nutzung von `/reset-password` oder bis zur Löschung des Kontos. Sie enthält keine personenbezogenen Daten außer dem Bezug zum eigenen Konto.

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
2. **Gesperrt**, wenn es für die Adresse **mehr als 5** Einträge sind (also schon 5 Fehlversuche vorlagen) oder für die IP **mehr als 20**. Der eigene Eintrag wird dann `blocked`, das Passwort wird **gar nicht geprüft**, und der Nutzer sieht „Zu viele Versuche. Bitte versuche es in X Minuten erneut.“ Gilt die Sperre für Adresse und IP, zählt die längere Wartezeit. Ein abgelehnter Versuch verlängert die Sperre nicht (AC-23, AC-24).
   - **So wird X berechnet:** Grundlage ist der jüngste Eintrag `failed` der letzten 15 Minuten, der eigene nicht mitgezählt. X ist die aufgerundete Zeit bis 15 Minuten danach, mindestens 1 und höchstens 15. Ein Zeitstempel in der Zukunft (gleichzeitige Anfragen) zählt als „jetzt“.
   - **Kommt die Sperre nur durch gleichzeitig laufende Prüfungen zustande** (es gibt noch keinen `failed`-Eintrag, etwa bei einem Schwall paralleler Anfragen), ist X = 1. Die Sperre ist in diesem Fall nur so lang, wie die anderen Prüfungen laufen, und die Meldung verspricht nichts anderes.
3. **Sonst prüft Supabase das Passwort.** Ist es richtig, wird der Eintrag `succeeded`. Das gilt auch, wenn das Konto noch unbestätigt ist, denn das Passwort war ja richtig. Ist es falsch oder die Adresse unbekannt, wird der Eintrag `failed`. Ist Supabase nicht erreichbar, wird der Eintrag gelöscht und der Nutzer sieht die Verbindungs-Notice (EC-6).

Warum „erst eintragen, dann zählen“: Schickt ein Skript 50 Versuche gleichzeitig, sieht jeder einzelne die anderen schon als `pending` und wird abgelehnt. Würde erst gezählt und danach eingetragen, kämen alle 50 durch.

Die Sperre hängt nur an Adresse und IP, nie daran, ob es das Konto gibt. Deshalb verrät auch die Sperrmeldung nichts.

### Mail-Grenze und Registrierungs-Grenze

- **Mail-Grenze (AC-25, EC-5):** Jede Mail-Anforderung fragt die Hilfsfunktion „Mail-Freigabe“ (siehe Datenmodell).
  - „senden“ → die Mail wird angefordert.
  - „schon unterwegs“ → es geht keine Mail raus. Der Nutzer sieht **dieselbe Erfolgsmeldung** wie bei „senden“, denn die erste Mail kommt ja an.
  - „Grenze erreicht“ → keine Mail, der Nutzer sieht „Bitte warte etwas, bevor du eine weitere Mail anforderst.“
  
  Gezählt wird **unabhängig davon, ob es das Konto gibt**. Das gilt für alle vier Wege: Registrierung, „Mail erneut senden“, „Passwort vergessen“ und „Neue Mail anfordern“.
- **Registrierungs-Grenze (AC-26):** Bei jeder Registrierung, die die Eingabeprüfung bestanden hat, legt der Server einen Eintrag `signup` (nur IP) an und zählt die zugelassenen der letzten 60 Minuten für diese IP. Bei **mehr als 5** sieht der Besucher „Zu viele Registrierungen. Bitte versuche es später erneut.“, und es passiert nichts weiter.

### IP-Adresse des Aufrufers (AC-24, AC-26)

Die Grenzen pro IP helfen nur, wenn der Aufrufer die IP nicht selbst bestimmen kann. Ein Header wie `x-forwarded-for` kommt aber vom Aufrufer, solange kein Proxy davor ihn überschreibt. Deshalb gilt:

- **Eine neue Einstellung `TRUSTED_CLIENT_IP_HEADER`** (Umgebungsvariable, nur Server, ohne `NEXT_PUBLIC_`) nennt den **einen** Header, den der Hoster garantiert selbst setzt. Beispiele: `x-real-ip` oder `x-vercel-forwarded-for`.
- **Leer oder nicht gesetzt (Standard, auch lokal):** Die App traut **keinem** Header. Alle Anfragen zählen unter derselben IP `untrusted`. Die Grenzen pro IP wirken dann für alle zusammen, also streng, aber nicht umgehbar. Lokal mit einem Nutzer ist das ohne Folgen.
- **Gesetzt:** Der Wert dieses Headers ist die IP. Ist es `x-forwarded-for`, zählt der **letzte** Eintrag, also der, den der Proxy selbst angehängt hat, nie der erste. Fehlt der Header oder ist er leer, gilt `untrusted`.
- Die Einstellung kommt mit einem Platzhalter (leer) in `.env.local.example`. Welcher Wert beim Hoster stimmt, wird beim ersten `/deploy` festgelegt (Einstellungen unten).
- **Für `/qa`:** AC-24 und AC-26 werden mit gesetztem `TRUSTED_CLIENT_IP_HEADER=x-forwarded-for` geprüft (simuliert einen Proxy). Zusätzlich wird geprüft, dass ohne die Einstellung ein gefälschter Header die Grenze nicht umgeht.

### Registrierung (AC-1, AC-2, AC-4, AC-5, AC-6, AC-26, EC-5, EC-8)

1. Der Server prüft die Eingaben mit Zod. Fehler gehen an die Felder zurück (AC-5).
2. Registrierungs-Grenze pro IP, danach Mail-Grenze pro Adresse.
3. Die Hilfsfunktion liefert den Kontostatus der Adresse:
   - `none`: Supabase legt das Konto an und verschickt die Bestätigungsmail. Die Datenbank legt dabei das Profil an (AC-4).
   - `unconfirmed`: Die Bestätigungsmail wird **erneut verschickt**, das Konto wird aber **nicht** neu registriert. So bleibt das erste Passwort garantiert unverändert (EC-8).
   - `confirmed`: Es passiert nichts, auch keine Mail (AC-6).
4. In allen drei Fällen zeigt die Seite denselben Zustand „Prüfe dein Postfach“ mit der eingegebenen Adresse.

„Konto anlegen“ ist gesperrt, solange die Anfrage läuft. Kommt ein Doppelklick trotzdem doppelt an, verhindert die Datenbank ein zweites Konto, weil jede Adresse nur einmal vorkommen darf. Die zweite Anfrage bekommt von der Mail-Freigabe „schon unterwegs“ und verschickt keine Mail (EC-5).

**Zwei gleichzeitige Registrierungen derselben neuen Adresse:** Beide sehen den Kontostatus `none`, aber nur eine legt das Konto an. Die andere bekommt von Supabase einen Fehler (je nach Zeitpunkt „schon registriert“ oder ein allgemeiner Datenbankfehler beim Anlegen). Bei **jedem** Fehler beim Anlegen fragt der Server den Kontostatus noch einmal ab. Gibt es das Konto jetzt, sieht auch der zweite Besucher „Prüfe dein Postfach“ (AC-1, AC-6). Nur wenn es weiterhin kein Konto gibt, erscheint die Verbindungs-Notice.

### E-Mail-Bestätigung und Links aus Mails (AC-3, AC-17, EC-1–EC-4)

- Die Mails (deutsche Vorlagen) enthalten einen Link auf `/auth/confirm` mit einem einmaligen Token und dem Typ (`email` für die Bestätigung, `recovery` für das Zurücksetzen).
- `/auth/confirm` akzeptiert nur diese beiden Typen und lässt Supabase das Token prüfen. Danach leitet es **immer** auf eine Adresse ohne Token weiter.
  - Bestätigung gültig → der Nutzer ist angemeldet → `/` (AC-3). Entsteht dabei ausnahmsweise keine Anmeldung → `/login?notice=email-confirmed` (EC-4).
  - Zurücksetzen gültig → angemeldet → der Server legt die **Freigabe zum Festlegen** an (Kennung dieser neuen Anmeldung, gültig 15 Minuten) → `/reset-password`. Wurde der Link aber vor **mehr als 1 Stunde** angefordert (Supabase merkt sich den Zeitpunkt der letzten Mail zum Zurücksetzen), meldet der Server den Nutzer sofort wieder ab, legt keine Freigabe an und schickt ihn zu `/auth/link-expired` (AC-17). Lässt sich die Freigabe nicht speichern, wird der Nutzer ebenfalls abgemeldet und sieht die Verbindungs-Notice auf `/auth/link-expired`.
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
- `/reset-password` prüft **beim Öffnen und noch einmal beim Abschicken** die Freigabe zum Festlegen (AC-33):
  - **gültig** heißt: Die Freigabe existiert, ist noch nicht abgelaufen, und ihre Anmeldungskennung ist die der aktuellen Anmeldung. Die Kennung liest der Server aus der geprüften Anmeldung, nie aus einer Eingabe des Browsers.
  - **gültig** → Formular bzw. neues Passwort speichern (Regeln oben). Der Server speichert es, entfernt die Freigabe, meldet **alle anderen Geräte** ab und leitet zu `/` mit der Erfolgs-Notice „Passwort geändert“ (AC-17, AC-18). Ist das neue Passwort gleich dem alten, meldet Supabase das, und der Nutzer sieht „Das neue Passwort muss sich vom bisherigen unterscheiden.“ Die Freigabe bleibt dann bestehen.
  - **abgelaufen** (sie existiert für diese Anmeldung, die 15 Minuten sind aber um) → nichts wird gespeichert, die Freigabe wird entfernt, weiter zu `/account?notice=reset-expired` (EC-13).
  - **keine Freigabe für diese Anmeldung** (regulär angemeldet, oder die Freigabe gehört zu einem anderen Gerät) → nichts wird gespeichert, weiter zu `/account` ohne Hinweis (AC-33).
  - **nicht angemeldet** → `/login` wie bisher.
- **Zweite Absicherung in Supabase:** „Sicherer Passwortwechsel“ ist an. Supabase lässt dann ein neues Passwort nur für eine Anmeldung zu, die jünger als 24 Stunden ist. Wer die Supabase-Schnittstelle direkt aufruft, kann das Passwort also mit einer älteren Anmeldung nicht ohne neue Anmeldung ändern. Unsere eigenen Wege sind davon nicht betroffen: Beim Zurücksetzen ist die Anmeldung gerade entstanden, und „Passwort ändern“ meldet den Nutzer bei der Prüfung des aktuellen Passworts ohnehin neu an. Ganz geschlossen ist der direkte Weg damit nicht. Das gehört zur Deploy-Sperre der Spec. **`/build` prüft ausdrücklich**, dass „Passwort ändern“ auch mit einer Anmeldung funktioniert, die älter als 24 Stunden ist (Zeitpunkt der Anmeldung in der lokalen Datenbank zurückdatieren). Dafür muss das Speichern die Anmeldung aus der gerade erfolgten Passwortprüfung verwenden.

### Konto-Seite (AC-19–AC-21, AC-27–AC-29, EC-11, EC-12)

- **Passwort ändern:** aktuelles Passwort durch die Login-Bremse. Falsch → „Das aktuelle Passwort ist falsch.“, nichts ändert sich (AC-21). Richtig → neues Passwort speichern, alle anderen Geräte abmelden, dieses Gerät bleibt angemeldet, Erfolgs-Notice „Passwort geändert“ (AC-20). Gleiches Passwort → dieselbe Meldung wie beim Zurücksetzen.
- **Meine Daten exportieren (AC-29):** `/account/export` liefert eine Datei `petrilog-export-JJJJ-MM-TT.json` zum Herunterladen, nie aus dem Cache. Die Datei enthält eine Formatkennung (`petrilog-export`, Version 1), den Zeitpunkt des Exports, das Konto (E-Mail-Adresse, Registrierung, Bestätigung, letzte Anmeldung) und das Profil (Kennung, Anlage). Die Feldnamen sind englisch, wie im übrigen Code. PROJ-2 ergänzt die Datei um Sessions mit ihren Fängen.
- **Konto löschen (AC-27, AC-28, EC-11, EC-12):** Passwort durch die Login-Bremse. Falsch → „Das Passwort ist falsch.“, nichts wird gelöscht. Der Fehlversuch zählt zur Sperre. Richtig → der Server löscht das Auth-Konto mit dem Server-Schlüssel. Profil und alle anderen Nutzerdaten verschwinden automatisch mit (siehe Datenmodell). Danach werden die Anmelde-Cookies gelöscht, und es geht weiter zu `/login?notice=account-deleted`. Andere Geräte fliegen beim nächsten Seitenaufruf raus (EC-9).

### Wer darf was (Zusammenfassung)

| Aktion | Wer | Abgelehnt, wenn |
|---|---|---|
| Registrieren, Login, „Passwort vergessen“, neue Mail anfordern | jeder Besucher | Eingaben ungültig, eine Grenze ist erreicht, oder (Login, Registrierung) der Besucher ist schon angemeldet |
| Neues Passwort festlegen (ohne aktuelles Passwort) | nur mit gültiger Freigabe zum Festlegen: Link zum Zurücksetzen vor höchstens 15 Minuten geöffnet, in genau dieser Anmeldung | nicht angemeldet, keine Freigabe für diese Anmeldung, Freigabe abgelaufen |
| Freigabe zum Festlegen anlegen, lesen, entfernen | nur der Next.js-Server mit dem Server-Schlüssel | jeder Aufruf aus dem Browser (App-Metadaten sind für Nutzer nicht schreibbar) |
| Mail-Freigabe (Datenbank) | nur der Next.js-Server mit dem Server-Schlüssel | jeder Aufruf aus dem Browser oder mit öffentlichem Schlüssel |
| Konto-Seite, Passwort ändern, Export, Löschen, Abmelden | nur angemeldet, immer nur fürs eigene Konto | nicht angemeldet, Anmeldung nicht mehr gültig, Passwort falsch, Sperre |
| Eigenes Profil lesen | angemeldeter Besitzer | jede andere Person |
| Protokoll der Login-Bremse, Kontostatus, Konto löschen (Datenbank) | nur der Next.js-Server mit dem Server-Schlüssel | jeder Aufruf aus dem Browser oder mit öffentlichem Schlüssel |

## Grundlagen, die PROJ-1 als erstes Feature mitbringt

- **Design-System anwenden:** Farben aus `docs/design-system.md` als Tokens in `src/app/globals.css` (hell und dunkel), die Schriften Zilla Slab, Barlow und IBM Plex Mono über `next/font`, die Sprache der Seite auf Deutsch (`lang="de"`), Titel und Beschreibung der App. PROJ-2 baut darauf auf.
- **Sicherheits-Header** in `next.config` nach `docs/stacks/framework-nextjs.md`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin` und `Strict-Transport-Security` mit `includeSubDomains`. Der Referrer-Schutz sorgt außerdem dafür, dass kein Token aus einem Mail-Link an fremde Seiten weitergegeben wird.
- **Startseite `/`:** ersetzt die Beispielseite von Next.js durch einen schlichten Platzhalter. Mit PROJ-2 wird sie zur Sessions-Übersicht.
- **Deutsche Seite für unbekannte Adressen:** ersetzt „404: This page could not be found.“ durch „Diese Seite gibt es nicht.“ mit Link zur Startseite. Nicht angemeldete Besucher landen wie bisher schon vorher beim Login (AC-13). Gilt app-weit, auch für PROJ-2.

## Wo die Teile liegen (für `/build`)

- `src/proxy.ts`: Anmeldung erneuern, Umleitungen
- `src/lib/supabase/admin.ts`: Supabase-Zugang mit Server-Schlüssel, nur auf dem Server nutzbar
- `src/lib/auth/`: Eingaberegeln, alle deutschen Meldungen an einer Stelle (damit gleiche Fälle garantiert gleich lauten), Login-Bremse, Mail- und Registrierungs-Grenze, Ermittlung der IP-Adresse, Server Actions
- `src/app/(auth)/`: Layout für Abgemeldete sowie `login`, `register`, `forgot-password`
- `src/app/(app)/`: Layout mit Anmeldeprüfung, Startseite `/`, `account/` mit dem Endpunkt `export`
- `src/app/auth/confirm` (Endpunkt), `src/app/auth/link-expired`, `src/app/reset-password`, `src/app/privacy`, `src/app/not-found.tsx` (deutsche Seite für unbekannte Adressen)
- `src/lib/auth/`: dazu die Freigabe zum Festlegen (anlegen, prüfen, entfernen) an einer Stelle, genutzt von `/auth/confirm`, der Seite `/reset-password` und ihrer Server Action
- `src/components/auth/`: Passwortfeld, Formulare, „Prüfe dein Postfach“
- `src/components/account/`: Sheet „Passwort ändern“, Löschdialog, Zeilen der Konto-Seite
- `supabase/migrations/`: Profile samt automatischer Anlage und Row Level Security, Protokoll der Login-Bremse, Kontostatus-Funktion, Aufräumjobs. **Neue Migration** (die vorhandenen bleiben unverändert): Ergebnis `duplicate` im Protokoll erlauben und die Funktion „Mail-Freigabe“ anlegen, nur für den Server aufrufbar
- `supabase/templates/`: deutsche Mailvorlagen (Bestätigung, Zurücksetzen)
- `supabase/config.toml`: siehe unten

## Einstellungen der lokalen Supabase (baut `/build` in `supabase/config.toml`)

| Einstellung | Wert | Warum | → AC |
|---|---|---|---|
| Adresse der App (`site_url`) | `http://localhost:3553`, als zusätzliche Weiterleitungsziele `http://localhost:3553/**` und `http://127.0.0.1:3553/**` (Petrilog läuft fest auf Port 3553, damit es nicht mit anderen lokalen Projekten auf 3000/3001 kollidiert) | Mail-Links müssen auf dieselbe Adresse führen, unter der die App läuft. Sonst landet die Anmeldung in einem anderen Cookie-Bereich. | AC-3, AC-17 |
| E-Mail-Bestätigung | an | Produktentscheidung | AC-1, AC-9 |
| Mindestlänge Passwort | 8 | zweite Absicherung neben der App | AC-5 |
| Gültigkeit der Mail-Links | 24 Stunden (86 400 s) | Bestätigung; das Zurücksetzen verkürzt die App auf 1 Stunde | AC-3, AC-17 |
| Mindestabstand zwischen Mails pro Konto | 10 Sekunden | Zweite Ebene hinter der Mail-Freigabe. Greift allein bei gleichzeitigen Anfragen nicht zuverlässig (QA, BUG-4). | EC-5 |
| Sicherer Passwortwechsel (`secure_password_change`) | an | Neues Passwort nur mit einer Anmeldung, die jünger als 24 Stunden ist. Zweite Ebene hinter der Freigabe zum Festlegen. | AC-21, AC-33 |
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
| Sicherer Passwortwechsel | gehostetes Supabase → Authentication → Sign In / Providers → Email → „Secure password change“ | go-live | an | wie lokal | AC-21, AC-33 |
| Vertrauenswürdiger IP-Header | Umgebungsvariablen beim Hoster: `TRUSTED_CLIENT_IP_HEADER` | go-live | der Header, den der gewählte Hoster selbst setzt und nicht vom Aufrufer übernimmt (vorher in dessen Doku prüfen). Ohne passenden Header leer lassen. | Grenzen pro IP wirken nur mit einer IP, die der Aufrufer nicht fälschen kann | AC-24, AC-26 |
| **Deploy-Sperre: Schutz des direkten Wegs zu Supabase** | kein Schalter, sondern `/refine PROJ-1` vor dem ersten `/deploy` (CAPTCHA von Supabase unter Authentication → Attack Protection samt Widget in den Formularen, dazu die Frage nach der echten IP hinter dem Server) | go-live | erledigt, wenn der direkte Weg zu Supabase gegen Durchprobieren und Massen-Registrierung geschützt ist | Spec → Technische Anforderungen → Deploy-Sperre | AC-23–AC-26 |

Für `/qa` blockiert nur die erste Zeile. Alle `go-live`-Zeilen sind Aufgaben für den ersten `/deploy`, und `/deploy` liefert nicht aus, solange eine davon offen ist. Das gilt besonders für die Deploy-Sperre.

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
| IP-Adresse nur aus dem Header, den `TRUSTED_CLIENT_IP_HEADER` nennt, sonst `untrusted`. **Ersetzt** am 2026-09-29 (nach QA, BUG-1) die frühere Entscheidung „erster Eintrag von `x-forwarded-for`, sonst `unknown`“. | Der erste Eintrag von `x-forwarded-for` kommt vom Aufrufer und ließ sich fälschen: Die Grenzen pro IP waren damit wirkungslos. Welcher Header vertrauenswürdig ist, hängt vom Hoster ab, deshalb ist er eine Einstellung. Next.js 16 gibt die IP der Verbindung selbst nicht heraus. | Weiter dem ersten Eintrag trauen und das erst beim Hosting prüfen | Ohne Einstellung (lokal) teilen sich alle Anfragen eine IP. 20 fremde Fehlversuche sperren dann alle für 15 Minuten, und 5 Registrierungen pro Stunde gelten für alle zusammen. Lokal mit einem Nutzer unerheblich, `/qa` setzt die Einstellung für die Prüfung. | 2026-09-29 |
| Freigabe zum Festlegen als Vermerk in den App-Metadaten des Auth-Kontos, gebunden an die Anmeldungskennung, 15 Minuten gültig, nach Nutzung entfernt (AC-33, EC-13) | App-Metadaten kann nur der Server schreiben. Es braucht keine neue Tabelle und keinen Aufräumjob, und mit dem Konto verschwindet der Vermerk automatisch. Die Bindung an die Anmeldung verhindert, dass ein anderes Gerät die Freigabe nutzt. | (a) Anmeldeart aus der Anmeldung selbst ablesen (Supabase vermerkt „per Mail-Code angemeldet“ mit Zeitpunkt). (b) Eigene Tabelle. (c) Signiertes Cookie mit eigenem Geheimschlüssel. | Ein Schreibzugriff mit dem Server-Schlüssel beim Öffnen des Links. (a) wurde verworfen, weil der Link zur E-Mail-Bestätigung dieselbe Anmeldeart erzeugt und sich damit nicht vom Link zum Zurücksetzen unterscheiden ließe. | 2026-09-29 |
| „Sicherer Passwortwechsel“ von Supabase an (neue Passwörter nur mit einer Anmeldung, die jünger als 24 h ist) | Schränkt auch den direkten Weg zu Supabase ein, ohne unsere eigenen Wege zu stören | Supabase-Einstellung „aktuelles Passwort verlangen“ | Schließt den direkten Weg nicht ganz (Anmeldungen jünger als 24 h). Die Einstellung „aktuelles Passwort verlangen“ lässt sich in der lokalen Konfiguration nicht setzen und bleibt Teil der Deploy-Sperre. | 2026-09-29 |
| Mail-Freigabe als eine Datenbankfunktion mit Sperre pro Adresse; eine zweite Mail innerhalb von 10 s wird als `duplicate` verworfen (EC-5, AC-25) | Garantie hinter EC-5: Gleichzeitige Anforderungen kommen nacheinander dran, genau eine bekommt „senden“. Zählen und Eintragen passieren im selben Schritt. Der 10-Sekunden-Abstand von Supabase griff bei gleichzeitigen Anfragen nicht (QA, BUG-4). | Weiter „erst eintragen, dann zählen“ im App-Code | Eine Datenbankfunktion mehr. Wer innerhalb von 10 s absichtlich eine zweite Mail will, bekommt keine, sieht aber „Mail gesendet“, und die erste kommt an. | 2026-09-29 |
| Bei jedem Fehler beim Anlegen eines Kontos den Kontostatus erneut abfragen (QA, BUG-6) | Zwei gleichzeitige Registrierungen derselben Adresse zeigen beide „Prüfe dein Postfach“, egal welchen Fehler Supabase dem Verlierer meldet | Nur den Fehlercode „schon registriert“ abfangen | Eine Datenbankabfrage mehr, nur im Fehlerfall | 2026-09-29 |
| Neue Passwörter höchstens 72 Bytes statt 72 Zeichen (AC-34) | Das ist die tatsächliche Grenze des Passwort-Hashes. Bei Umlauten und Emojis lehnte Supabase sonst ab, und der Nutzer sah „Keine Verbindung“. | Weiter Zeichen zählen und die Supabase-Ablehnung übersetzen | Die Meldung muss erklären, dass Umlaute mehrfach zählen | 2026-09-29 |
| Wartezeit der Sperre nur aus echten Fehlversuchen berechnen, höchstens 15 Minuten; eine Sperre nur durch gleichzeitige Prüfungen meldet 1 Minute (QA, BUG-5) | Die Meldung soll stimmen. Der Schutz selbst bleibt unverändert. | Wartezeit aus allen gezählten Einträgen | keiner | 2026-09-29 |
| Deutsche Seite für unbekannte Adressen und eine allgemeine deutsche Meldung für kaputte Anfragen (QA, BUG-8) | Technische Anforderung „alle Texte auf Deutsch“ | — | keiner | 2026-09-29 |
| Protokoll-Einträge der Registrierung ohne E-Mail-Adresse | Für die Grenze pro IP wird die Adresse nicht gebraucht (Datensparsamkeit) | E-Mail mit speichern | keiner | 2026-09-29 |
| Design-System, Schriften und Sicherheits-Header kommen mit PROJ-1 | Erstes Feature mit Oberfläche. Die Header sind laut Sicherheitsregeln für jedes Web-Projekt Pflicht. | Später mit PROJ-2 | PROJ-1 wird etwas größer | 2026-09-29 |

## Offene Fragen

- [ ] Beim Hosting ruft der Next.js-Server Supabase Auth auf. Supabase sieht dann für alle Nutzer die IP des Servers, und die festen Supabase-Grenzen pro IP gelten für alle zusammen. Vor dem ersten `/deploy` klären, ob sich die echte IP weiterreichen lässt oder die Grenzen passend eingestellt werden müssen (auch in `spec.md` → Offene Fragen).

## Umsetzungsnotizen (`/build`, 2026-09-29)

Was beim Bauen vom Plan abwich oder dazukam. Am Vertrag in `spec.md` ändert sich nichts.

- **shadcn-Bausteine an das Design-System angepasst:** `button` (Größen 36/44/56 px, 3-px-Fokusring, Druck-Effekt), `input` (52 px, 16 px Schrift) und `alert` (Töne info, success, warning, danger). Das ist der vorgesehene Weg bei shadcn, kein Nachbau. Dazu kam `src/components/theme-provider.tsx` (Dunkelmodus folgt dem Gerät).
- **Zusätzliche gemeinsame Bausteine**, weil mehrere Aufgaben dasselbe brauchten:
  - `src/lib/auth/password-check.ts`: eine Passwortprüfung durch die Bremse für Login, „Passwort ändern“ und „Konto löschen“
  - `src/lib/auth/confirmation-mail.ts`: Kontostatus und erneutes Senden der Bestätigungsmail
  - `src/lib/auth/log.ts`: technische Fehler ohne personenbezogene Daten protokollieren
  - `src/components/auth/use-auth-action.ts` und `form-notice.tsx`: gemeinsames Absende- und Notice-Verhalten aller Formulare
  - `src/components/simple-page.tsx`: helle Seite ohne Rahmen
  - `src/components/notice-toast.tsx`: Erfolgs-Notice nach einer Weiterleitung
  - `src/components/account/account-row.tsx`: Zeilen der Konto-Seite
- **Passwörter im Dev-Log:** `next dev` (16.3) protokolliert standardmäßig die Argumente jeder Server Action, also auch Passwörter im Klartext. Abgeschaltet mit `logging.serverFunctions: false` in `next.config.ts`.
- **Zeitfenster der Grenzen exklusiv:** Ein Eintrag von vor genau 15 bzw. 60 Minuten zählt nicht mehr mit. Nur so endet die Sperre wie in AC-23 genau 15 Minuten nach dem jüngsten Fehlversuch.
- **Supabase-eigenes Limit (429) beim Login** wird als Sperre von 5 Minuten gemeldet, nicht als Verbindungsfehler.
- **Weg zurück von der Konto-Seite:** Bis PROJ-2 die Tab-Leiste bringt, hat die Konto-Seite einen schlichten Link „Startseite“. PROJ-2 ersetzt ihn.
- **Mindestabstand von 10 Sekunden:** Wird eine Mail innerhalb von 10 Sekunden nach der vorigen für dasselbe Konto angefordert, verschickt Supabase keine zweite. Der Nutzer sieht trotzdem „Mail gesendet“ (EC-5).
- **Verifikation:** Ein Browser-Durchlauf gegen die lokale Supabase mit Mailpit ergab 55/55 Prüfungen über AC-1 bis AC-30, EC-1, EC-3, EC-7, EC-8, EC-9 und EC-11. Er wurde nicht als Testsuite eingecheckt, das übernehmen `/qa` und `/e2e-tests`.

## Umsetzungsnotizen Runde 2 (`/build`, 2026-09-29)

Was beim Bauen der Ebenen 6 bis 8 vom Plan abwich oder dazukam. Am Vertrag in `spec.md` ändert sich nichts.

- **Passwortprüfung liefert ihre Anmeldung mit:** `checkPassword` gibt bei richtigem Passwort den Supabase-Zugang zurück, der die Prüfung gemacht hat. „Passwort ändern“ speichert mit genau diesem Zugang. Grund: `@supabase/ssr` liest eine gerade entstandene Anmeldung nur innerhalb desselben Zugangs sicher zurück. Ein neu erzeugter Zugang könnte noch die alte, über 24 Stunden alte Anmeldung sehen, und Supabase würde ablehnen.
- **Anmeldungskennung:** Sie kommt aus `getClaims()`, das die Signatur des Tokens prüft. Beim Link aus der Mail ist es die Anmeldung, die `verifyOtp` gerade angelegt hat.
- **Freigabe lässt sich nicht speichern:** `/auth/confirm` meldet ab und leitet auf `/auth/link-expired?type=recovery`, wie in `tasks.md` (T40). Eine eigene Verbindungs-Notice auf dieser Seite, wie oben unter „E-Mail-Bestätigung und Links aus Mails“ beschrieben, gibt es nicht: Der Link ist dann tatsächlich verbraucht, und die Seite bietet direkt eine neue Mail an.
- **Doppel-Tipp bei der Registrierung:** Meldet die Mail-Freigabe `duplicate`, antwortet die zweite Anfrage sofort mit „Prüfe dein Postfach“, ohne Kontostatus oder Anlegen. Das Konto legt die erste Anfrage an.
- **Fehler beim Anlegen ohne Konto:** Meldet Supabase beim Anlegen einen Fehler und gibt es danach weiterhin kein Konto, erscheint „Keine Verbindung“. Das gilt jetzt auch für Supabases eigenes Limit (429), das vorher stillschweigend als Erfolg durchging, obwohl kein Konto entstand.
- **Kaputte Anfragen:** Die allgemeine Meldung „Bitte prüfe deine Eingaben.“ steht als Feldfehler unter `form`. Über die Formulare ist dieser Fall nicht erreichbar.
- **Abgelaufene Freigabe beim Öffnen:** Die Seite `/reset-password` entfernt sie schon beim Aufruf, nicht erst beim Abschicken.
- **Zeitstempel der Mail-Einträge:** Einträge `mail_request` setzt jetzt die Datenbank (`now()` in `claim_mail_request`). Login- und Registrierungseinträge setzt weiter der Server. Die Uhren beider laufen lokal zusammen. Beim Hosting ist das nur relevant, wenn sie deutlich auseinanderliefen.
- **Tests der Mail-Freigabe:** Die Regeln von `claim_mail_request` (senden, `duplicate` innerhalb von 10 s, Grenze bei 3 pro Stunde, Rechte nur für den Server) wurden direkt in der lokalen Datenbank geprüft. Ebenso zwei gleichzeitige Aufrufe: mit Sperre genau ein `send`, zur Gegenprobe ohne Sperre zweimal `send`. Das Projekt hat noch keine eingecheckten Datenbank-Tests. Die Unit-Tests prüfen nur den Aufruf aus `throttle.ts`.
- **Verifikation Runde 2:** Ein Browser-Durchlauf gegen die lokale Supabase mit Mailpit ergab 36/36 Prüfungen, jeweils nach der Ebene und noch einmal am Ende. Geprüft wurden AC-8, AC-17, AC-18, AC-20, AC-23, AC-24, AC-33, AC-34, EC-5, EC-13 und BUG-6 sowie die 404-Seite. „Passwort ändern“ funktioniert mit einer auf 25 Stunden zurückdatierten Anmeldung. Zur Gegenprobe lehnt Supabase mit genau dieser Anmeldung direkt ab (`reauthentication_needed`). Nicht eingecheckt, das übernehmen `/qa` und `/e2e-tests`. Die Testkonten `rb-*@example.test` liegen in der lokalen Datenbank.
