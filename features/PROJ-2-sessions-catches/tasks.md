# PROJ-2 Aufgaben: Sessions & Fänge

> Erzeugt von `/tasks` aus `spec.md` und `design.md`. Das ist der geordnete, nachverfolgbare Bauplan zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallel ausführbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also an einen eigenen Sub-Agenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC- bzw. EC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Aufgabe → Test.
> Owner: `/tasks` legt diese Datei an, `/build` hakt ab.
> Kein Statusfeld hier: Die Häkchen sind der Fortschritt, der Status des Features lebt nur in `features/INDEX.md`.
> `[user]`-Aufgaben gibt es in PROJ-2 nicht (`design.md` → „Einstellungen, die du selbst machst“: keine).

**Feste Namen, damit parallel gebaute Aufgaben zusammenpassen:**
- **Regeln in der Datenbank** (T1 legt sie an, T2 übersetzt ihre Ablehnungen in Meldungen):
  - `sessions_one_running_per_user`: höchstens eine laufende Session pro Nutzer
  - `sessions_no_overlap`: keine Überschneidung
  - `catches_session_owner_fkey`: Fang auf das Paar „Session + Besitzer“
- **Ablehnungen der Fangzeit-Garantie:** Die Datenbank meldet sie mit dem Text `catch_outside_session`.
- **Artenkennungen:** die 17 aus `design.md` (`perch` … `other`), in dieser Reihenfolge.
- **Hinweis-Codes:** die 8 aus `design.md` → „Seiten und Adressen“.

## Ebene 1: Datenbank und Grundlagen

- [x] T1 [P]  Migration Sessions und Fänge: beide Tabellen mit allen Feldern und Prüfregeln aus `design.md`, Erweiterung `btree_gist`, `sessions_one_running_per_user`, `sessions_no_overlap` (laufend = bis unbegrenzt), `catches_session_owner_fkey`, Mitlöschen über das Profil bzw. die Session, Fangzeit-Garantie beim Anlegen und Ändern von Fängen und beim Ändern von Session-Zeiten (beide sperren die Session-Zeile, obere Grenze einer laufenden Session „jetzt + 2 min“), Indizes, Row Level Security „nur eigene Zeilen“ für Lesen, Anlegen, Ändern und Löschen, keine Rechte für anonyme Aufrufer. Danach gegen die lokale Datenbank prüfen (zweiter Nutzer, anonymer Aufruf, zwei laufende Sessions, Überschneidung, Fang außerhalb).  · files: supabase/migrations/20260930120000_sessions_catches.sql  · → AC-9, AC-12, AC-15, AC-16, AC-18, AC-22, AC-24, AC-32, AC-33, AC-34, AC-40, EC-1, EC-4, EC-9, EC-10, EC-11
- [x] T2 [P]  Eingaberegeln (Zod, für Browser und Server) für Session starten, nachtragen, bearbeiten, beenden und Fang; Artenliste mit deutschen Namen; alle deutschen Meldungen und die 8 Hinweis-Codes; Übersetzung der Datenbank-Ablehnungen in Meldungen; Unit-Tests  · files: src/lib/fishing/schemas.ts, src/lib/fishing/schemas.test.ts, src/lib/fishing/species.ts, src/lib/fishing/messages.ts, src/lib/fishing/db-errors.ts  · → AC-7, AC-12, AC-15, AC-16, AC-18, AC-21, AC-22, AC-24, EC-4, EC-5
- [x] T3 [P]  Anzeige-Helfer: Dauer „1:42 h“, Datum und Uhrzeit in Europe/Berlin, Zahlen im deutschen Format, Genauigkeit „± 12 m“ / „± 1,2 km“, Koordinaten mit 5 Nachkommastellen, „Fänge pro Stunde“ (mindestens 1 Minute Dauer), 12-Stunden-Hinweis; Unit-Tests  · files: src/lib/fishing/format.ts, src/lib/fishing/format.test.ts  · → AC-1, AC-10, AC-11, AC-29, AC-30, AC-31, EC-7, EC-8
- [x] T4 [P]  Formular-Baustein verallgemeinern: neuer allgemeiner Baustein für Server Actions (POST, Eingaben bleiben stehen, Button gesperrt, Feldfehler, Notice „Keine Verbindung“), `use-auth-action` wird zu einer dünnen Hülle darum, Verhalten für PROJ-1 unverändert  · files: src/components/forms/use-server-action.ts, src/components/auth/use-auth-action.ts  · → AC-15, AC-22, EC-2, EC-3
- [x] T5 [P]  Standort-Bausteine (Browser): Abfrage nur auf Aufruf, hohe Genauigkeit, 10 s Grenze, höchstens 30 s alte Position, Ergebnis „Position“ oder „ohne“; Erklärungsdialog vor der ersten Abfrage mit Vermerk im Browser-Speicher (entfällt bei schon erteilter Freigabe); Bestätigungsdialog „Position endgültig entfernen?“; Unit-Tests  · files: src/components/fishing/use-location.ts, src/components/fishing/use-location.test.ts, src/components/fishing/location-explainer.tsx, src/components/fishing/remove-position-dialog.tsx  · → AC-8, AC-14, AC-25, AC-36, AC-37, AC-38, EC-3
- [x] T6 [P]  Konto-Seite in den Unterbereich der Hauptseiten verschieben (Adressen `/account` und `/account/export` bleiben gleich), sonst unverändert  · files: src/app/(app)/account/page.tsx → src/app/(app)/(main)/account/page.tsx, src/app/(app)/account/export/route.ts → src/app/(app)/(main)/account/export/route.ts  · → AC-5

## Ebene 2: Server (Lesen, Server Actions, Export)

- [ ] T7 [P]  Lesefunktionen (nur Server): laufende Session für den Rahmen, Übersicht in Abschnitten zu 20 mit Anzahl der Fänge und ohne Positionen, Detail (Session + Fänge nach Uhrzeit), Gewässernamen-Vorschläge (höchstens 50, zuletzt genutzte zuerst), bis zu 3 zuletzt genutzte Arten, Vorbelegung aus dem zuletzt angelegten Fang der Session; Server Action „Weitere laden“  · files: src/lib/fishing/queries.ts, src/lib/fishing/actions/overview.ts  · → AC-1, AC-4, AC-7, AC-21, AC-23, AC-29, AC-34, EC-12
- [ ] T8 [P]  Server Actions Sessions: starten (Kennung aus dem Formular, „nur anlegen, wenn neu“, bei laufender Session → dorthin mit `session-running`), nachtragen (mit oder ohne Position, Überschneidung mit Nennung der Session), bearbeiten (Zeiten, Gewässer, Notiz; Position bleibt), beenden (nur solange noch laufend; Jetzt / letzter Fang / eigene Zeit), löschen, Position entfernen; fremde oder gelöschte Session → `session-gone`  · files: src/lib/fishing/actions/sessions.ts  · → AC-6, AC-8, AC-9, AC-10, AC-12, AC-13, AC-15, AC-16, AC-17, AC-18, AC-19, AC-38, AC-40, EC-1, EC-2, EC-5, EC-9, EC-13
- [ ] T9 [P]  Server Actions Fänge: anlegen („nur anlegen, wenn neu“, Herkunft der Position `gps` / `session` / `none`, Kopie der Session-Position), bearbeiten (Position bleibt), löschen, Position entfernen; Fangzeit-Ablehnung → Meldung mit aktueller Spanne; fremde oder gelöschte Session → `session-gone`  · files: src/lib/fishing/actions/catches.ts  · → AC-20, AC-22, AC-24, AC-25, AC-26, AC-27, AC-28, AC-32, AC-38, AC-40, EC-2, EC-4, EC-5, EC-10
- [ ] T10 [P]  Datenexport Version 2 (Sessions neueste zuerst mit verschachtelten Fängen nach Fangzeit, alle Felder außer Besitzer- und Session-Kennung, Art als Kennung und deutscher Name) und Abschnitt „Dein Fangbuch“ in der Datenschutzerklärung  · files: src/app/(app)/(main)/account/export/route.ts, src/app/privacy/page.tsx  · → AC-35, AC-39

## Ebene 3: Bausteine der Oberfläche

- [ ] T11 [P]  Rahmen: AppBar (groß mit Überzeile und Titel, kompakt mit Zurück bzw. Schließen und optionaler Aktion rechts), TabBar (Sessions · Start · Konto, aktiver Tab markiert), ActiveSessionBar (Gewässer oder „Ohne Gewässer“, Laufzeit tickt minütlich, Anzahl Fänge, „Fang eintragen“, Tipp → Detail, Hinweis ab 12 h mit „Beenden“)  · files: src/components/shell/app-bar.tsx, src/components/shell/tab-bar.tsx, src/components/shell/active-session-bar.tsx  · → AC-1, AC-3, AC-4, AC-11
- [ ] T12 [P]  Session-Formulare: starten (Standort-Baustein, Button zeigt „Position wird bestimmt …“), nachtragen (Start/Ende, Schalter „Ich bin noch am Gewässer …“), bearbeiten (Ende nur bei beendeten Sessions, Zeile Position mit „Position entfernen“), Gewässer-Feld mit bis zu 5 eigenen Vorschlägen  · files: src/components/fishing/session-start-form.tsx, src/components/fishing/session-backfill-form.tsx, src/components/fishing/session-edit-form.tsx, src/components/fishing/water-name-input.tsx  · → AC-6, AC-7, AC-8, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-38, EC-3, EC-9
- [ ] T13 [P]  Fang-Formular (eintragen, nachtragen, bearbeiten): Uhrzeit, Artauswahl mit bis zu 3 zuletzt genutzten Arten oben und Artname bei „Sonstige“, Länge, Gewicht, Köder, Segment „Zurückgesetzt“ / „Entnommen“, Vorbelegung, Standort nur beim Speichern in laufender Session, Zeile Position mit „Position entfernen“, Dialog „Fang löschen?“  · files: src/components/fishing/catch-form.tsx, src/components/fishing/species-select.tsx, src/components/fishing/delete-catch-dialog.tsx  · → AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-28, AC-38, EC-3, EC-4, EC-10
- [ ] T14 [P]  Bausteine der Detailansicht und Übersicht: Session-Karte (Datum, Gewässer, Dauer bzw. „Läuft“, Anzahl Fänge, keine Koordinaten), Fang-Karte (inkl. Position und Herkunft), Kennzahlen-Kacheln, Sheet „Session beenden“ (drei Wahlmöglichkeiten, „Jetzt“ gesperrt über 48 h), Dialog „Session löschen?“ mit Anzahl der Fänge  · files: src/components/fishing/session-card.tsx, src/components/fishing/catch-card.tsx, src/components/fishing/session-stats.tsx, src/components/fishing/end-session-sheet.tsx, src/components/fishing/delete-session-dialog.tsx  · → AC-1, AC-10, AC-11, AC-12, AC-19, AC-29, AC-30, AC-31, EC-6, EC-7

## Ebene 4: Seiten

- [ ] T15 [P]  Layout der Hauptseiten (lädt die laufende Session, ActiveSessionBar und TabBar, unten genug Platz inkl. Home-Indikator), Konto-Seite mit AppBar „Konto“, Weiterleitung `/start`  · files: src/app/(app)/(main)/layout.tsx, src/app/(app)/(main)/account/page.tsx, src/app/(app)/start/page.tsx  · → AC-3, AC-4, AC-5, AC-33
- [ ] T16 [P]  Sessions-Übersicht `/` (ersetzt den Platzhalter): AppBar „Dein Fangbuch“ / „Sessions“, Hero-Karte „Bereit für den nächsten Wurf?“ ohne laufende Session, „Session nachtragen“, Liste mit „Weitere laden“, Skeleton, Hinweis-Codes  · files: src/app/(app)/(main)/page.tsx, src/app/(app)/page.tsx (entfernen), src/components/fishing/session-list.tsx  · → AC-1, AC-2, EC-8, EC-12
- [ ] T17 [P]  Session-Seiten: `/sessions/new`, `/sessions/backfill`, `/sessions/[id]` (Detail mit Menü Bearbeiten / Session löschen, Hinweis bei fehlender Position, 12-h-Hinweis, Fangliste, leerer Zustand, „Fang eintragen“ bzw. „Fang nachtragen“, „Session beenden“, Hinweis-Codes), `/sessions/[id]/edit`; fremde oder unbekannte Kennung → „Diese Seite gibt es nicht.“  · files: src/app/(app)/sessions/new/page.tsx, src/app/(app)/sessions/backfill/page.tsx, src/app/(app)/sessions/[id]/page.tsx, src/app/(app)/sessions/[id]/edit/page.tsx  · → AC-6, AC-8, AC-10, AC-11, AC-13, AC-17, AC-19, AC-29, AC-30, AC-31, AC-32, EC-5, EC-6
- [ ] T18 [P]  Fang-Seiten: `/sessions/[id]/catches/new` (eintragen bzw. nachtragen je nach Zustand der Session, Kennung beim Öffnen), `/sessions/[id]/catches/[catchId]` (bearbeiten, löschen); fremde oder unbekannte Kennung → „Diese Seite gibt es nicht.“  · files: src/app/(app)/sessions/[id]/catches/new/page.tsx, src/app/(app)/sessions/[id]/catches/[catchId]/page.tsx  · → AC-20, AC-23, AC-26, AC-27, AC-28, AC-32, EC-5

## Abdeckung

Jedes AC und jedes EC aus `spec.md` hat mindestens eine Aufgabe:

- **App-Rahmen und Übersicht**
  - AC-1: T3, T7, T11, T14, T16
  - AC-2: T16
  - AC-3: T11, T15
  - AC-4: T7, T11, T15
  - AC-5: T6, T15
- **Session starten**
  - AC-6: T8, T12, T17
  - AC-7: T2, T7, T12
  - AC-8: T5, T8, T12, T17
  - AC-9: T1, T8
- **Session beenden**
  - AC-10: T3, T8, T14, T17
  - AC-11: T3, T11, T14, T17
  - AC-12: T1, T2, T8, T14
- **Session nachtragen**
  - AC-13: T8, T12, T17
  - AC-14: T5, T12
  - AC-15: T1, T2, T4, T8, T12
  - AC-16: T1, T2, T8, T12
- **Session bearbeiten und löschen**
  - AC-17: T8, T12, T17
  - AC-18: T1, T2, T8, T12
  - AC-19: T8, T14, T17
- **Fang eintragen**
  - AC-20: T9, T13, T18
  - AC-21: T2, T7, T13
  - AC-22: T1, T2, T4, T9, T13
  - AC-23: T7, T13, T18
  - AC-24: T1, T2, T9, T13
  - AC-25: T5, T9, T13
  - AC-26: T9, T13, T18
- **Fang bearbeiten und löschen**
  - AC-27: T9, T13, T18
  - AC-28: T9, T13, T18
- **Detailansicht**
  - AC-29: T3, T7, T14, T17
  - AC-30: T3, T14, T17
  - AC-31: T3, T14, T17
- **Zugriffsschutz**
  - AC-32: T1, T9, T17, T18
  - AC-33: T1, T15
  - AC-34: T1, T7
- **Datenschutz**
  - AC-35: T10
  - AC-36: T5
  - AC-37: T5
  - AC-38: T5, T8, T9, T12, T13
  - AC-39: T10
  - AC-40: T1, T8, T9
- **Edge Cases**
  - EC-1: T1, T8
  - EC-2: T4, T8, T9
  - EC-3: T4, T5, T12, T13
  - EC-4: T1, T2, T9, T13
  - EC-5: T2, T8, T9, T17, T18
  - EC-6: T14, T17
  - EC-7: T3, T14
  - EC-8: T3, T16
  - EC-9: T1, T8, T12
  - EC-10: T1, T9, T13
  - EC-11: T1
  - EC-12: T7, T16
  - EC-13: T8

## Parallelisierung

- **Ebenen sind Schranken:** Datenbank und Grundlagen (E1) → Server (E2) → Bausteine der Oberfläche (E3) → Seiten (E4). Eine Ebene startet erst, wenn die vorige zusammengeführt und gegen ihre AC-IDs geprüft ist.
- **`[P]` verlangt getrennte Dateien.** Geprüft: Keine zwei Aufgaben einer Ebene nennen denselben Pfad.
  - `src/app/(app)/(main)/account/export/route.ts` entsteht in E1 (T6, Verschieben) und wird in E2 (T10) geändert.
  - `src/app/(app)/(main)/account/page.tsx` entsteht in E1 (T6) und wird in E4 (T15) geändert.
  - Beide Fälle liegen in verschiedenen Ebenen, also nacheinander.
- **Gemeinsame Bausteine liegen eine Ebene tiefer als ihre Nutzer.** Der Dialog „Position entfernen“ (T5) wird von T12 und T13 genutzt, der Formular-Baustein (T4) von allen Formularen, die Meldungen (T2) von allen Server Actions.
- **Nach Ebene 1** spielt `/build` die neue Migration in die lokale Datenbank ein (`supabase migration up`), bevor Ebene 2 dagegen geprüft wird.
- **PROJ-1 wird mitgeprüft:** T4 und T6 fassen PROJ-1-Dateien an. Nach Ebene 1 müssen die Unit-Tests von PROJ-1 grün bleiben, und Login, Konto-Seite und Export müssen wie vorher funktionieren.
- **Sub-Agenten:** Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Sub-Agenten mit eigenem Git-Worktree. Danach führt der Haupt-Agent zusammen, prüft gegen die AC-IDs der Ebene und hakt hier ab. Sub-Agenten erklären sich nie selbst für fertig.
