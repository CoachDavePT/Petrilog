# PROJ-2 — Technisches Design: Sessions & Fänge

> Das technische Design (das WIE) zu `spec.md`. Zwei Leser: du (zur Freigabe) und `/build` (baut direkt danach). Kein Code, aber so genau, dass niemand raten muss.
> Owner: `/architecture`. Der Vertrag (WAS) steht in `spec.md`, die Aufgabenliste später in `tasks.md`.
> Kein Status und kein Datum hier: Der Status lebt nur in `features/INDEX.md`.

## Überblick in einem Absatz

Sessions und Fänge liegen in zwei neuen Tabellen der lokalen Supabase-Datenbank. Beide hängen am Profil aus PROJ-1 und werden mit dem Konto gelöscht. Wie in PROJ-1 laufen **alle Änderungen über Server Actions**: Der Next.js-Server prüft jede Eingabe mit denselben Regeln wie der Browser und schreibt mit der Anmeldung des Nutzers, sodass Row Level Security in der Datenbank ein zweites Mal prüft. Gelesen wird in Server-Seiten. Die **Datenbank selbst garantiert** die Regeln, die bei gleichzeitigen Aktionen brechen könnten: höchstens eine laufende Session, keine Überschneidungen, Fangzeit innerhalb der Session und kein doppelter Eintrag bei wiederholtem Speichern. Die GPS-Position fragt nur der Browser ab, und zwar erst in dem Moment, in dem der Nutzer speichert. Die App bekommt einen Rahmen mit Kopfzeile, Tab-Leiste und der Leiste der aktiven Session. Neue Pakete oder externe Dienste gibt es nicht.

## Seiten und Adressen

Adressen sind Code und bleiben englisch. In Adressen stehen nur zufällige Kennungen (UUIDs), **nie Koordinaten, Gewässernamen oder andere Inhalte**.

| Adresse | Was dort passiert | Rahmen | → AC / EC |
|---|---|---|---|
| `/` | Sessions-Übersicht (ersetzt den Platzhalter aus PROJ-1) | große Kopfzeile, Tab-Leiste, Leiste der aktiven Session | AC-1, AC-2, AC-4, EC-12 |
| `/account` | Konto-Seite aus PROJ-1, jetzt im Rahmen | große Kopfzeile, Tab-Leiste, Leiste der aktiven Session | AC-5, AC-35 |
| `/start` | Keine Seite. Leitet weiter: mit laufender Session zu deren Detailansicht, sonst zu `/sessions/new` | — | AC-3 |
| `/sessions/new` | „Session starten“ | kompakte Kopfzeile mit Schließen, Hauptbutton unten | AC-6–AC-9, AC-36, AC-37 |
| `/sessions/backfill` | „Session nachtragen“ | kompakte Kopfzeile mit Schließen, Hauptbutton unten | AC-13–AC-16 |
| `/sessions/[id]` | Detailansicht einer Session, darin das Sheet „Session beenden“ und der Dialog „Session löschen“ | kompakte Kopfzeile mit Zurück und Menü (Bearbeiten, Session löschen), Hauptbutton unten | AC-10–AC-12, AC-19, AC-29–AC-31 |
| `/sessions/[id]/edit` | „Session bearbeiten“ inkl. „Position entfernen“ | kompakte Kopfzeile mit Schließen, Hauptbutton unten | AC-17, AC-18, AC-38 |
| `/sessions/[id]/catches/new` | „Fang eintragen“ (laufende Session) bzw. „Fang nachtragen“ (beendete Session) | kompakte Kopfzeile mit Schließen, Hauptbutton unten | AC-20–AC-26 |
| `/sessions/[id]/catches/[catchId]` | „Fang bearbeiten“ inkl. „Position entfernen“ und „Fang löschen“ | kompakte Kopfzeile mit Schließen und Löschen rechts, Hauptbutton unten | AC-27, AC-28, AC-38 |
| `/account/export` | Endpunkt aus PROJ-1, ergänzt um Sessions und Fänge | — | AC-35 |
| `/privacy` | Datenschutzerklärung aus PROJ-1, ergänzt um die Fangbuch-Daten | — | AC-39 |

- **Alle neuen Adressen sind nur angemeldet erreichbar.** Proxy und Anmeldeprüfung aus PROJ-1 decken sie automatisch ab, weil sie nicht auf der Liste der öffentlichen Adressen stehen (AC-33).
- **Fremde oder gelöschte Kennungen:** Findet die Datenbank eine Session oder einen Fang für diesen Nutzer nicht, weil sie einem anderen gehört (Row Level Security) oder gelöscht ist, zeigt die Seite die deutsche Seite „Diese Seite gibt es nicht.“. So verrät die Antwort nicht, ob die Kennung existiert (AC-32).
- **Erfolgs-Hinweise** nach einer Weiterleitung kommen wie in PROJ-1 über einen kurzen Code in der Adresse, z. B. `/sessions/<id>?notice=catch-saved`. Erlaubt sind nur: `session-started` („Session gestartet“), `session-saved` („Session gespeichert“), `session-ended` („Session beendet · 1:42 h“, die Dauer liest die Seite aus der Session selbst), `session-deleted` („Session gelöscht“), `session-running` („Es läuft bereits eine Session.“, im Infoton), `session-gone` („Diese Session gibt es nicht mehr.“, im Warnton), `catch-saved` („Fang gespeichert“) und `catch-deleted` („Fang gelöscht“). Unbekannte Codes werden ignoriert.

## Komponenten-Struktur

```
Angemeldeter Bereich (Layout aus PROJ-1 mit Anmeldeprüfung)
|
+-- Hauptseiten (eigenes Layout: lädt die laufende Session einmal pro Seitenaufruf)
|   +-- AppBar groß: Überzeile + Titel
|   +-- Inhalt (eine Spalte, max. 440 px, 20 px Rand)
|   +-- ActiveSessionBar (nur wenn eine Session läuft), schwebt über der Tab-Leiste
|   |   +-- Gewässername oder „Ohne Gewässer“, Laufzeit (tickt jede Minute), Anzahl Fänge
|   |   +-- Hinweis „Läuft seit über 12 Stunden. Vergessen zu beenden?“ + „Beenden“ (ab 12 h)
|   |   +-- Button „Fang eintragen“ (Amber) → /sessions/[id]/catches/new
|   |   +-- Tipp auf die Leiste → /sessions/[id]
|   +-- TabBar: Sessions (/) · Start (/start) · Konto (/account), aktiver Tab markiert
|   |
|   +-- / Sessions-Übersicht  (AppBar: „Dein Fangbuch“ / „Sessions“)
|   |   +-- Hero-Karte „Bereit für den nächsten Wurf?“ mit „Session starten“ (nur ohne laufende Session)
|   |   +-- Button „Session nachtragen“ (Zweitaktion)
|   |   +-- Liste der Sessions (neueste zuerst, 20 pro Abschnitt)
|   |   |   +-- Session-Karte: Datum, Gewässername, Dauer bzw. Badge „Läuft“, Anzahl Fänge
|   |   |       (keine Koordinaten in der Liste)
|   |   +-- Button „Weitere laden“ (solange es ältere gibt)
|   |   +-- Leerer Zustand: nur die Hero-Karte + „Session nachtragen“
|   |   +-- Laden: Skeleton-Karten
|   +-- /account Konto-Seite (PROJ-1, jetzt mit AppBar „Konto“)
|
+-- Unterseiten (ohne Tab-Leiste und ohne ActiveSessionBar)
    +-- /sessions/new  „Session starten“
    |   +-- Feld Gewässername mit Vorschlagsliste (bis zu 5 eigene Treffer)
    |   +-- Feld Notiz (mehrzeilig)
    |   +-- Standort-Erklärung (Dialog vor der ersten Abfrage, siehe „Standort“)
    |   +-- Hauptbutton „Starten“ (während Ortung und Speichern gesperrt, zeigt „Position wird bestimmt …“)
    |   +-- Warn-Notice „Keine Verbindung …“ bei Fehlern
    +-- /sessions/backfill  „Session nachtragen“
    |   +-- Start: Datum + Uhrzeit · Ende: Datum + Uhrzeit
    |   +-- Gewässername mit Vorschlägen · Notiz
    |   +-- Schalter „Ich bin noch am Gewässer: aktuelle Position verwenden“ (aus)
    |   +-- Hauptbutton „Session speichern“
    +-- /sessions/[id]  Detailansicht
    |   +-- AppBar kompakt: Zurück · Titel (Gewässername oder „Session“) · Menü (Bearbeiten, Session löschen)
    |   +-- Kopf: Datum, Start–Ende bzw. Badge „Läuft“, Dauer
    |   +-- Hinweis-Notice ab 12 h Laufzeit (wie in der Leiste)
    |   +-- Kennzahlen-Kacheln: Fänge · Fänge pro Stunde
    |   +-- Position: Koordinaten (IBM Plex Mono) + „± 12 m“, oder „Ohne Position“
    |   +-- Notiz
    |   +-- Fangliste nach Uhrzeit (älteste zuerst)
    |   |   +-- Fang-Karte: Uhrzeit, Art, Länge, Gewicht, Köder, Badge „Entnommen“/„Zurückgesetzt“,
    |   |       Position + Herkunft („GPS“, „von der Session“, „ohne Position“) → Tipp öffnet „Fang bearbeiten“
    |   +-- Leerer Zustand „Noch keine Fänge. Petri Heil!“
    |   +-- Platz für die Wetterdaten aus PROJ-3 (bleibt in PROJ-2 leer)
    |   +-- Hauptbutton unten: „Fang eintragen“ (läuft) bzw. „Fang nachtragen“ (beendet)
    |   +-- Zweitbutton „Session beenden“ (nur laufend) → Sheet „Session beenden“
    |   |   +-- Auswahl: „Jetzt“ · „Zeit des letzten Fangs“ · „Eigene Uhrzeit“ (Datum + Uhrzeit)
    |   |   +-- Hinweis auf die erlaubte Spanne, Fehler am Feld, Hauptbutton „Beenden“
    |   +-- Dialog „Session löschen?“ mit Anzahl der Fänge, Buttons „Abbrechen“ / „Löschen“ (Warnton)
    +-- /sessions/[id]/edit  „Session bearbeiten“
    |   +-- Gewässername, Notiz, Start (Datum + Uhrzeit), Ende (nur beendet)
    |   +-- Zeile Position mit „Position entfernen“ → Bestätigungsdialog (nur wenn eine Position da ist)
    |   +-- Hauptbutton „Speichern“
    +-- /sessions/[id]/catches/new  „Fang eintragen“ / „Fang nachtragen“
    |   +-- Uhrzeit (vorbelegt „jetzt“ bzw. leer beim Nachtragen, Pflicht)
    |   +-- Fischart: Auswahl, zuletzt genutzte Arten (bis zu 3) oben abgesetzt, dann die feste Liste
    |   +-- Feld Artname (nur bei „Sonstige“)
    |   +-- Länge (Zahlentastatur, Suffix „cm“) · Gewicht (optional, Suffix „g“)
    |   +-- Köder (optional)
    |   +-- Segment „Zurückgesetzt“ / „Entnommen“
    |   +-- Hauptbutton „Fang speichern“ (während Ortung und Speichern gesperrt)
    +-- /sessions/[id]/catches/[catchId]  „Fang bearbeiten“
        +-- dieselben Felder, Position als Zeile mit „Position entfernen“
        +-- AppBar rechts: Löschen → Dialog „Fang löschen?“
        +-- Hauptbutton „Speichern“

Gemeinsame Bausteine
+-- Standort-Baustein (nur im Browser): Erklärung vor der ersten Abfrage, Abfrage mit 10 s Grenze
+-- Formular-Baustein für Server Actions (wie `use-auth-action` aus PROJ-1: POST, Eingaben bleiben stehen,
|   Button gesperrt, Feldfehler, Notice „Keine Verbindung“)
+-- Anzeige-Helfer: Dauer „1:42 h“, Datum/Uhrzeit in Europe/Berlin, Zahlen deutsch, Genauigkeit „± 12 m“ / „± 1,2 km“
```

Alle Bausteine setzen sich aus den installierten shadcn-Komponenten zusammen: `button`, `card`, `badge`, `input`, `textarea`, `select`, `tabs` (Segment), `sheet`, `alert-dialog`, `dropdown-menu`, `switch`, `skeleton`, `alert` und `sonner`. Nachgebaut wird davon nichts.

## Eingaberegeln (gemeinsam für Browser und Server)

Browser und Server prüfen mit **denselben** Zod-Regeln. Leerzeichen am Anfang und Ende werden bei allen Texten entfernt. Ein danach leeres optionales Feld gilt als „nicht angegeben“.

- **Gewässername:** optional, höchstens 80 Zeichen. Meldung: „Höchstens 80 Zeichen.“
- **Notiz:** optional, höchstens 500 Zeichen. Meldung: „Höchstens 500 Zeichen.“
- **Zeitpunkte:** Der Browser wandelt Datum und Uhrzeit aus dem Formular in einen Zeitpunkt mit Zeitzonen-Angabe um. Der Server speichert ihn minutengenau (Sekunden werden auf 0 gesetzt). „In der Zukunft“ heißt: mehr als **2 Minuten** nach der Uhrzeit des Servers. Die Toleranz fängt kleine Uhrabweichungen des Handys ab.
- **Session-Zeiten** (Nachtragen, Bearbeiten, Beenden):
  - Das Ende liegt nach dem Start, mindestens 1 Minute und höchstens 48 Stunden danach.
  - Keine Zeit liegt in der Zukunft.
  - Meldungen nennen die Grenze, z. B. „Das Ende muss nach dem Start liegen.“, „Eine Session dauert höchstens 48 Stunden (bis 14.09., 06:00).“, „Dieser Zeitpunkt liegt in der Zukunft.“
- **Fangzeit:** zwischen Start und Ende der Session, beide eingeschlossen. Bei einer laufenden Session gilt als Ende „jetzt“ plus Toleranz. Meldung mit Spanne: „Die Fangzeit muss zwischen 14:05 und 18:40 liegen.“
- **Fischart:** eine der 17 festen Kennungen (siehe Datenmodell). Pflicht. Meldung: „Bitte wähle eine Fischart.“
- **Artname bei „Sonstige“:** Pflicht bei „Sonstige“, sonst nicht erlaubt (wird verworfen). Höchstens 40 Zeichen. Meldung: „Bitte gib die Fischart ein.“
- **Länge:** ganze Zahl von 1 bis 250. Meldung: „Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).“
- **Gewicht:** optional, ganze Zahl von 1 bis 150.000. Meldung: „Bitte gib das Gewicht in ganzen Gramm ein (1 bis 150.000).“
- **Köder:** optional, höchstens 60 Zeichen.
- **Entnommen / Zurückgesetzt:** Pflicht, einer der beiden Werte.
- **Position** (vom Browser mitgeschickt):
  - Breite −90 bis 90, Länge −180 bis 180, Genauigkeit in Metern ≥ 0, auf ganze Meter gerundet und höchstens 100.000.
  - Alle drei Werte oder keiner.
  - Unplausible Werte führen zu „ohne Position“, nicht zu einem Fehler: Der Eintrag geht nie an einer kaputten Ortung verloren.
- **Kennungen:** Sessions und Fänge bekommen ihre Kennung schon beim Öffnen des Formulars (siehe „Doppeltes Speichern“). Der Server akzeptiert nur gültige UUIDs.
- **Kaputte Anfragen** (kein Objekt, falscher Typ): allgemeine Meldung „Bitte prüfe deine Eingaben.“, wie in PROJ-1.

## Datenmodell

### sessions — ein Angelausflug (neu)

Jede Session hat:
- **id**: eindeutige Kennung (UUID), Pflicht, Primärschlüssel. Wird im Browser beim Öffnen des Formulars erzeugt (siehe „Doppeltes Speichern“).
- **user_id**: der Besitzer. Pflicht, verweist auf das Profil (`profiles.id`). Wird das Profil bzw. Konto gelöscht, verschwindet die Session automatisch mit. Setzt immer der Server aus der geprüften Anmeldung, nie der Browser.
- **started_at**: Beginn, Zeitpunkt mit Zeitzone, Pflicht, minutengenau.
- **ended_at**: Ende, Zeitpunkt mit Zeitzone, **leer, solange die Session läuft**. Wenn gesetzt: mindestens 1 Minute und höchstens 48 Stunden nach dem Beginn.
- **water_name**: Gewässername, Text, optional, 1 bis 80 Zeichen.
- **note**: Notiz, Text, optional, 1 bis 500 Zeichen.
- **latitude / longitude**: Position, Kommazahlen (Breite −90 bis 90, Länge −180 bis 180), optional.
- **accuracy_m**: Genauigkeit der Position in ganzen Metern, 0 bis 100.000, optional.
  - Die drei Positionsfelder sind **entweder alle gefüllt oder alle leer**. Leer heißt „Ohne Position“.
- **created_at / updated_at**: Anlage und letzte Änderung, automatisch gesetzt.

Zustände: **läuft** (kein Ende) oder **beendet** (Ende gesetzt). Ein Wechsel geht nur von „läuft“ nach „beendet“. Beendete Sessions bekommen nie wieder ein leeres Ende (EC-13).

Die Datenbank garantiert:
- **Höchstens eine laufende Session pro Nutzer** (eindeutige Regel über „Besitzer, dessen Session kein Ende hat“) → AC-9, EC-1.
- **Keine Überschneidung zweier Sessions desselben Nutzers.** Eine laufende Session gilt dabei als „bis unbegrenzt“, weil keine Zeit in der Zukunft erlaubt ist. Die Regel ist eine Ausschlussbedingung über „Besitzer + Zeitspanne“ (Postgres-Erweiterung `btree_gist`) → AC-16, auch bei gleichzeitigen Anfragen.
- **Keine Zeitänderung schließt einen vorhandenen Fang aus** (Prüfung beim Ändern der Zeiten, siehe „Fangzeit-Garantie“) → AC-18, EC-9.

Indizes:
- „Besitzer + Beginn absteigend“ für die Übersicht
- „Besitzer + Gewässername“ für die Vorschläge

Wetterdaten gibt es hier noch nicht. PROJ-3 ergänzt sie mit einer eigenen Migration, und PROJ-2 legt dafür keine leeren Felder vorab an.

### catches — ein Fang (neu)

Jeder Fang hat:
- **id**: eindeutige Kennung (UUID), Pflicht, Primärschlüssel. Im Browser beim Öffnen des Formulars erzeugt.
- **session_id**: die Session, Pflicht. Wird die Session gelöscht, verschwindet der Fang mit.
- **user_id**: der Besitzer, Pflicht, verweist auf das Profil (Mitlöschen mit dem Konto). Vom Server gesetzt. **Muss zum Besitzer der Session passen.** Die Datenbank erzwingt das, weil der Fang auf das Paar „Session + Besitzer“ verweist: Einen Fang in einer fremden Session kann es nicht geben (AC-32).
- **caught_at**: Fangzeit, Zeitpunkt mit Zeitzone, Pflicht, minutengenau.
- **species**: Fischart, Pflicht, eine der festen Kennungen. Kennung → Anzeige:
  - `perch` → Barsch, `pike` → Hecht, `zander` → Zander, `eel` → Aal
  - `carp` → Karpfen, `tench` → Schleie, `bream` → Brasse, `roach` → Rotauge, `wels_catfish` → Wels
  - `brown_trout` → Bachforelle, `rainbow_trout` → Regenbogenforelle, `sea_trout` → Meerforelle
  - `cod` → Dorsch, `herring` → Hering, `garfish` → Hornhecht, `flatfish` → Plattfisch, `other` → Sonstige

  Die Reihenfolge der Auswahlliste ist genau diese (AC-21).
- **species_other**: Artname bei „Sonstige“, Text 1 bis 40 Zeichen. Pflicht genau dann, wenn `species` = `other`, sonst leer.
- **length_cm**: Länge, ganze Zahl 1 bis 250, Pflicht.
- **weight_g**: Gewicht, ganze Zahl 1 bis 150.000, optional.
- **bait**: Köder, Text 1 bis 60 Zeichen, optional.
- **released**: „zurückgesetzt“ (ja) oder „entnommen“ (nein), Pflicht.
- **latitude / longitude / accuracy_m**: wie bei der Session, entweder alle gefüllt oder alle leer. Der Fang speichert immer seine **eigene Kopie**, auch wenn die Position von der Session kommt. So bleibt sie erhalten, wenn die Position der Session später entfernt wird (AC-38).
- **position_source**: Herkunft der Position, einer von `gps`, `session`, `none`. Pflicht. `none` genau dann, wenn keine Position gespeichert ist. `gps` und `session` nur mit Position (AC-25, AC-29).
- **created_at / updated_at**: automatisch.

Indizes:
- „Session + Fangzeit“ für die Detailansicht und die Fangzeit-Prüfung
- „Besitzer + Anlage absteigend“ für die zuletzt genutzten Arten und die Vorbelegung

### Fangzeit-Garantie (AC-18, AC-24, EC-4, EC-9, EC-10)

Die Datenbank prüft bei **jedem** Anlegen oder Ändern eines Fangs, ob die Fangzeit in die Session fällt. Umgekehrt prüft sie bei jeder Änderung der Session-Zeiten, ob alle Fänge noch hineinfallen.

- **Laufende Session:** Die obere Grenze ist „jetzt + 2 Minuten“.
- **Beide Prüfungen sperren dieselbe Session-Zeile.** Das Anlegen eines Fangs und das Beenden oder Umstellen der Session kommen deshalb nacheinander dran, nie gleichzeitig. Es kann also nicht passieren, dass Gerät A die Session um 18:40 beendet, während Gerät B im selben Moment einen Fang um 18:45 speichert, und beide Prüfungen durchgehen.
- **Wer verliert,** bekommt eine Ablehnung. Die App übersetzt sie in die Meldung am Feld mit der aktuellen Spanne (EC-4: „Die Session wurde inzwischen beendet (Ende 18:40).“) bzw. in den Hinweis auf den betroffenen Fang (AC-18: „Der Fang um 17:20 (Hecht) läge außerhalb der Session.“).
- **Zusätzlich** prüft die App vor dem Schreiben dieselben Regeln, damit die Meldung in der Regel schon ohne Datenbank-Ablehnung kommt. Die Datenbank ist die Garantie, die App-Prüfung die freundliche Meldung.

### Zugriff (Row Level Security) — beide Tabellen

- **Lesen, Anlegen, Ändern, Löschen:** nur eigene Zeilen (`user_id` = angemeldeter Nutzer). Beim Anlegen und Ändern muss `user_id` der angemeldete Nutzer sein und bleiben.
- **Nicht angemeldete Aufrufer:** keinerlei Rechte (AC-33).
- **Die App schreibt mit der Anmeldung des Nutzers, nicht mit dem Server-Schlüssel.** Row Level Security prüft also jede Änderung ein zweites Mal (AC-32). Der Server-Schlüssel wird in PROJ-2 nicht verwendet.
- **Gespeichert bis:** Der Nutzer löscht den Eintrag, die Session oder sein Konto. Gelöscht wird endgültig, es gibt kein „ausgeblendet“ (AC-40). Mit dem Konto verschwinden über das Profil automatisch alle Sessions und damit alle Fänge (EC-11, PROJ-1 EC-12).

## Abläufe und Zugriffsregeln

### Standort (AC-6, AC-8, AC-14, AC-20, AC-25, AC-36, AC-37)

- **Die Position fragt nur der Browser ab**, über die Standortschnittstelle des Geräts: hohe Genauigkeit, höchstens **10 Sekunden** warten, eine höchstens 30 Sekunden alte Position darf verwendet werden.
- **Wann abgefragt wird** (AC-36): Nur beim Tipp auf „Starten“, auf „Fang speichern“ in einer **laufenden** Session und auf „Session speichern“ beim Nachtragen mit eingeschaltetem Schalter. Nie beim Öffnen einer Seite, nie im Hintergrund, nie fortlaufend. „Fang nachtragen“ in einer beendeten Session fragt nie ab (AC-26).
- **Erklärung vor der ersten Abfrage** (AC-37):
  - Vor der ersten Abfrage auf einem Gerät erscheint ein Dialog: „Petrilog speichert beim Starten und bei jedem Fang deine Position, damit du später weißt, wo du gefangen hast. Nur du kannst sie sehen.“ Dazu ein Link „Datenschutz“ und der Button „Weiter“, danach kommt die Abfrage des Browsers.
  - Das Gerät merkt sich im Browser-Speicher, dass die Erklärung gezeigt wurde. Das ist eine Komfort-Einstellung ohne Personenbezug.
  - Meldet der Browser, dass die Freigabe schon erteilt ist, entfällt der Dialog.
- **Ohne Position** (verweigert, nicht verfügbar, 10 s abgelaufen): Gespeichert wird trotzdem.
  - Eine Session ist dann „Ohne Position“, und die Detailansicht zeigt den Hinweis „Position fehlt. Prüfe die Standortfreigabe deines Browsers.“ (AC-8).
  - Ein Fang übernimmt die Position der Session als Kopie mit Herkunft `session`. Hat auch die Session keine, gilt `none` (AC-25).
- **Gemerkte Position bei Wiederholung** (EC-3): Die beim ersten Speicherversuch ermittelte Position bleibt im Formular. Ein erneuter Versuch fragt nicht noch einmal ab, sondern schickt genau diese Werte.

### Doppeltes Speichern und Verbindungsabbrüche (EC-2, EC-3)

- **Kennung beim Öffnen:** Jedes Formular, das etwas **anlegt** („Starten“, „Session speichern“ beim Nachtragen, „Fang speichern“), erzeugt beim Öffnen eine neue Kennung. Sie wird bei jedem Speicherversuch mitgeschickt.
- **Anlegen heißt „anlegen, falls es diese Kennung noch nicht gibt“.** Gibt es sie schon beim selben Nutzer, antwortet der Server so, als hätte er gerade gespeichert. Ein Doppel-Tipp oder eine Wiederholung nach einem Abbruch erzeugt also nie einen zweiten Eintrag. Gehört die Kennung einem anderen Nutzer (praktisch ausgeschlossen), wird abgelehnt.
- **Button gesperrt:** Der Hauptbutton ist während Ortung und Speichern gesperrt, wie in PROJ-1.
- **Verbindungsabbruch:** Die Notice im Warnton „Keine Verbindung. Bitte versuche es erneut.“ erscheint. Alle Eingaben bleiben stehen, auch Kennung, vorbelegte Fangzeit und ermittelte Position (EC-3).

### Session starten (AC-6–AC-9, EC-1)

1. Eingaben prüfen, dann Position ermitteln (siehe „Standort“).
2. Der Server legt die Session an: Beginn = jetzt, minutengenau.
3. Verweigert die Datenbank das, weil schon eine Session läuft (EC-1, AC-9), liest der Server die laufende Session und leitet zu `/sessions/<laufende>?notice=session-running`.
4. Bei Erfolg geht es weiter zu `/sessions/<id>?notice=session-started`.

Die Vorschläge für den Gewässernamen (AC-7, AC-34) lädt die Seite beim Öffnen: die unterschiedlichen eigenen Gewässernamen, zuletzt genutzte zuerst, höchstens 50. Gefiltert wird im Browser nach Wortanfang, ohne Rücksicht auf Groß- und Kleinschreibung, bis zu 5 Treffer. Die Namen kommen nur aus den eigenen Sessions (Row Level Security).

### Session beenden (AC-10–AC-12, EC-6)

- **Sheet mit drei Wahlmöglichkeiten:**
  - **„Jetzt“:** vorausgewählt. Nicht wählbar, wenn die Session schon länger als 48 h läuft (EC-6).
  - **„Zeit des letzten Fangs“:** nur wenn es Fänge gibt. Bei EC-6 vorausgewählt.
  - **„Eigene Uhrzeit“:** Datum und Uhrzeit.
- **Speichern nur, solange die Session noch läuft.** Der Server setzt das Ende nur, wenn es noch leer ist. Hat ein anderes Gerät die Session schon beendet, zeigt die Detailansicht einfach den aktuellen Stand, ohne Fehler.
- **Prüfung:** Regeln aus „Eingaberegeln“ plus Fangzeit-Garantie. Ein Ende vor dem letzten Fang wird abgelehnt (AC-12).
- **Danach:** weiter zu `/sessions/<id>?notice=session-ended`. Die Leiste der aktiven Session verschwindet, weil das Layout sie beim nächsten Aufruf nicht mehr findet.
- **Hinweis ab 12 h (AC-11):** Leiste und Detailansicht berechnen ihn aus dem Beginn, mit derselben Uhr wie die Laufzeit-Anzeige.

### Session nachtragen und bearbeiten (AC-13–AC-18, EC-9)

- **Nachtragen:** Eingaben prüfen. Mit eingeschaltetem Schalter wird die Position ermittelt (AC-14), sonst ist die Session „Ohne Position“. Der Server legt eine beendete Session an und leitet zu `/sessions/<id>?notice=session-saved`.
- **Überschneidung (AC-16):** Die App prüft vorab gegen die eigenen Sessions. Die Ausschlussbedingung der Datenbank ist die Garantie. In beiden Fällen sucht der Server die im Weg liegende Session heraus und meldet: „Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.“ Bei einer laufenden Session heißt es: „… mit deiner laufenden Session seit 14:05.“
- **Bearbeiten:**
  - Änderbar sind Gewässername, Notiz und Beginn, das Ende nur bei beendeten Sessions.
  - Bei einer laufenden Session darf der Beginn nicht in der Zukunft und nicht nach dem ersten Fang liegen (EC-9).
  - Die Position ändert sich beim Speichern nie, außer über „Position entfernen“.

### Fang eintragen, nachtragen, bearbeiten (AC-20–AC-28, EC-4, EC-5, EC-10)

- **Beim Öffnen von „Fang eintragen“ lädt die Seite:**
  - die Session (läuft oder beendet, Beginn, Ende)
  - die bis zu 3 zuletzt genutzten Arten des Nutzers, aus seinen letzten 50 Fängen nach Anlage
  - Köder und „entnommen/zurückgesetzt“ des **zuletzt angelegten** Fangs dieser Session (AC-23)
- **Vorbelegung:**
  - Die Fangzeit ist bei einer laufenden Session „jetzt“ (Minute beim Öffnen), bei einer beendeten Session leer.
  - Ohne vorherigen Fang ist „Zurückgesetzt“ gewählt und der Köder leer.
- **Speichern in einer laufenden Session:** Position ermitteln (Herkunft `gps`, sonst Kopie der Session-Position, sonst `none`). Danach anlegen und weiter zu `/sessions/<id>?notice=catch-saved`.
- **Speichern in einer beendeten Session** (AC-26): keine Standortabfrage. Die Position ist eine Kopie der Session-Position (Herkunft `session`), sonst `none`.
- **Beendet während des Ausfüllens** (EC-4): Die Session war beim Öffnen laufend und ist beim Speichern beendet. Dann gilt die Fangzeit-Garantie: Liegt die Zeit innerhalb, wird gespeichert, sonst kommt die Meldung am Feld. Die Position bleibt die ermittelte.
- **Bearbeiten** (AC-27):
  - Es gelten dieselben Regeln. Die Position bleibt unverändert, außer über „Position entfernen“.
  - Die Kennung ist fest, das Speichern ist ein Ändern „nur dieses Fangs dieses Nutzers“.
- **Löschen** (AC-28): nach dem Dialog endgültig, danach weiter zu `/sessions/<id>?notice=catch-deleted`.
- **Session inzwischen gelöscht** (EC-5): Findet die Aktion die Session bzw. den Fang nicht mehr, wird nichts gespeichert. Es geht weiter zu `/?notice=session-gone`.

### Position entfernen (AC-38)

- **Wo:** Zeile „Position“ in „Session bearbeiten“ bzw. „Fang bearbeiten“, nur wenn eine Position da ist.
- **Ablauf:** Nach dem Bestätigungsdialog („Position endgültig entfernen?“) setzt der Server Breite, Länge und Genauigkeit auf leer. Beim Fang wird zusätzlich die Herkunft `none`.
- **Wirkung auf Fänge:** Die Fänge einer Session behalten ihre eigenen Kopien.
- **Rückweg:** Eine neue Position lässt sich danach nicht setzen, das kommt mit der Karte.

### Session löschen (AC-19)

- **Dialog:** „Session löschen? Die Session und ihre 3 Fänge werden endgültig gelöscht.“ Ohne Fänge entfällt der Teil mit den Fängen.
- **Ablauf:** Der Server löscht die Session, die Fänge verschwinden automatisch mit. Weiter zu `/?notice=session-deleted`.
- **Laufende Session:** Auch sie lässt sich löschen, danach gibt es keine Leiste mehr.

### Sessions-Übersicht (AC-1, AC-2, EC-8, EC-12)

- **Sortierung und Abschnitte:** nach Beginn absteigend, erst 20 Sessions, „Weitere laden“ holt die nächsten 20. Das läuft über eine Server Action, die nur Kennung, Datum, Gewässername, Beginn, Ende und die Anzahl der Fänge liefert, **keine Positionen**.
- **Anzahl der Fänge:** zählt die Datenbank.
- **Datum:** Startdatum in Europe/Berlin (EC-8).
- **Dauer:** Ende − Beginn als tatsächlich vergangene Zeit, angezeigt als „h:mm h“ („1:42 h“, „26:05 h“). Bei laufenden Sessions steht das Badge „Läuft“.

### Detailansicht und Kennzahl (AC-29–AC-31, EC-7, EC-8)

- **Fänge pro Stunde:** Anzahl der Fänge ÷ Dauer in Stunden, auf eine Nachkommastelle gerundet, im deutschen Format.
  - Bei laufenden Sessions wird bis „jetzt“ gerechnet.
  - Unter 1 Minute Dauer (nur direkt nach dem Start möglich) wird mit 1 Minute gerechnet, damit kein absurder Wert entsteht.
  - Ohne Fänge: „0,0“ (AC-31).
- **Genauigkeit:** unter 1.000 m als „± 12 m“, ab 1.000 m als „± 1,2 km“ (EC-7).
- **Koordinaten:** mit 5 Nachkommastellen, etwa 1 m, in IBM Plex Mono, z. B. „54,08512° N · 13,38741° O“. Gespeichert wird die volle Genauigkeit des Geräts.
- **Zeiten:** alle in Europe/Berlin. Eine Session über Mitternacht zeigt beim Ende das Datum mit („bis 13.09., 02:10“).

### Datenexport (AC-35)

`/account/export` bleibt der Endpunkt aus PROJ-1. Die Datei bekommt **Version 2**, und neben `account` und `profile` steht jetzt `sessions`: eine Liste aller Sessions, neueste zuerst.

- **Pro Session:** alle Felder außer `user_id`, also Kennung, Beginn, Ende, Gewässername, Notiz, Breite, Länge, Genauigkeit, Anlage und Änderung.
- **Darin `catches`:** alle Fänge der Session nach Fangzeit, mit allen Feldern außer `user_id` und `session_id`. Die Fischart steht als Kennung und zusätzlich als deutscher Name.
- **Zeitpunkte:** als ISO-Zeitpunkte mit Zeitzone.
- **Cache:** Die Datei kommt nie aus dem Cache (wie bisher).

### Datenschutzerklärung (AC-39)

Der Platzhaltertext auf `/privacy` bekommt einen Abschnitt „Dein Fangbuch“:
- **Was gespeichert wird:** Positionen mit Zeitpunkt, Gewässername, Notizen und Fangangaben.
- **Wozu:** damit du dein Fangbuch führen und später auswerten kannst.
- **Wer sie sieht:** nur du.
- **Wann die Standortabfrage kommt:** nur beim Starten, beim Speichern eines Fangs und beim Nachtragen mit eingeschaltetem Schalter.
- **Wie lange:** bis du den Eintrag, die Session oder dein Konto löschst.

Grundlage ist `docs/privacy.md`. Der Text bleibt als Entwurf gekennzeichnet.

### Wer darf was (Zusammenfassung)

| Aktion | Wer | Abgelehnt, wenn |
|---|---|---|
| Sessions und Fänge lesen (Übersicht, Detail, Export, Vorschläge) | angemeldeter Besitzer | nicht angemeldet, fremde oder gelöschte Kennung (→ „Diese Seite gibt es nicht.“) |
| Session starten | angemeldeter Nutzer | Eingaben ungültig, schon eine laufende Session (→ zu dieser) |
| Session nachtragen, Zeiten ändern | angemeldeter Besitzer | Zeitregeln verletzt, Überschneidung, ein Fang läge außerhalb |
| Session beenden | angemeldeter Besitzer, nur laufende Session | Endzeit ungültig, vor dem letzten Fang, über 48 h |
| Fang anlegen oder ändern | angemeldeter Besitzer der Session | fremde oder gelöschte Session, Fangzeit außerhalb, Eingaben ungültig |
| Löschen, Position entfernen | angemeldeter Besitzer | fremde oder gelöschte Kennung |

## Rahmen der App (Owner PROJ-2)

- **Layout der Hauptseiten** (neuer Unterbereich im angemeldeten Bereich, gilt für `/` und `/account`):
  - Lädt einmal pro Seitenaufruf die laufende Session des Nutzers (Kennung, Gewässername, Beginn, Anzahl Fänge).
  - Zeigt AppBar, Inhalt, ActiveSessionBar und TabBar.
  - Die Konto-Seite aus PROJ-1 zieht dorthin um. Ihre Adresse bleibt `/account`.
- **Unterseiten** liegen außerhalb dieses Unterbereichs und haben deshalb keine Tab-Leiste und keine Leiste der aktiven Session (`docs/app-shell.md`).
- **Laufzeit-Anzeige:** Die Leiste zählt im Browser jede Minute hoch. Die Ausgangswerte kommen vom Server.
- **Unten Platz lassen:** Die Tab-Leiste und die Leiste der aktiven Session haben feste Höhen. Der Inhalt bekommt unten genug Abstand, dass nichts verdeckt wird, auch nicht vom Rand bei iPhones mit Home-Indikator.

## Wo die Teile liegen (für `/build`)

- **Migration** `supabase/migrations/<Zeitstempel>_sessions_catches.sql`: beide Tabellen, Erweiterung `btree_gist`, Regeln, Indizes, Fangzeit-Garantie, Row Level Security. Die Migrationen aus PROJ-1 bleiben unverändert.
- **`src/lib/fishing/`:**
  - Eingaberegeln, Artenliste mit deutschen Namen, Anzeige-Helfer (Dauer, Zeit, Zahlen, Genauigkeit) und alle deutschen Meldungen dieses Features an einer Stelle
  - Server Actions (Sessions, Fänge) und die Lesefunktionen für Übersicht, Detail, Vorschläge und Export
- **`src/components/shell/`:** AppBar, TabBar, ActiveSessionBar
- **`src/components/fishing/`:** Standort-Baustein, Formulare (Session starten, nachtragen, bearbeiten, beenden; Fang), Karten (Session, Fang), Dialoge
- **Formular-Baustein:** Der bestehende `use-auth-action` wird zu einem allgemeinen Baustein für Server Actions verallgemeinert und von beiden Features genutzt, statt ihn zu kopieren. Sein Verhalten für PROJ-1 bleibt gleich.
- **`src/app/(app)/(main)/`:** Layout der Hauptseiten, `page.tsx` (Übersicht, ersetzt den Platzhalter), `account/` (verschoben aus `(app)/account`, inkl. `export`)
- **`src/app/(app)/start/`, `src/app/(app)/sessions/…`:** die Unterseiten aus der Adressen-Tabelle
- **Bestehende Dateien:** `src/app/privacy/page.tsx` (Abschnitt „Dein Fangbuch“) und der Export-Endpunkt (Version 2)

## Abhängigkeiten (Pakete)

- **Keine neuen Pakete.** Datum und Zahlen formatiert die eingebaute `Intl`-Schnittstelle, Formulare laufen mit react-hook-form + Zod wie in PROJ-1, und alle Bedienelemente sind schon als shadcn-Komponenten installiert.
- **Neue Datenbank-Erweiterung:** `btree_gist` (in Postgres enthalten, lokal und in gehostetem Supabase verfügbar) für die Überschneidungsregel.

## Einstellungen, die du selbst machst

Keine. PROJ-2 braucht weder Einstellungen in Supabase noch beim Hoster.

## Technische Entscheidungen

| Entscheidung | Begründung | Alternative | Nachteil | Datum |
| --- | --- | --- | --- | --- |
| Alle Änderungen über Server Actions mit der Anmeldung des Nutzers, Lesen in Server-Seiten | Dasselbe Muster wie PROJ-1. Eingaben werden auf dem Server geprüft, Row Level Security prüft ein zweites Mal, und nichts landet in Adressen. | Browser schreibt direkt mit dem öffentlichen Schlüssel in Supabase (nur Row Level Security schützt) | Jede Aktion geht über den Next.js-Server. Ohne Offline-Modus spielt das keine Rolle. | 2026-09-30 |
| Garantie für EC-1 / AC-9: eindeutige Regel „höchstens eine Session ohne Ende pro Besitzer“ in der Datenbank | Zwei gleichzeitige Starts ergeben garantiert genau eine laufende Session. Der Verlierer wird zur laufenden geleitet. | Vorher prüfen, dann anlegen (im App-Code) | keiner | 2026-09-30 |
| Garantie für AC-16: Ausschlussbedingung „keine überlappenden Zeitspannen pro Besitzer“ mit `btree_gist`; laufende Sessions gelten als „bis unbegrenzt“ | Die Datenbank verhindert Überschneidungen auch bei gleichzeitigen Anfragen. Weil keine Zeit in der Zukunft erlaubt ist, gilt „unbegrenzt“ praktisch als „bis jetzt“. | Nur im App-Code prüfen | Eine Postgres-Erweiterung mehr. Sie ist Standard und in Supabase freigegeben. | 2026-09-30 |
| Garantie für AC-18, AC-24, EC-4, EC-10: Fangzeit-Prüfung in der Datenbank beim Anlegen oder Ändern von Fängen und beim Ändern von Session-Zeiten, beide sperren dieselbe Session-Zeile | Beenden bzw. Umstellen der Session und das Speichern eines Fangs kommen nacheinander dran. So kann kein Fang außerhalb seiner Session landen, auch nicht über zwei Geräte gleichzeitig. | Nur im App-Code prüfen | Etwas Logik in der Datenbank. Die App prüft zusätzlich für die freundliche Meldung. | 2026-09-30 |
| Garantie für EC-2 / EC-3: Kennung wird beim Öffnen des Formulars erzeugt, Anlegen heißt „nur wenn diese Kennung noch nicht existiert“ | Doppel-Tipps und Wiederholungen nach einem Verbindungsabbruch erzeugen nie einen zweiten Eintrag. Der Nutzer darf einfach noch einmal tippen. | Button sperren allein | Kennungen kommen aus dem Browser und werden auf Format geprüft. Eine fremde Kennung ist durch Row Level Security geschützt. | 2026-09-30 |
| Beenden nur, „solange das Ende noch leer ist“ | Zwei Geräte, die gleichzeitig beenden, überschreiben sich nicht. Das zweite sieht den Stand des ersten. Der Rückweg „beendet → läuft“ ist ausgeschlossen (EC-13). | Ende immer überschreiben | keiner | 2026-09-30 |
| Fang verweist auf das Paar „Session + Besitzer“ | Die Datenbank schließt Fänge in fremden Sessions aus, auch wenn eine Regel im App-Code fehlen sollte (AC-32) | Nur Row Level Security auf `user_id` | Ein zusätzlicher Index auf den Sessions | 2026-09-30 |
| Sessions und Fänge hängen am Profil mit automatischem Mitlöschen | Verbindlich aus PROJ-1: Nach „Konto löschen“ bleibt nichts zurück (EC-11). Gelöscht wird endgültig (AC-40). | Weiches Löschen mit Markierung | Kein Papierkorb | 2026-09-30 |
| Fänge speichern immer eine eigene Kopie der Position plus Herkunft | Die Herkunft ist ehrlich sichtbar (GPS oder von der Session). Das Entfernen der Session-Position ändert keine Fänge (AC-38), und die spätere Karte braucht nur eine Tabelle. | Fang verweist nur auf die Session-Position | Dieselben Koordinaten stehen mehrfach in der Datenbank | 2026-09-30 |
| Standort nur im Browser, beim Tipp auf Speichern, 10 s Grenze, höchstens 30 s alte Position | Erfüllt AC-36 (nur bei Bedarf) und das 30-Sekunden-Ziel. Eine kurz zuvor ermittelte Position spart Wartezeit ohne echten Verlust an Genauigkeit. | Ortung schon beim Öffnen des Formulars starten | Bis zu 10 s Wartezeit beim Speichern, wenn das GPS kalt ist | 2026-09-30 |
| Erklärung vor der ersten Standortabfrage, gemerkt im Browser-Speicher des Geräts | AC-37. Der Vermerk ist eine Komfort-Einstellung ohne Personenbezug und braucht keine Datenbank. | Vermerk im Profil | Auf einem neuen Gerät erscheint die Erklärung noch einmal. Das ist gewollt. | 2026-09-30 |
| Alle Zeitpunkte mit Zeitzone gespeichert, Anzeige immer in Europe/Berlin, minutengenau, 2 Minuten Toleranz für „Zukunft“ | Dauer und Fänge pro Stunde stimmen über Mitternacht und Zeitumstellung (EC-8). Die Toleranz verhindert Ablehnungen, wenn die Handy-Uhr leicht vorgeht. | Anzeige in der Zeitzone des Servers | Nutzer außerhalb Deutschlands sehen deutsche Zeit. Das passt zur Zielgruppe. | 2026-09-30 |
| Fischarten als feste englische Kennungen mit deutschen Anzeigenamen, geprüft durch eine Regel in der Datenbank | Code-Kennungen bleiben stabil, falls sich Anzeigenamen ändern. Eine neue Art in der Liste ist eine kleine Migration. | Eigene Tabelle für Arten | Neue Arten brauchen eine Änderung am Code (bewusst, siehe Spec) | 2026-09-30 |
| Kennzahl „Fänge pro Stunde“ rechnet mit mindestens 1 Minute Dauer | Verhindert absurde Werte direkt nach dem Start (1 Fang nach 20 s wären 180 pro Stunde) | Ohne Untergrenze | In der ersten Minute ist der Wert leicht zu niedrig | 2026-09-30 |
| Übersicht in Abschnitten zu 20 mit „Weitere laden“, ohne Positionen | EC-12: schnell auch mit Hunderten Sessions. Die Liste zeigt keine Koordinaten, weil sie dort nicht gebraucht werden (Datensparsamkeit). | Alles auf einmal laden, oder Seitennummern | Wer weit zurückblättert, muss mehrfach tippen | 2026-09-30 |
| Rahmen als eigener Unterbereich mit Layout für die Hauptseiten; die Konto-Seite zieht dorthin um | Tab-Leiste und Leiste der aktiven Session erscheinen nur auf Hauptseiten, wie in `docs/app-shell.md` festgelegt, ohne Sonderfälle in jeder Seite | Ein Layout, das nach Adresse unterscheidet | Die Dateien der Konto-Seite wandern. Die Adressen bleiben gleich. | 2026-09-30 |
| Der Formular-Baustein aus PROJ-1 wird für beide Features verallgemeinert | Gleiches Verhalten bei Fehlern, Sperren und Verbindungsabbruch in der ganzen App, keine Kopie | Eigener Baustein für PROJ-2 | Eine kleine Änderung an einer PROJ-1-Datei. `/qa` prüft PROJ-1 dafür mit. | 2026-09-30 |
| Keine vorab angelegten Wetterfelder | PROJ-3 entscheidet selbst, ob JSON oder eigene Spalten, und bringt sie mit seiner Migration mit | Leere Felder schon jetzt anlegen | Eine Migration mehr in PROJ-3 | 2026-09-30 |
| Export-Version 2 mit verschachtelten Sessions und Fängen | Maschinenlesbar und vollständig (AC-35). Die Version zeigt, dass sich der Inhalt geändert hat. | Getrennte Dateien pro Tabelle | keiner | 2026-09-30 |

## Offene Fragen

- keine

## Umsetzungsnotizen (`/build`, 2026-09-30)

- **Reihenfolge der Regeln in der Migration:** Die Überschneidungsregel `sessions_no_overlap` wird erst nach der Regel „höchstens eine laufende Session“ angelegt. Sonst meldete ein zweiter Start den Überschneidungsfehler statt `sessions_one_running_per_user`, weil zwei laufende Sessions immer überlappen.
- **EC-13 sichert die App, nicht die Datenbank:** Keine Aktion setzt das Ende je wieder auf leer. Wer die Datenbank-Schnittstelle direkt aufruft, könnte seine **eigene** beendete Session wieder öffnen. Fremde Daten sind davon nicht betroffen.
- **Meldungsort:** Überschneidung und „Fang läge außerhalb“ kommen als Hinweis über dem Hauptbutton, nicht an einem Feld, weil sie Start und Ende zugleich betreffen. Nur beim Beenden mit eigener Uhrzeit steht die Meldung am Zeitfeld (AC-12).
- **EC-4:** Das Fang-Formular schickt `sessionWasRunning` mit, wenn es für eine laufende Session geöffnet wurde. Dann bleibt die ermittelte GPS-Position erhalten, auch wenn die Session inzwischen beendet ist, und eine Zeit nach dem Ende ergibt „Die Session wurde inzwischen beendet (Ende …)“.
- **Kennungen der Formulare:** Sie entstehen in `src/lib/fishing/entry-id.ts`, mit Ersatz über `getRandomValues`, weil `crypto.randomUUID` nur in sicheren Umgebungen (HTTPS, `localhost`) existiert.
- **GPS braucht HTTPS:** Browser geben den Standort nur über HTTPS oder `localhost` heraus. Wer die lokale App vom Handy über `http://<LAN-IP>` öffnet, speichert deshalb immer „ohne Position“. Für Tests am Handy braucht es HTTPS (z. B. `next dev --experimental-https`) oder später das Hosting.
- **Rahmen:** Tab-Leiste und Leiste der aktiven Session halten ihren Platz selbst frei. Das Root-Layout setzt `viewport-fit=cover`, damit die Leisten den Bereich über dem Home-Indikator berücksichtigen. Die kompakte Kopfzeile bleibt beim Scrollen oben stehen.
- **Detailansicht:** Die Dauer im Kopf wird beim Laden berechnet und tickt nicht. Die Kennzahlen-Kacheln und die Leiste der aktiven Session ticken minütlich. Ab 12 h Laufzeit hat die Seite zwei Einstiege in dasselbe „Session beenden“-Sheet (Hinweis und Button unten).
- **Genauigkeit über 100.000 m** wird auf 100.000 gekappt, statt die Position zu verwerfen.
- **Live geprüft** gegen die lokale Supabase und die laufende App: Abfrageformen (verknüpfte Fänge, Fanganzahl, Sortierung, Überschneidungsfilter), alle Server Actions über HTTP mit zwei Nutzern (31 Prüfungen), alle Seiten in den Zuständen „leer“, „läuft“, „über 12 h“, „mit Fängen“, fremder Nutzer (404) und ohne Anmeldung (Login).

## Runde 2 nach QA (`/refine` + `/build`, 2026-09-30)

Grundlage ist `qa-report.md` (BUG-1 bis BUG-5). Der Vertrag wurde nur für BUG-1 geändert (AC-24, EC-6), alles andere sind Fixes gegen den bestehenden Vertrag.

- **BUG-1 (AC-24, EC-6):**
  - Eine laufende Session nimmt Fänge nur bis Start + 48 Stunden an, zusätzlich zur Grenze „jetzt + 2 Minuten“. So bleibt jede vergessene Session beendbar.
  - App-Prüfung: `checkCatchTime` in `src/lib/fishing/schemas.ts`.
  - Garantie in der Datenbank: neue Migration `20260930140000_catch_window_and_no_reopen.sql`. Sie ersetzt die beiden Trigger-Funktionen der Fangzeit-Garantie, die frühere Migration bleibt unverändert.
- **BUG-2 (AC-12):** Jede Ablehnung beim Beenden nennt die erlaubte Spanne: „Möglich ist ein Ende zwischen … und ….“ Sie reicht vom Start + 1 Minute bzw. dem letzten Fang bis zum früheren Wert von „jetzt“ und Start + 48 h.
- **BUG-3 (EC-13):** Die Datenbank lehnt „beendet → läuft“ ab (`session_already_ended`), auch bei einem direkten Aufruf der Datenbank-Schnittstelle. Damit gilt die Zusage aus dem Datenmodell jetzt auch in der Datenbank.
- **BUG-5:** `deleteCatch` bekommt die Session-Kennung des Formulars mit. Ist der Fang schon gelöscht und die Session noch da, geht es wie beim ersten Löschen zur Session mit „Fang gelöscht“. Sonst bleibt es bei `session-gone`.
- **BUG-4, bewusst nicht geändert:** siehe Technische Entscheidungen unten.

| Entscheidung | Begründung | Alternative | Nachteil | Datum |
| --- | --- | --- | --- | --- |
| `sessionWasRunning` bleibt eine Angabe des Formulars (QA BUG-4 nicht behoben) | Ob das Formular für eine laufende Session geöffnet wurde, weiß nur der Browser. Eine gefälschte Angabe verfälscht höchstens die Herkunft der **eigenen** Position („GPS“ statt „von der Session“). Das kann jeder Nutzer ohnehin, weil er seine eigenen Zeilen über die Datenbank-Schnittstelle schreiben darf (Row Level Security „nur eigene Zeilen“). | Das Flag nur annehmen, wenn die Session erst kurz vor dem Speichern beendet wurde | Die Herkunftsangabe ist eine Ehrlichkeitsangabe für den Nutzer selbst, keine Sicherheitsgrenze. | 2026-09-30 |
