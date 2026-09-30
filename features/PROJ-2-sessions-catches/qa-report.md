# QA-Testergebnisse: PROJ-2 Sessions & Fänge

**Getestet:** 2026-09-30 (zweiter `/qa`-Lauf, Stand `43821db`)
**App-URL:** http://localhost:3553 (`probe.kind: http`, Dev-Server `npm run dev`). Für die Produktionsprüfungen lief zusätzlich `next start` des aktuellen Builds auf http://localhost:3556. Er ist am Ende gestoppt. Die lokale Supabase lief in Docker (API `127.0.0.1:55321`, Mailpit `127.0.0.1:55324`).
**Tester:** QA Engineer (AI). Geprüft haben drei unabhängige `qa-engineer`-Läufe, die den Bau nicht kannten: Abnahme (Step 2), Security (Step 3) und Regression (Step 4 + 5). Alle drei haben berichtet. Der `/qa`-Owner hat den Bau ebenfalls nicht gesehen. Er hat die Suiten einmal vor dem Fan-out laufen lassen, die Migration geprüft, Gegenproben zu den alten Bugs gemacht, die Unit-Tests geschrieben und die Ergebnisse zusammengeführt.
**Autonomer Lauf:** Der Nutzer hat den Lauf vorab freigegeben und war nicht erreichbar. Wo der Skill eine Rückfrage vorsieht, galt die empfohlene Wahl. Die Priorisierung der Bugs (Step 8) steht als Empfehlung unten.

**Umfang: `full` (volle Breite), keine Re-Verifikation.** Begründung nach dem Skill-Abschnitt „Re-verification“:
- Der alte Bericht hatte offene Bugs, und seitdem ist ein Commit dazugekommen. Er kam aber über `/refine`: `43821db` ändert den Vertrag (`spec.md`: AC-24 und EC-6 für BUG-1, dazu eine Zeile im Entscheidungsprotokoll). Der Skill sagt: „Not a re-verification: … a feature back from `/refine` (the contract changed — full width)“.
- Unabhängig davon enthält der Diff eine Migration. Das allein verlangt schon den vollen Fan-out in voller Breite.
- Diff-Befehl: `git diff --stat 68134f3..HEAD`. Geänderte Produktionsdateien:
  - `supabase/migrations/20260930140000_catch_window_and_no_reopen.sql` (neu)
  - `src/lib/fishing/schemas.ts`
  - `src/lib/fishing/actions/sessions.ts`
  - `src/lib/fishing/actions/catches.ts`
  - `src/lib/fishing/messages.ts`
  - `src/components/fishing/delete-catch-dialog.tsx`
  - `src/app/(app)/sessions/[id]/catches/[catchId]/page.tsx`
  - Dazu 5 Testdateien und die Doku (`spec.md`, `design.md`, `tasks.md`, `INDEX.md`).
- Folge: Alle AC und EC wurden in diesem Lauf neu ausgeübt. Nichts ist aus dem alten Bericht übernommen. Jedes `[x]` unten ist eine Prüfung aus diesem Lauf.

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
>
> **Skripte und Testdaten:** Scratchpad des Laufs, Unterordner `acc/` (Abnahme, `t01`–`t23`), `sec/` (Security, `t3`–`t18`), `reg/` (Regression, `t1`–`t9`) und `own/` (Owner, `o1.mjs`, `o2.mjs`). Testkonten: `qa-p2r-acc-*`, `qa-p2r-sec-*`, `qa-p2r-reg-*`, `qa-p2r-own-1-*@example.test`. Alle wurden am Ende samt Daten gelöscht (siehe Aufräumen). Server Actions liefen über HTTP aus Node (`Next-Action`-Header), direkte Datenbankzugriffe über PostgREST mit dem Zugang des jeweiligen Testnutzers und über `psql` im Container.

### Automatisierte Tests und Build (einmal vor dem Fan-out)
- [x] Unit-Suite `npm test`: 23 Dateien, 368 bestanden, 0 fehlgeschlagen, exit 0 (vitest 4.1.11). Die Ausgabe liegt in `suite-run.txt`. Alle Lanes haben diesen Lauf zitiert und die Suite nicht neu gestartet.
- [x] Lint `npm run lint`: exit 0, keine Befunde (`lint.txt`).
- [x] Produktions-Build `npm run build`: exit 0, TypeScript fehlerfrei, 18 Routen plus Proxy (`build.txt`). Der Diff berührt App-Code, deshalb lief der Build.
- [x] Migration (der Diff berührt `supabase/migrations`, deshalb lief die Prüfung):
  - `npx supabase migration list --local` zeigt alle 6 Migrationen lokal und in der DB, inklusive `20260930140000`.
  - Die Funktionskörper von `check_catch_in_session` und `check_session_keeps_catches` in der DB sind identisch mit der Datei (md5 nach Entfernen von Leerraum, `mig-md5.cjs`).
  - Die Trigger `catches_check_in_session` (`before insert or update of caught_at, session_id`) und `sessions_check_keeps_catches` (`before update of started_at, ended_at`) hängen an diesen Funktionen (`pg_get_triggerdef`).
  - Ein erneutes Einspielen der Migration in einer Transaktion mit `rollback` läuft fehlerfrei (`create or replace` + `revoke`, mit `ON_ERROR_STOP`).
  - `execute` für `authenticated` ist entzogen, `search_path` ist leer.
- [x] Neue Unit-Tests aus diesem Lauf: 1 Datei, 5/5 grün, rote Runde gemacht (siehe „Unit-Tests aus /qa“).
- E2E: Es gibt kein `tests/`-Verzeichnis, also nichts auszuführen (siehe unten).

## Acceptance Criteria

#### App-Rahmen & Übersicht
- [x] **AC-1**: `GET /` zeigt „Dein Fangbuch“ und die Tabs „Sessions · Start · Konto“. Jede Karte hat Datum und Uhrzeit, Gewässer bzw. „Ohne Gewässer“, Dauer bzw. „Läuft“ und die Fanganzahl, neueste zuerst (Abnahme `t01`, `t07`, `t18`; `queries.ts:278-296`, `session-card.tsx:46,65`).
- [x] **AC-2**: Ohne Sessions zeigt `/` „Bereit für den nächsten Wurf?“ mit „Session starten“ und darunter „Session nachtragen“ (Abnahme `t01`; `(main)/page.tsx:78-82`).
- [x] **AC-3**: `/start` leitet ohne laufende Session mit 307 nach `/sessions/new`, mit laufender Session nach `/sessions/<id>` (Abnahme `t01`, `t02`; `start/page.tsx:11-15`).
- [x] **AC-4**: Auf `/` und `/account` steht die Leiste der laufenden Session mit Gewässer bzw. „Ohne Gewässer“, Laufzeit, Fanganzahl und „Fang eintragen“. Die Leiste verlinkt auf die Detailansicht. Unterseiten haben keine Leiste (Abnahme `t02`; `active-session-bar.tsx:106-130`).
- [x] **AC-5**: `/account` zeigt die Konto-Seite aus PROJ-1 im Rahmen: AppBar „Konto“, Tab-Leiste mit `aria-current="page"` auf „Konto“, kein zweiter Header (Abnahme `t01`, Regression PROJ-1 AC-19).

#### Session starten
- [x] **AC-6**: `startSession` legt die Session an. Der Start ist die Server-Minute, der Name ist getrimmt, die Genauigkeit wird von 12,4 auf 12 gerundet. Die Antwort leitet nach `/sessions/<id>?notice=session-started`, dort stehen „Session gestartet“, die Koordinaten und „± 12 m“ (Abnahme `t02`; Owner `o1.mjs`). Die echte Ortung im Browser ist NOT VERIFIED. Zum Randfall nach einer Session mit Ende in der Zukunft siehe BUG-8.
- [x] **AC-7**: 81 Zeichen Name ergeben „Höchstens 80 Zeichen.“, 501 Zeichen Notiz „Höchstens 500 Zeichen.“, jeweils in Start, Nachtrag und Bearbeiten. 80 bzw. 500 Zeichen werden gespeichert. Die Vorschläge enthalten nur eigene Namen, die zuletzt genutzten zuerst (Abnahme `t22`; `queries.ts:359-369`). Den Filter im Browser belegt `session-forms.test.tsx:230`.
- [x] **AC-8**: Ein Start ohne Position speichert keine Position. Die Detailseite zeigt „Ohne Position“ und „Position fehlt. Prüfe die Standortfreigabe deines Browsers.“ (`[id]/page.tsx:154`). Die 10-s-Grenze steht in `use-location.ts:61-86` und ist durch `use-location.test.ts:131` in der Suite belegt (Abnahme).
- [x] **AC-9**: Ein zweiter Start mit neuer Kennung leitet nach `?notice=session-running` auf die laufende Session, es bleibt 1 Session. Die Seite zeigt „Es läuft bereits eine Session.“ (Abnahme `t02`).

#### Session beenden
- [x] **AC-10**: `endSession` mit „now“ leitet nach `?notice=session-ended`, der Toast lautet „Session beendet · 0:02 h“. Danach fehlt die Leiste auf `/`, die Hero-Karte ist zurück. Die Auswahl „Jetzt“ im Sheet belegen `end-session-sheet.test.tsx:54,65` (Abnahme `t06`, `t07`).
- [x] **AC-11**: Bei einer Session, die seit 50 h läuft, zeigen Leiste und Detailansicht „Läuft seit über 12 Stunden. Vergessen zu beenden?“ mit „Beenden“ (Abnahme `t12`; `format.ts:142`).
- [x] **AC-12**: Abgelehnt werden: Ende vor dem Start, gleich dem Start, vor dem letzten Fang, in der Zukunft, mehr als 48 h. Es wird nichts gespeichert. Jede Meldung nennt jetzt die Spanne („Möglich ist ein Ende zwischen … und ….“), bei eigener Uhrzeit am Feld `endedAt` (Abnahme `t09`, `t12`; Owner `o1.mjs` P5: „… höchstens 48 Stunden (bis 30.09., 00:42). Möglich ist ein Ende zwischen 30.09., 00:42 und 30.09., 00:42.“). **BUG-2 ist behoben.**
- [ ] **AC-12, Randfall** — BUG-7 (Low): In der ersten Minute einer Session und bei einem letzten Fang in der 2-Minuten-Toleranz nennt die Meldung eine umgekehrte Spanne („zwischen 30.09., 02:43 und 30.09., 02:42“).

#### Session nachtragen
- [x] **AC-13**: `backfillSession` legt eine beendete Session ohne Position an, auch wenn bei ausgeschaltetem Schalter eine Position mitgeschickt wird. Die Antwort leitet mit `?notice=session-saved` weiter (Abnahme `t09`; `schemas.ts:157-167`).
- [x] **AC-14**: Mit Schalter wird die Position 52.5/13.3 mit Genauigkeit 35 gespeichert. Die Abfrage erfolgt nur mit Schalter (Abnahme `t09`; `session-forms.test.tsx:105,125`).
- [x] **AC-15**: Direkte Server-Aufrufe (Browser-Prüfung umgangen) lehnen am Feld ab: Ende vor oder gleich dem Start, mehr als 48 h, Start oder Ende in der Zukunft, fehlendes Ende, 1900 mit 49 h. Genau 48 h werden gespeichert. Die Prüfsummen der Datenbank bleiben gleich (Abnahme `t09`, `t10`; Security `t8-bypass.cjs`). Dass die Eingaben stehen bleiben, belegt `session-forms.test.tsx:158`. Zur fehlenden Zukunftsregel in der Datenbank siehe BUG-9.
- [x] **AC-16**: Die Meldungen lauten „Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.“ bzw. „… laufenden Session seit 29.09., 23:42.“ Aneinandergrenzende Sessions werden gespeichert. Die Datenbank-Garantie greift per REST mit 23P01 `sessions_no_overlap` (Abnahme `t09`–`t11`; `20260930120000_sessions_catches.sql:72-77`).

#### Session bearbeiten & löschen
- [x] **AC-17**: Name, Notiz, Start und Ende werden geändert, danach folgt `?notice=session-saved`. Mitgeschickte Positionsfelder werden ignoriert, die Position 54.1/13.4/20 bleibt. Eine laufende Session hat kein Endfeld (Abnahme `t10`, `t11`).
- [x] **AC-18**: Start nach dem Fang bzw. Ende davor ergibt „Der Fang um 17:20 (Hecht) läge außerhalb der Session.“ Es wird nichts gespeichert. Ein REST-`PATCH` auf `started_at` ergibt 400 `catch_outside_session` (Abnahme `t10`; neue Migration Z. 53-64).
- [x] **AC-19**: `deleteSession` löscht die Session samt 2 Fängen (DB 0/0) und leitet nach `/?notice=session-deleted`. Eine laufende Session lässt sich löschen, danach fehlt die Leiste. Der Dialog bekommt die Fanganzahl 2 (Payload), der Text steht in `messages.ts:91-95` (Abnahme `t17`).

#### Fang eintragen
- [x] **AC-20**: `createCatch` mit GPS speichert `position_source = gps` und leitet nach `?notice=catch-saved`. Die Standard-Fangzeit ist die Minute beim Öffnen des Formulars (Abnahme `t03`; `catches/new/page.tsx:17-19`).
- [x] **AC-21**: Die Reihenfolge der 17 Arten stimmt (`species.ts:4-22`, DB-Check in der Migration Z. 122-125). Die zuletzt genutzten Arten stehen oben (Payload `recentSpecies ["perch","eel","zander"]`). „Sonstige“ ohne Namen ergibt „Bitte gib die Fischart ein.“, 41 Zeichen „Höchstens 40 Zeichen.“ (Abnahme).
- [x] **AC-22**: 24 ungültige Fälle per HTTP (Abnahme `t04`) und 19 per Security `t6` werden am Feld abgelehnt: Art, Länge (0, 251, 30.5, -3, leer, „abc“), Gewicht (0, 150001, 12.5), Köder mit 61 Zeichen, `released` fehlend oder als String. Die Grenzwerte 1/250/150000/60 werden gespeichert. Die CHECK-Regeln der DB lehnen dieselben Werte ab.
- [x] **AC-23**: Beim ersten Fang sind „Zurückgesetzt“ und ein leerer Köder vorbelegt, danach die Werte des zuletzt angelegten Fangs („Wobbler“, „Entnommen“) (Abnahme `t03`, `t04`).
- [x] **AC-24** (verfeinert): Abgelehnt werden eine Zeit vor dem Start, nach dem Ende, jetzt + 5 min und bei einer laufenden Session Start + 48 h + 1 min. Die Meldung lautet „Die Fangzeit muss zwischen … und … liegen.“ Start, Ende und genau Start + 48 h werden gespeichert. Die Datenbank lehnt per REST mit `catch_outside_session` ab. Belege:
  - Abnahme `t05`, `t12`, `t15`; Security `t6`.
  - Owner `o1.mjs` P5, Session seit 50 h: Ein Fang jetzt wird abgelehnt mit „… zwischen 28.09., 00:42 und 30.09., 00:42 …“, 0 Zeilen. Ein Fang bei Start + 48 h wird gespeichert, einer bei + 1 min abgelehnt. Ein REST-Insert ergibt 400 P0001.
  - Code: `schemas.ts:337-338`, neue Migration Z. 28-34.
- [x] **AC-25**: Ohne GPS wird die Session-Position mit Herkunft `session` kopiert, ohne Session-Position gilt `none`. Eine kaputte Position (lat „x“) ergibt `none`, der Fang geht nicht verloren (Abnahme `t03`; `catches.ts:153-175`).
- [x] **AC-26**: Beim Fang nachtragen in einer beendeten Session wird eine mitgeschickte Client-Position verworfen. Es gilt die Kopie der Session (`session`) bzw. `none`. Beim Nachtragen gibt es keine Standortabfrage (Abnahme `t15`; Owner `o1.mjs` P3 „honest flag“ → `52.5|13.4|session`; `catch-form.test.tsx:171`). Mit einer manipulierten Anfrage lässt sich das umgehen. Das ist BUG-4, **akzeptiert** (siehe unten).

#### Fang bearbeiten & löschen
- [x] **AC-27**: Es gelten dieselben Regeln (Zeit außerhalb, Länge 300, „Sonstige“ ohne Namen). Mitgeschickte `sessionId`, Position, `user_id` und `position_source` bleiben ohne Wirkung, danach folgt `?notice=catch-saved` (Abnahme `t15`; Security `t8`, `t9`; `catches.ts:321-322`).
- [x] **AC-28**: `deleteCatch` entfernt die Zeile und leitet nach `?notice=catch-deleted` mit „Fang gelöscht“. Ein zweites Löschen führt ebenfalls zur Session (Abnahme `t17`; Owner `o1.mjs` P2). **BUG-5 ist behoben.**

#### Detailansicht
- [x] **AC-29**: Die Detailseite zeigt Gewässer, Datum, „15:30 bis 19:00“, Dauer, Kennzahl und die Fänge nach Uhrzeit mit Art, Länge, Gewicht, Köder, Status und Herkunft der Position („± 800 m · GPS“, „· von der Session“, „Ohne Position“) (Abnahme).
- [x] **AC-30**: 2 Fänge in 7 h ergeben „0,3“, 2 in 3,5 h „0,6“, 11 in 2 min „330,0“. Bei einer laufenden Session wird bis jetzt gerechnet (Abnahme; `format.ts:131-139`).
- [x] **AC-31**: Eine Session ohne Fang zeigt „Noch keine Fänge. Petri Heil!“ und „0,0“. Sie bleibt in Übersicht und Export (Abnahme `t02`).

#### Zugriffsschutz
- [x] **AC-32**: Nutzer B gegen A, über die App und direkt über die Datenbank:
  - App: B ruft 6 Unterseiten mit Kennungen von A auf und bekommt 404 „Diese Seite gibt es nicht.“, genauso lang wie bei einer zufälligen UUID (11073 Zeichen). 14 Action-Angriffe ergeben `session-gone` bzw. „Bitte prüfe deine Eingaben.“ Die Zeilen von A und B sind danach unverändert (md5-Prüfsummen).
  - PostgREST mit dem Token von B:
    - GET liefert nur eigene Zeilen, auch eingebettet.
    - PATCH und DELETE auf Zeilen von A treffen 0 Zeilen.
    - Ein Insert mit `user_id = A` scheitert mit 403 (RLS).
    - Ein Fang in einer Session von A scheitert mit 409 an `catches_session_owner_fkey`, ein Umhängen ebenfalls mit 409 bzw. 403.
    - RPC auf die Trigger-Funktionen ergibt 404, GraphQL ist aus.
  - Belege: Security `t3`, `t4`, `t5`; Abnahme `t13`, `t14`; RLS in der Migration Z. 273-329, FK Z. 112-115.
- [x] **AC-33**: Ohne Anmeldung, mit unsinnigem Cookie und mit gefälschtem JWT (`alg:none`, falscher Schlüssel) enden alle 10 Seiten und 5 Actions mit 307 → `/login`, 60 Anfragen insgesamt. anon-REST auf `sessions`/`catches` ergibt 401 (Security `t15-anon.cjs`; Abnahme `t01`, `t13`; `src/proxy.ts:56`, `require-user.ts:10-17`).
- [x] **AC-34**: A sieht bei den Vorschlägen keine Namen von B und umgekehrt (Abnahme `t14`; Security `t14-ac34.cjs`).

#### Datenschutz
- [ ] **AC-35** — BUG-6 (Medium): Unter 1000 Sessions ist der Export vollständig: `version 2`, alle Felder samt Position, Genauigkeit, Herkunft und `species_label`, kein `user_id`, keine fremden Daten, `attachment` und `private, no-store` (Abnahme `t17`; Security `t12`, `t13`). **Ab 1001 Sessions** wird er ohne Hinweis abgeschnitten: Bei 1104 Sessions enthält er 1000 (Abnahme `t23`).
- [x] **AC-36**: Der einzige Zugriff auf die Standort-API steht in `use-location.ts:110-123`. Aufgerufen wird er nur beim Speichern: im Start-Formular, im Fang-Formular nur bei laufender Session (`catch-form.tsx:190-191`), beim Nachtragen nur mit Schalter. `watchPosition` gibt es nicht. Belege: `use-location.test.ts:74`, `catch-form.test.tsx:74`, `session-forms.test.tsx:56,105` in der Suite (Abnahme). Die echte Browser-Abfrage ist NOT VERIFIED.
- [!] **AC-37** — NOT VERIFIED (Browser): Code und Test sind bestätigt. Der Erklärtext mit Link „Datenschutz“ → `/privacy` steht in `location-explainer.tsx:19,53-60`. Die Abfrage kommt erst nach „Weiter“ (`use-location.ts:113-119`, `use-location.test.ts:173`). Die tatsächliche Reihenfolge vor dem Rechte-Dialog des Browsers braucht einen Browser.
- [x] **AC-38**: `removeSessionPosition` leert die Session-Position, der Fang behält seine Kopie (54.1/13.4/20, `session`). `removeCatchPosition` leert den Fang und setzt `none`. Die Detailseite zeigt „Ohne Position“ (Abnahme `t15`; Security `t17`, `t18`).
- [x] **AC-39**: `/privacy` hat den Abschnitt „Dein Fangbuch“ mit Positionen samt Zeitpunkt, Gewässer, Notizen, Fangangaben, Zweck, „Nur du kannst sie sehen“ und Speicherdauer bis zur Löschung (Abnahme; Regression PROJ-1 AC-30).
- [x] **AC-40**: Nach dem Löschen von Fang, Session und Konto sind die Zeilen sofort weg (count 0). In `public` gibt es keine Spalte für weiches Löschen (`information_schema`) (Abnahme `t17`, `t20`; Security `t17-del.cjs`).

## Edge Cases

- [x] **EC-1**: 6 parallele Starts mit verschiedenen Kennungen ergeben 1 × `session-started`, 5 × `session-running` und 1 laufende Session. REST ergibt 409 23505. Garantie: eindeutiger Index `sessions_one_running_per_user` (`20260930120000_sessions_catches.sql:63-65`) (Abnahme `t21`; Security).
- [x] **EC-2**: 6 parallele `createCatch` bzw. `backfillSession` mit derselben Kennung ergeben jeweils 1 Zeile, alle Antworten „gespeichert“. Garantie: Primärschlüssel plus Zweig `duplicate-id` (`db-errors.ts:46`, `sessions.ts:225-228`, `catches.ts:256-269`). Die Button-Sperre steht in `catch-form.tsx:356`, `session-start-form.tsx:132`, `session-backfill-form.tsx:225` und ist durch `use-server-action.test.ts` in der Suite belegt (Abnahme `t21`; Security `t10-ec2.cjs`).
- [x] **EC-3**: Belegt über Code und Tests, zur Laufzeit nicht provoziert: Warn-Notice, Eingaben bleiben, Kennung und Position bleiben für den zweiten Versuch (`use-server-action.ts:85-89`, `catch-form.tsx:175-176,191`; `catch-form.test.tsx:114`, `session-forms.test.tsx:56,76,125`, `use-server-action.test.ts:42`). Ein echter Verbindungsabbruch ist NOT VERIFIED.
- [x] **EC-4**: Session auf „Gerät 1“ beendet, Fang auf „Gerät 2“ danach → „Die Session wurde inzwischen beendet (Ende 30.09., 02:42).“ Ein Fang innerhalb wird mit GPS gespeichert. Garantie: `for share` auf die Session-Zeile im Fang-Trigger (neue Migration Z. 16-21) gegen den Update-Trigger der Session und das Beenden nur bei leerem Ende (`sessions.ts:393-399`) (Abnahme `t16`; Security `t11-ec4.cjs`).
- [x] **EC-5**: Nach dem Löschen der Session führen `createCatch`, `updateSession`, `endSession` und `deleteSession` alle nach `/?notice=session-gone`. `/` zeigt „Diese Session gibt es nicht mehr.“ (Abnahme `t16`).
- [x] **EC-6** (verfeinert): Eine Session läuft seit 50 h.
  - „Jetzt“ wird abgelehnt mit „… höchstens 48 Stunden (bis …) …“, eine eigene Uhrzeit bei Start + 48 h + 1 min ebenfalls.
  - „Zeit des letzten Fangs“ beendet die Session mit genau 48:00 h.
  - Fänge nach der 48-h-Marke werden in App und DB abgelehnt, es gibt also immer eine gültige Endzeit.
  - Im Sheet ist „Jetzt“ gesperrt, vorausgewählt ist der letzte Fang bzw. nichts (`end-session-sheet.tsx:62-73,230`, Tests `:70,81`).
  - Belege: Abnahme `t12`; Owner `o1.mjs` P5 (`Session beendet · 48:00 h`); Unit-Test `schemas.catch-window.test.ts`.
  - **BUG-1 ist behoben.**
- [x] **EC-7**: Genauigkeit 800 m ergibt „± 800 m · GPS“, 1500 m „± 1,5 km · GPS“. Beide werden gespeichert (Abnahme; `format.ts:177-181`).
- [x] **EC-8**: Über das Ende der Sommerzeit (22:00 → 04:00) ergibt „7:00 h“, über den Beginn der Sommerzeit (01:00 → 04:00) „2:00 h“, über Mitternacht „bis 21.09., 02:10“ mit „3:40 h“. Die Session steht jeweils unter dem Startdatum (Abnahme `t18`).
- [x] **EC-9**: Bei einer laufenden Session werden abgelehnt: Start in der Zukunft, Start nach dem ersten Fang („Der Fang um 01:42 (Barsch) …“), Start in einer anderen Session. Jede Meldung nennt den Grund (Abnahme `t10`, `t11`). Das Zurücksetzen des Starts über 48 h vor einen neueren Fang lehnt `firstCatchOutside` ab (Unit-Test `schemas.catch-window.test.ts`).
- [x] **EC-10**: Die Session wurde anderswo auf 19:00 gekürzt, der Fang wird auf 19:30 bearbeitet → „Die Fangzeit muss zwischen 15:30 und 19:00 liegen.“ Garantie: Trigger `check_catch_in_session` bei einem Update von `caught_at` (neue Migration Z. 6-38) (Abnahme `t15`; Security `t11`).
- [x] **EC-11**: Ein Konto mit laufender Session und 12 Fängen wird per `deleteAccount` gelöscht. Danach sind Sessions, Fänge, Profil und `auth.users` je 0 (Abnahme `t20`; Security `t18.cjs`; Regression PROJ-1 EC-12).
- [x] **EC-12**: Bei 504 Sessions antwortet `GET /` in 170 ms mit 20 Karten und „Weitere laden“. 25 × `loadMoreSessions` (je höchstens 110 ms) liefern alle 504, ohne Doppelte und ohne Positionsfelder (Abnahme `t19`, `t19b`). Das Rendern im Browser ist NOT VERIFIED.
- [x] **EC-13**: Ein direkter `PATCH ended_at = null` über PostgREST ergibt 400 `session_already_ended`, das Ende bleibt gesetzt. In der App setzt keine Action das Ende auf leer, und `updateSession` ohne Ende bei einer beendeten Session ergibt eine Pflichtmeldung (Abnahme; Security `t6`, `t11`; Owner `o1.mjs` P4; neue Migration Z. 49-51). **BUG-3 ist behoben.**

#### Zusätzliche Edge Cases (nicht in der Spec)
- [x] **Wiederholtes Löschen desselben Fangs** (früher BUG-5):
  - Löschen #1 und #2 mit Session-Kennung ergeben beide `/sessions/<id>?notice=catch-deleted`.
  - Ohne Session-Kennung ergibt es `session-gone`, mit ungültiger Kennung „Bitte prüfe deine Eingaben.“
  - Eine fremde Session in der Anfrage bleibt `session-gone` und verrät nichts (Owner `o1.mjs` P2; Abnahme `t17`; `catches.ts:368-376`).
  - Nur `[catchId]/page.tsx:32` rendert den Dialog, und zwar mit `sessionId`.
- [ ] **Beenden in der ersten Minute bzw. mit einem letzten Fang in der Toleranz** — BUG-7 (Low), siehe unten.
- [ ] **„Session starten“ direkt nach einer Session, deren Ende in der Zukunft liegt** — BUG-8 (Low), siehe unten.
- [x] **Kaputte oder unplausible Position**: lat „x“ ergibt `none`, eine Genauigkeit von 250 km wird auf 100.000 m gekappt (Abnahme; `schemas.ts:126-135`).
- [x] **Unbekannter `?notice`-Code** wird ignoriert. Eine fremde Fang-Kennung unter der eigenen Session-Adresse ergibt 404 (Abnahme; `[catchId]/page.tsx:22`).
- [x] **Zeitraum-Filter der Übersicht**: Ein PostgREST-Filter als Cursor (`…),user_id.neq.x,or(…`) wird mit „Bitte prüfe deine Eingaben.“ abgelehnt (Security `t12`; `queries.ts:177-181`).
- [x] **Übergroße Anfrage**: Ein Body mit 1 MB wird am Body-Limit der Server Actions abgelehnt, es entsteht nichts (Security).

## Security-Audit (Red Team)

_Ausgeführt von der Security-Lane, Brute Force und Kontoauflistung von der Regressions-Lane (PROJ-1). Skripte in `sec/` bzw. `reg/`._

- [x] **Authentifizierung**: 60 Anfragen ohne, mit unsinnigem und mit gefälschtem Cookie/JWT ergeben alle 307 → `/login`, die DB bleibt unverändert. Auch Pfade außerhalb des Proxy-Matchers (`/sessions/x.png`) leiten um. Jede Action ruft zuerst `requireUser()` auf (`sessions.ts:207/252/295/354/418/443`, `catches.ts:215/292/355/392`; `src/proxy.ts:56`).
- [x] **Autorisierung**: siehe AC-32. B kommt weder über die App noch über PostgREST an Daten von A. RLS ist für beide Tabellen aktiv (`relrowsecurity = t`), mit `*_own`-Policies für alle vier Operationen und `with check` bei insert/update. Dazu kommt der FK auf das Paar (Session, Besitzer). Keine der Tabellen ist in der Realtime-Publication.
- [x] **Eingabeprüfung / XSS / Injection**:
  - `<img src=x onerror=…>`, `"><svg onload=…>`, `<script>` und `'); drop table public.sessions; --` in Gewässer, Notiz, Artname und Köder werden roh gespeichert.
  - Auf Übersicht, Detail, Bearbeiten und Fang erscheinen sie nur escaped. `dangerouslySetInnerHTML` gibt es in `src` nicht. Die Tabellen bleiben intakt.
  - Belege: Security `t12-inject.cjs`; Zod-Schemas in `schemas.ts:37-248`.
- [!] **Rate Limiting auf den PROJ-2-Actions und PostgREST** — NOT VERIFIED, nicht umgesetzt (für das MVP optional). 40 × `createCatch` in 8,5 s, 60 × `loadMoreSessions` und 60 × REST-GET liefen alle durch. Betroffen sind nur eigene Daten.
- [x] **Brute Force**: PROJ-2 hat keinen Pfad, der Zugangsdaten prüft (Security-Lane). Die Login-Bremse aus PROJ-1 greift weiter (Regression `t4-throttle.mjs`):
  - Der 6. Fehlversuch wird gesperrt, auch mit richtigem Passwort.
  - 20 Adressen mit gefälschtem `X-Forwarded-For` werden ab dem 21. Versuch gesperrt, alle Versuche zählen unter `ip='untrusted'`.
  - Die 6. Registrierung wird abgelehnt.
  - Der Passwortcheck beim Konto löschen zählt mit (PROJ-1 AC-23, AC-24, AC-26, EC-11).
- [x] **Keine Kontoauflistung**: Unbekannte Adresse und falsches Passwort ergeben beide wörtlich „E-Mail oder Passwort ist falsch.“ (Regression PROJ-1 AC-8). Für PROJ-2 antworten fremde und nicht existierende Kennungen auf den Seiten gleich (404, gleiche Länge).
- [x] **Keine Zugangsdaten oder Positionen in URLs**: Alle 5 Formulare haben `method="post"`, im Code (`catch-form.tsx:214`, `end-session-sheet.tsx:211`, `session-backfill-form.tsx:198`, `session-edit-form.tsx:117`, `session-start-form.tsx:127`) und im SSR-HTML von :3556. Weiterleitungen enthalten nur UUIDs und feste `notice`-Codes. In 861 Kong-Zugriffslogs steht keine Koordinate.
- [x] **Keine Positionen im Server-Log (Produktions-Build)**: Ein ausgelöster Fehlerpfad mit Koordinaten schreibt nur `[fishing] start-session failed: Error 23P01 …`, keine Koordinate (`start3556.txt`). Geloggt werden nur Code und Meldung (`sessions.ts:65-68`, `catches.ts:83-87`), dazu `logging.serverFunctions: false` in `next.config.ts:8`. Die Ausgabe des Dev-Servers ist NOT VERIFIED.
- [x] **Keine Geheimnisse im Client-Bundle**: 63 Dateien in `.next/static` wurden nach den Werten von Service-Role-Key, Secret-Key, JWT-Secret, S3-Secret und DB-Passwort sowie nach den Namen `SERVICE_ROLE`, `SECRET_KEY` und `sb_secret_` durchsucht: 0 Treffer. `src/lib/supabase/admin.ts:5` ist `server-only`, PROJ-2 importiert es nicht.
- [x] **Keine sensiblen Daten in Antworten**: `loadMoreSessions` liefert nur `id, startedAt, endedAt, waterName, catchCount`. Im HTML stehen weder `user_id` noch E-Mail. Der Export enthält kein `user_id` und keine fremden Daten. Fehlerantworten enthalten keine DB-Details.
- [x] **Sicherheits-Header und Cache** (:3556): `/`, `/sessions/<id>`, `/edit`, `/backfill` und `/account/export` liefern `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: origin-when-cross-origin`, HSTS mit `includeSubDomains` und `Cache-Control: private, no-store` (Security; Regression `t7-prodcache.mjs`).
- [x] **Garantien für eigene Daten über die Datenbank-Schnittstelle**:
  - Es greifen: höchstens eine laufende Session, `sessions_no_overlap`, Dauer 1 min–48 h, `catch_outside_session`, `session_already_ended` sowie die Regeln für Art, Länge, Gewicht, Köder und Position (Security `t6-own-db.cjs`).
  - **Lücke:** Zeiten in der Zukunft sind nur in der App verboten, siehe BUG-9.

## Regression (PROJ-1 Registrierung & Login)

Kein Feature hat den Status „Deployed“. Regressionsziel war PROJ-1 (Approved), weil es Code und Daten mit PROJ-2 teilt (`git diff --stat main..HEAD`: Konto-Seite und Export verschoben bzw. Version 2, neue Übersicht, `use-auth-action.ts` auf `use-server-action.ts`, Datenschutzseite, `layout.tsx`). Die Regressions-Lane hat alle PROJ-1-Kriterien gegen die laufende App ausgeübt (`reg/t1`–`t8`):

- [x] **PROJ-1 AC-1, AC-3 bis AC-11, AC-13 bis AC-26 und AC-28 bis AC-34**: bestanden, z. B.:
  - Registrierung mit Mail, Bestätigungslink und Login/Logout.
  - Passwort zurücksetzen und ändern, inklusive Abmeldung des zweiten Geräts.
  - Login-Bremse und Registrierungslimit.
  - Export v2 mit PROJ-2-Sessions.
  - Konto löschen mit 0 Zeilen in `auth.users`/`profiles`/`sessions`/`catches`.
  - AC-31 und AC-32 sind über die Cron-Jobs `petrilog-auth-throttle-cleanup` und `petrilog-unconfirmed-accounts-cleanup` belegt, den Ablauf hat die Lane nicht abgewartet.
- [x] **PROJ-1 EC-1 bis EC-5 und EC-7 bis EC-13**: bestanden. EC-12 ist neu belegt: Ein Konto mit laufender Session, Fang mit Position und nachgetragener Session hinterlässt überall 0 Zeilen. EC-13 wurde über ein per SQL zurückgesetztes `expires_at` geprüft.
- [!] **PROJ-1 AC-2, AC-12, AC-27, EC-5 (Button-Sperre), AC-8 (Feld bleibt stehen) und EC-6**: reine Browser-Darstellung bzw. echter Verbindungsabbruch. Nur Quelle und Unit-Tests (`use-server-action.test.ts`) sind belegt.
- [!] **PROJ-1 AC-10 und AC-22 (Zurück-Taste)**: Anmeldung über Wochen und bfcache sind nicht auslösbar. Belegt sind das Cookie mit 400 Tagen und `private, no-store` im Produktions-Build.
- **Keine Regression gefunden.** Suite 368/368, Lint und Build sind grün.

## Unit-Tests aus /qa

- [x] `src/lib/fishing/schemas.catch-window.test.ts` (AC-24, EC-6, EC-9): 5 Tests. Sie prüfen, dass Fangfenster und Endzeit-Regeln zusammenpassen:
  - Für jede Fangzeit, die `checkCatchTime` bei einer laufenden Session annimmt, gilt: Sie liegt höchstens bei Start + 48 h, und das Ende „Zeit des letzten Fangs“ besteht `sessionTimeErrors` und `firstCatchOutside`. Geprüft über 6 Zeitpunkte von 1 h bis 200 h nach dem Start, mehr als 100 angenommene Fangzeiten.
  - Kurz vor der Marke reicht „jetzt + 2 min“ nie über Start + 48 h.
  - Nach der Marke nennt die Ablehnung Start + 48 h als Ende des Fensters.
  - Eine beendete Session behält ihr eigenes Ende als Grenze.
  - Ein Start, der über 48 h vor einen neueren Fang zurückgesetzt wird, wird abgelehnt.
  - **Rote Runde:**
    - Die Grenze in `checkCatchTime` wurde auf den Stand vor dem Fix zurückgesetzt (ohne 48-h-Deckel), und eine Erwartung wurde umgekehrt. Ergebnis: 5/5 rot, jeweils mit dem Fehler, den der Test abfangen soll, z. B. „expected 1789215060000 to be less than or equal to 1789214700000“.
    - Danach wurde `schemas.ts` per `git checkout` wiederhergestellt: 5/5 grün.
    - Hinweis: Während der rund 15 s der roten Runde hat der laufende Dev-Server die zurückgesetzte Grenze ausgeliefert. Die AC-24-Ergebnisse beider Lanes und die Owner-Gegenprobe `o1.mjs` P5 nach der Wiederherstellung passen zum wiederhergestellten Code. Eine Auswirkung ist nicht erkennbar.
- Befehl: `npx vitest run src/lib/fishing/schemas.catch-window.test.ts`, Ergebnis 5/5 grün.
- Nicht neu getestet, weil schon abgedeckt: die Spannen-Meldung beim Beenden (`sessions.test.ts`, im Diff angepasst), das wiederholte Löschen (`catches.test.ts:552`) und `endAllowedSpan` (reine Textvorlage).

## E2E-Tests
- Status: **nicht ausgeführt** (für kritische Abläufe `/e2e-tests` ausführen). Es gibt noch kein `tests/`-Verzeichnis.

## Not Verified In This Run

- [!] **Darstellung im Browser**: Toasts, Sheet „Session beenden“, Lösch- und Positionsdialoge, Arten-Dropdown mit „Zuletzt“, 44-px-Touch-Ziele, Zahlentastatur, schwebende Leiste und minütliches Hochzählen. `/qa` läuft ohne Browser. Geprüft sind HTML, Payload, Quelltext und Unit-Tests.
- [!] **Cross-Browser** (Chrome, Firefox, Safari) und **Responsive** (375 / 768 / 1440 px): kein Browser, kein Viewport.
- [!] **Echte Standortabfrage** (AC-6, AC-8, AC-14, AC-20, AC-25, AC-36, AC-37): Rechte-Dialog, tatsächliche 10-s-Grenze, Erklärung vor der ersten Abfrage. Es gibt hier keine Geolocation-Engine. Belegt sind Code und `use-location.test.ts`.
- [!] **EC-3 und PROJ-1 EC-6 mit echtem Verbindungsabbruch**: nicht provoziert, weil Dev-Server und Supabase nicht gestoppt werden dürfen. Belegt nur über Tests.
- [!] **Echter gleichzeitiger Wettlauf** zwischen zwei Geräten (EC-1, EC-2, EC-4, EC-10): Parallele Anfragen wurden geschickt, die Garantien im Schema sind bestätigt. Ein echter Wettlauf im selben Moment wurde nicht erzwungen.
- [!] **EC-12 „Seite hängt nicht spürbar“**: Gemessen ist nur die Serverzeit (170 ms bzw. höchstens 110 ms), nicht das Rendern im Browser.
- [!] **Tempo-Ziel unter 30 Sekunden am Smartphone** (Technische Anforderung): Das braucht einen Menschen mit Gerät.
- [!] **Rate Limiting auf den PROJ-2-Actions**: nicht umgesetzt (für das MVP optional).
- [!] **Koordinaten in der Ausgabe des Dev-Servers**: nicht einsehbar. Belegt nur für das Log von :3556 und über `logging.serverFunctions: false`.
- [!] **Browser-Konsole und Netzwerk-Tab**: Dafür braucht es DevTools.
- [!] **PROJ-1-Laufzeiten** (Link 24 h / 1 h, Aufräumjobs nach 24 h / 7 Tagen, Anmeldung über Wochen): nicht abgewartet. Belegt sind die Konfiguration bzw. die Cron-Jobs.

## Bugs Found

### Stand der Bugs aus dem ersten Lauf (`68134f3`)

| Bug | Stand | Beleg |
|-----|-------|-------|
| BUG-1 (Medium, EC-6) | **behoben** | Fänge nach Start + 48 h werden in App und DB abgelehnt. Eine vergessene Session lässt sich mit „Zeit des letzten Fangs“ beenden (48:00 h). Abnahme `t12`; Owner `o1.mjs` P5; neuer Unit-Test. |
| BUG-2 (Low, AC-12) | **behoben** | Jede Ablehnung nennt die Spanne (Abnahme `t09`, `t12`). Neuer Randfall mit umgekehrter Spanne: BUG-7. |
| BUG-3 (Low, EC-13) | **behoben** | REST `PATCH ended_at=null` ergibt 400 `session_already_ended` (Security `t6`/`t11`; Owner P4). |
| BUG-4 (Low, AC-26) | **akzeptiert** | Begründung trägt, siehe unten. |
| BUG-5 (Low, zusätzlicher Edge Case) | **behoben** | Das zweite Löschen führt zur Session mit „Fang gelöscht“ (Owner P2; Abnahme `t17`). |

#### BUG-4: `createCatch` vertraut dem Client-Flag `sessionWasRunning` — akzeptiert
- **Severity:** Low (nur eigene Daten). **Status:** akzeptiert, bewusst nicht behoben (`design.md` → „Runde 2 nach QA“, Entscheidungstabelle).
- **Weiter nachstellbar:** Ein manipulierter „Fang nachtragen“ mit `sessionWasRunning: true` und Position speichert die Client-Koordinaten als `gps` (Owner `o1.mjs` P3: `1|1|gps`; Security `t9.cjs`). Ursache: `catches.ts:158`. Ohne das Flag gilt `session` bzw. `none` (AC-26 erfüllt).
- **Bewertung durch QA: Die Begründung trägt.**
  - Ein Nutzer kann dieselbe Änderung ohnehin direkt über die Datenbank-Schnittstelle machen: `PATCH` auf den eigenen Fang mit beliebigen Koordinaten und `position_source: gps` ergibt 200 (Owner `o2.mjs`).
  - Eine Prüfung in der Action wäre also keine Grenze, die etwas schützt.
  - Fremde Daten sind nicht betroffen (AC-32 bestanden).
  - Betroffen ist nur die Ehrlichkeit der Herkunftsangabe in den eigenen Daten. Die fälscht der Nutzer nur gegen sich selbst.
- **Vorbehalt:** Sollte die Herkunft je Dritten gegenüber etwas bedeuten (z. B. mit späteren Vereinsfunktionen oder Fangmeldungen), muss die Entscheidung neu getroffen werden, dann auch auf Datenbankebene.

### Neue Bugs aus diesem Lauf

#### BUG-6: Datenexport bricht ab 1001 Sessions ohne Hinweis ab
- **Severity:** Medium
- **Betrifft:** AC-35 (Art. 15, 20 DSGVO), `design.md` → Datenexport („eine Liste aller Sessions“)
- **Ursache:**
  - `src/app/(app)/(main)/account/export/route.ts:62-70` lädt alle Sessions samt Fängen in einer einzigen PostgREST-Abfrage, ohne Seitenabruf.
  - PostgREST liefert höchstens `max_rows` Zeilen: `supabase/config.toml:18` setzt `max_rows = 1000`, gehostet gilt standardmäßig dieselbe Grenze.
- **Steps to Reproduce:**
  1. Nutzer mit 1104 Sessions (Abnahme `t23`, per SQL angelegt).
  2. `GET /account/export`.
  3. Erwartet: alle 1104 Sessions mit ihren Fängen.
  4. Tatsächlich: `version 2` mit genau 1000 Sessions. Die ältesten 104 fehlen, ohne Hinweis in der Datei.
- **Warum Medium, nicht High:** Das betrifft nur Nutzer mit mehr als 1000 Sessions. Die Daten selbst gehen nicht verloren. Aber das Recht auf Auskunft und Übertragbarkeit wird für diese Nutzer stillschweigend unvollständig erfüllt.
- **Priority:** vor dem ersten gehosteten Betrieb beheben (`/build`, Export seitenweise laden). Dieselbe Grenze trifft auch die Vorschläge für Gewässernamen (`queries.ts:23`, höchstens 1000 Zeilen, laut Lane gewollt).

#### BUG-7: Meldung beim Beenden nennt eine umgekehrte Spanne
- **Severity:** Low
- **Betrifft:** AC-12 („verständliche Meldung, die die erlaubte Spanne nennt“), Folge des Fixes für BUG-2
- **Ursache:** `src/lib/fishing/actions/sessions.ts:371-373`. `spanFrom` (Start + 1 min bzw. letzter Fang) kann nach `spanTo` (jetzt, abgerundet auf die Minute, bzw. Start + 48 h) liegen. Das wird nicht abgefangen.
- **Steps to Reproduce:**
  1. Session starten und in derselben Minute „Session beenden“ → „Jetzt“ (oder eigene Uhrzeit = Start).
  2. Erwartet: eine verständliche Meldung, z. B. dass eine Session mindestens 1 Minute dauert, ab wann ein Ende möglich ist.
  3. Tatsächlich: „Das Ende muss nach dem Start liegen. Möglich ist ein Ende zwischen 30.09., 02:43 und 30.09., 02:42.“ (Owner `o1.mjs` P1; Abnahme E-1; Security „Auch bemerkt“).
  4. Gleiches Bild, wenn der letzte Fang in der 2-Minuten-Toleranz nach „jetzt“ liegt: „zwischen 02:50 und 02:48“.
- **Priority:** im nächsten Durchgang (`/build`).

#### BUG-8: „Session starten“ meldet „Keine Verbindung“, wenn eine eigene Session in der Zukunft endet
- **Severity:** Low (löst sich nach höchstens 2 Minuten von selbst)
- **Betrifft:** AC-6 / AC-16 (Überschneidung) und EC-3 (die Netzwerkmeldung ist für echte Verbindungsabbrüche gedacht)
- **Ursache:**
  - Ein Ende bis 2 Minuten in der Zukunft ist erlaubt (Toleranz), beim Nachtragen und über „Zeit des letzten Fangs“ nach einem Fang mit jetzt + 2 min.
  - Die neue Session überschneidet sich dann mit dieser, und die DB lehnt mit 23P01 `sessions_no_overlap` ab.
  - `startSession` (`sessions.ts:224-243`) behandelt nur `duplicate-id` und `running-exists`. Der Fehler wird geworfen, und `run()` macht daraus die Netzwerkmeldung (`sessions.ts:78-80`).
- **Steps to Reproduce:**
  1. Session nachtragen mit Ende jetzt + 1 min (oder laufende Session: Fang mit jetzt + 2 min, dann „Zeit des letzten Fangs“ beenden).
  2. Sofort „Session starten“.
  3. Erwartet: Start ab dem Ende der anderen Session möglich oder eine Überschneidungsmeldung wie in AC-16.
  4. Tatsächlich: „Keine Verbindung. Bitte versuche es erneut.“ (Abnahme E-2 `t21`; Security „Auch bemerkt“). Nach dem Ende der anderen Session geht es wieder.
- **Priority:** im nächsten Durchgang (`/build`). Zusammen mit BUG-9 lösen, weil beide an der fehlenden Zuordnung von `overlap` in `startSession` hängen.

#### BUG-9: Datenbank nimmt Session-Zeiten in der Zukunft an (über die eigene Datenbank-Schnittstelle)
- **Severity:** Low (nur eigene Daten, nur über eine manipulierte direkte Anfrage)
- **Betrifft:** AC-15 / EC-9 auf Datenbankebene. `design.md` nennt „keine Zeiten in der Zukunft“ als Voraussetzung der Überschneidungsregel, die Migration setzt sie aber nicht durch (`20260930120000_sessions_catches.sql:33-40`). Nur die App prüft das (`schemas.ts:307-310`).
- **Steps to Reproduce:**
  1. Mit eigenem Token per PostgREST eine beendete Session von +24 h bis +25 h bzw. eine laufende Session mit Start in +5 h anlegen: 201 (Security `t6-own-db.cjs`).
  2. Folge: Solange sie existiert, antwortet „Session starten“ mit „Keine Verbindung …“ (siehe BUG-8). Eine laufende Session mit zukünftigem Start lässt sich nicht beenden. Über „Bearbeiten“ bzw. „Löschen“ lässt sich das wieder richten.
- **Priority:** Nice to have (`/build`, kleine Migration, z. B. ein Trigger mit Toleranz von 2 Minuten).

#### Auch bemerkt (kein Bug)
- **Kennung existiert ja/nein erkennbar** (Security): `startSession`/`backfillSession` mit einer fremden, bekannten UUID antworten „Bitte prüfe deine Eingaben.“, mit einer freien UUID wird angelegt. Das folgt aus den Kennungen, die der Browser für EC-2 erzeugt. Eine fremde UUID ist nicht zu erraten (122 Zufallsbits), und die Antwort verrät keinen Inhalt. Die Seiten selbst antworten für fremde und freie Kennungen gleich. Kein Handlungsbedarf.
- PostgREST-Fehler an anon nennen Tabellen- und Rechtenamen. Das ist Supabase-Standard, Daten fließen nicht ab.
- `session_already_ended` fehlt in der Fehlerzuordnung (`db-errors.ts`). Das ist nur über die REST-Schnittstelle erreichbar, die App setzt das Ende nie auf leer.
- `src/components/auth/use-auth-action.ts` hat keinen eigenen Test mehr, abgedeckt ist er über `use-server-action.test.ts` (Regressions-Lane).
- Der Dev-Server sendet für geschützte Seiten `no-cache, must-revalidate`, der Produktions-Build `private, no-store`. Maßgeblich ist der Produktions-Build.
- Zu Beginn dieses Laufs lief noch ein alter `next start -p 3556` (gestartet 01:22, vor dem Commit `43821db`). Er wurde beendet und durch einen Server des aktuellen Builds ersetzt. Alle Prüfungen auf :3556 liefen gegen den aktuellen Build.

## Summary
- **Acceptance Criteria:** 38/40 bestanden, 1 fehlgeschlagen, 1 NOT VERIFIED.
  - Fehlgeschlagen: AC-35 (BUG-6, Medium).
  - NOT VERIFIED: AC-37, Browser-Reihenfolge. Code und Test sind belegt.
  - AC-12 besteht, hat aber einen Randfall mit Low-Bug (BUG-7).
- **Edge Cases:** 13/13 bestanden, darunter EC-6 und EC-13 (früher fehlgeschlagen). Zusätzliche Edge Cases: 5 bestanden, 2 fehlgeschlagen (BUG-7, BUG-8, beide Low).
- **Bugs aus dem ersten Lauf:** BUG-1, BUG-2, BUG-3 und BUG-5 sind behoben, BUG-4 ist akzeptiert (Begründung trägt).
- **Neue Bugs:** 4 insgesamt (0 Critical, 0 High, 1 Medium, 3 Low): BUG-6 Medium, BUG-7, BUG-8 und BUG-9 Low.
- **Security:** 11/13 Prüfungen belegt, 2 NOT VERIFIED:
  - Rate Limiting auf den PROJ-2-Actions (nicht umgesetzt, optional für das MVP).
  - Koordinaten in der Ausgabe des Dev-Servers (nicht einsehbar).
- **Regression PROJ-1:** keine Regression. Suite 368/368, Lint und Build sind grün.
- **Production Ready:** JA. Es gibt keine Critical- oder High-Bugs, und die Runtime-Kriterien wurden gegen die laufende App ausgeübt.
- **Recommendation:** Deploy möglich. BUG-6 (Export ab 1001 Sessions) vor dem ersten gehosteten Betrieb per `/build` beheben, BUG-7 bis BUG-9 im nächsten Durchgang.

> „Production Ready: JA“ heißt: *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Offen sind die Browser-Darstellung, die echte Standortabfrage (inkl. AC-37), das 30-Sekunden-Ziel am Smartphone und der echte Verbindungsabbruch. Diese Punkte brauchen einen Menschen oder `/e2e-tests`.

**Aufräumen:**
- Alle `qa-p2r-*`-Testkonten sind gelöscht.
- Zählabfrage danach: 0 Konten `qa-p2r-%`, 0 verwaiste Profile, Sessions und Fänge, 0 Zeilen in `auth_throttle_events`.
- Schlüssel- und Cookie-Dateien sind aus allen Scratchpad-Ordnern gelöscht. Eine Suche nach Tokens und Schlüsseln findet nur noch Code.
- Der Produktionsserver auf :3556 ist gestoppt. Der Dev-Server auf :3553 läuft weiter.
- In Mailpit liegen noch die Mails der Regressions-Konten.
