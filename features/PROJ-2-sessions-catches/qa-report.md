# QA-Testergebnisse: PROJ-2 Sessions & Fänge

**Getestet:** 2026-09-30
**App-URL:** http://localhost:3553 (`probe.kind: http`, Dev-Server `npm run dev`). Für die Produktionsprüfungen lief zusätzlich `next start` des aktuellen Builds (HEAD `b855239`) auf http://localhost:3556. Die lokale Supabase lief in Docker (API `127.0.0.1:55321`, Mailpit `127.0.0.1:55324`).
**Tester:** QA Engineer (AI). Geprüft haben unabhängige `qa-engineer`-Läufe, die den Bau nicht kannten: Abnahme (Step 2) und Regression (Step 4 + 5). Die Security-Lane (Step 3) hat nach ihren Prüfungen keinen Bericht zurückgegeben. Deshalb hat der `/qa`-Owner den Red-Team-Teil selbst ausgeführt. Er hat den Bau ebenfalls nicht gesehen. Die Umsetzungsnotizen in `design.md` hat er erst nach den eigenen Befunden gelesen. Der Owner hat alle Ergebnisse zusammengeführt.
**Umfang:** `full`. Das ist der erste `/qa` von PROJ-2. Weil PROJ-2 Dateien von PROJ-1 berührt, war die Regression von PROJ-1 im Umfang. Betroffen sind der gemeinsame Formular-Baustein, die Konto-Seite (jetzt in `(main)`), der Export (Version 2) und die Datenschutzseite.
**Autonomer Lauf:** Der Nutzer hat den Lauf vorab freigegeben und war nicht erreichbar. Wo der Skill eine Rückfrage vorsieht, galt die empfohlene Wahl. Die Priorisierung der Bugs (Step 8) steht als Empfehlung unten.

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
>
> **Testdaten:** Adressen `qa-p2-acc-*`, `qa-p2-reg-*`, `qa-p2-sec-*`, `qa-p2-sec2-*` und `qa-p2-own-1@example.test`. Alle Konten samt Sessions und Fängen wurden am Ende gelöscht und per Zählabfrage bestätigt (siehe Ende). Aufrufe der Server Actions liefen über HTTP aus Node (`Next-Action`-Header), direkte Datenbankzugriffe über PostgREST mit dem Zugang des jeweiligen Testnutzers und `psql` im Container.

### Automatisierte Tests (einmal vor dem Fan-out gelaufen)
- [x] Unit-Suite `npm test`: 21 Dateien, 353 bestanden, 0 fehlgeschlagen, exit 0 (vitest 4.1.11). Die Lanes haben diesen Lauf zitiert und nicht wiederholt.
- [x] Produktions-Build `npm run build`: exit 0, TypeScript fehlerfrei, 18 Routen plus Proxy (Next.js 16.3.7).
- [x] Lint `npm run lint`: exit 0.
- [x] Migrationen: `npx supabase migration list --local` zeigt alle 5 angewendet. Der Inhalt in `supabase_migrations.schema_migrations` stimmt mit den Dateien überein (md5 nach Entfernen von Leerraum und Kommentaren, alle 5 identisch). `git diff --stat main..HEAD -- supabase/migrations` zeigt nur die neue Datei `20260930120000_sessions_catches.sql`. Die Migrationen aus PROJ-1 sind unverändert.
- [x] Neue Unit-Tests aus diesem Lauf: 2 Dateien, 13/13 grün, rote Runde gemacht (siehe „Unit-Tests aus /qa“).

## Acceptance Criteria

#### App-Rahmen & Übersicht
- [x] **AC-1**: `GET /` zeigt die Überzeile „Dein Fangbuch“ und die Tab-Leiste „Sessions · Start · Konto“. Die Karten stehen neueste zuerst, mit Datum, Gewässer, „Dauer 3:40 h“ bzw. „Läuft“ und „3 Fänge“ (Abnahme-Lane, HTML per curl).
- [x] **AC-2**: Ohne Sessions zeigt `/` „Bereit für den nächsten Wurf?“ mit „Session starten“ und darunter „Session nachtragen“ (Abnahme-Lane).
- [x] **AC-3**: `GET /start` leitet ohne laufende Session mit 307 nach `/sessions/new` und mit laufender Session nach `/sessions/<id>` (Abnahme-Lane; Owner auf `:3556`: 307 → `/sessions/new`).
- [x] **AC-4**: Auf `/` und `/account` erscheint die Leiste „Müggelsee 0:01 h · 3 Fänge · Fang eintragen“ mit Link auf `/sessions/<id>`. Der Rückfall „Ohne Gewässer“ steht in `active-session-bar.tsx` (Abnahme-Lane).
- [x] **AC-5**: `GET /account` liefert die Konto-Seite aus PROJ-1 mit AppBar „Konto“ und Tab-Leiste (Abnahme- und Regressions-Lane).

#### Session starten
- [x] **AC-6**: `startSession` leitet nach `/sessions/<id>?notice=session-started`. In der DB steht der Start minutengenau, der Name getrimmt, die Position 52.4412345/13.6512345 und die Genauigkeit 12 (aus 12,4 gerundet). Der Payload enthält „Session gestartet“ (Abnahme-Lane).
- [x] **AC-7**: Die Vorschläge im Payload enthalten nur eigene Namen, zuletzt genutzte zuerst (A `["Müggelsee","Havel Süd"]`, B `["Spree","Seeteich"]`). Ein Name mit 81 Zeichen ergibt „Höchstens 80 Zeichen.“, eine Notiz mit 501 Zeichen „Höchstens 500 Zeichen.“, auch serverseitig (Owner: `updateSession` mit 81 Zeichen → Feldfehler). Den Wortanfangs-Filter belegt `session-forms.test.tsx:224`.
- [x] **AC-8**: Ein Start mit `position: null` speichert keine Position. Die Detailseite zeigt „Ohne Position“ und „Position fehlt. Prüfe die Standortfreigabe deines Browsers.“ Die 10-s-Grenze steht in `use-location.ts` und ist durch `use-location.test.ts:131` belegt. Die echte Browser-Ortung ist NOT VERIFIED (siehe unten).
- [x] **AC-9**: Ein zweiter Start mit neuer Kennung ergibt `?notice=session-running`, es bleibt 1 Zeile. Die Seite zeigt „Es läuft bereits eine Session.“ (Abnahme-Lane).

#### Session beenden
- [x] **AC-10**: `endSession mode:now` ergibt `?notice=session-ended` mit dem Toast „Session beendet · 3:00 h“. Danach fehlt die Leiste auf `/`, die Hero-Karte ist zurück. Auswahl und Vorbelegung „Jetzt“ belegt `end-session-sheet.test.tsx:47` (Abnahme-Lane). Einschränkung siehe BUG-1.
- [x] **AC-11**: Bei einem Start vor 13 h zeigen `/` und die Detailansicht „Läuft seit über 12 Stunden. Vergessen zu beenden?“ mit „Beenden“ (Abnahme-Lane).
- [ ] **AC-12** — BUG-2 (Low). Abgelehnt wird korrekt, die Meldung steht am Feld `endedAt`, gespeichert wird nichts. Nur die 48-h-Meldung nennt die erlaubte Spanne („… höchstens 48 Stunden (bis 29.09., 23:27).“). „Das Ende muss nach dem Start liegen.“, „Dieser Zeitpunkt liegt in der Zukunft.“ und „Der Fang um … läge außerhalb der Session.“ nennen sie nicht, wie der AC es verlangt (Abnahme-Lane).

#### Session nachtragen
- [x] **AC-13**: `backfillSession` legt eine beendete Session ohne Position an und leitet mit `?notice=session-saved` weiter (Abnahme-Lane; Owner-Gegenprobe `s1.mjs`).
- [x] **AC-14**: Mit Schalter und Position wird gespeichert (54.08512, 1234 m). Ohne Schalter wird eine mitgeschickte Position verworfen (`schemas.ts`, Transform in `backfillSessionSchema`). Owner: Eine unsinnige Position (`'NaN'`, `1e308`, `-5`) ergibt „ohne Position“ statt eines Fehlers.
- [x] **AC-15**: Direkte Server-Aufrufe (Browser-Prüfung umgangen) lehnen ab: Ende gleich oder vor dem Start, mehr als 48 h, Zukunft, fehlendes Ende. Genau 48 h werden gespeichert. Dass die Eingaben stehen bleiben, belegt `session-forms.test.tsx:152`. „Kürzer als 1 Minute“ ist über HTTP nicht erreichbar, weil Zeiten minutengenau sind. Geprüft ist es in `sessionTimeErrors` und im DB-Check `sessions_duration_check`.
- [x] **AC-16**: 19–21 Uhr gegen 16–20 Uhr ergibt „Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.“ Gegen die laufende Session kommt „… mit deiner laufenden Session seit 01:24.“ Angrenzend (20–21 Uhr) wird gespeichert. Das gilt auch beim Bearbeiten. Die Garantie ist die Ausschlussregel `sessions_no_overlap` (Migration).

#### Session bearbeiten & löschen
- [x] **AC-17**: `updateSession` ändert Name, Notiz und Start und leitet mit `session-saved` weiter. Die Position bleibt. Bei einer laufenden Session wird ein mitgeschicktes Ende ignoriert (Abnahme-Lane).
- [x] **AC-18**: Start 17:30 bei einem Fang um 17:20 ergibt „Der Fang um 17:20 (Hecht) läge außerhalb der Session.“ Ende 19:00 bei einem Fang um 20:00 wird ebenso abgelehnt (Abnahme-Lane).
- [x] **AC-19**: `deleteSession` leitet nach `/?notice=session-deleted`, der Toast lautet „Session gelöscht“. Session und Fänge haben danach 0 Zeilen. Der Dialogtext kommt aus `deleteSessionDescription`. Eine laufende Session lässt sich löschen, danach fehlt die Leiste (Abnahme-Lane).

#### Fang eintragen
- [x] **AC-20**: `createCatch` mit GPS leitet nach `?notice=catch-saved`, `position_source = gps`. Die Standard-Fangzeit ist die Minute beim Laden (`initialNow` im Payload) (Abnahme-Lane; Owner `s1.mjs`).
- [x] **AC-21**: Die Reihenfolge in `species.ts` entspricht der Spec. Zuletzt genutzte Arten stehen oben. Bei „Sonstige“ ergibt ein leerer Name „Bitte gib die Fischart ein.“, 41 Zeichen ergeben „Höchstens 40 Zeichen.“ (Abnahme-Lane). Die Auswahl der zuletzt genutzten Arten ist neu durch `species-select.test.ts` abgedeckt.
- [x] **AC-22**: Serverseitig abgelehnt mit Meldung am Feld und 0 geschriebenen Zeilen: Art fehlt oder ungültig; Länge 0, 251, „12.5“ oder leer; Gewicht 0, 150001 oder „1,5“; Köder mit 61 Zeichen; `released` fehlt oder ist der String „true“. Die Grenzwerte 250 und 150.000 werden gespeichert (Abnahme-Lane).
- [x] **AC-23**: Der Payload `prefill {"bait":null,"released":true}` stammt vom zuletzt angelegten Fang. Den ersten Fang belegen `catch-form.test.tsx:74,84` (Abnahme-Lane).
- [x] **AC-24**: Eine Zeit vor dem Start oder nach dem Ende ergibt „Die Fangzeit muss zwischen 16:00 und 20:00 liegen.“ Start und Ende selbst werden gespeichert. In einer laufenden Session wird +10 min abgelehnt (Abnahme-Lane). Zur fehlenden 48-h-Grenze siehe BUG-1.
- [x] **AC-25**: Ohne oder mit kaputter Position (lat 95) wird die Session-Position mit Herkunft `session` kopiert. Hat auch die Session keine Position, gilt `none` (Abnahme-Lane).
- [x] **AC-26**: Beim Fang nachtragen wird eine mitgeschickte Position ignoriert, gespeichert wird die Kopie mit `session` bzw. `none`. Keine Standortabfrage: `catch-form.test.tsx:171`. Mit manipulierter Anfrage lässt sich das umgehen, siehe BUG-4 (Low).

#### Fang bearbeiten & löschen
- [x] **AC-27**: `updateCatch` ändert alle Felder und leitet mit `catch-saved` weiter. Eine fremde `sessionId` und eine mitgeschickte Position werden ignoriert. Länge 0 ergibt einen Feldfehler (Abnahme-Lane).
- [x] **AC-28**: `deleteCatch` leitet nach `/sessions/<id>?notice=catch-deleted`, danach 0 Zeilen (Abnahme-Lane; Owner `s5.mjs`, erster Aufruf).

#### Detailansicht
- [x] **AC-29**: Das HTML zeigt Name, Datum, „22:26 bis 30.09., 01:26“, Dauer, Notiz, Koordinaten „52,44123° N · 13,65123° O ± 12 m“ und die Fänge nach Uhrzeit mit Art, Länge, Gewicht, Köder, Status und Herkunft „GPS“ / „von der Session“ / „Ohne Position“ (Abnahme-Lane).
- [x] **AC-30**: 3 Fänge in 3:00 h ergeben „1,0“. Laufend wird bis jetzt gerechnet (Abnahme-Lane).
- [x] **AC-31**: Eine Session ohne Fang zeigt „Noch keine Fänge. Petri Heil!“ und „Fänge pro Stunde 0,0“ (Abnahme-Lane).

#### Zugriffsschutz
- [x] **AC-32**: Nutzer B gegen die Daten von A, über die App und direkt über die Datenbank:
  - Alle acht Actions mit Kennungen von A ergeben `/?notice=session-gone`. Die Daten von A bleiben unverändert (DB-Abfrage danach).
  - `GET` auf Detail, Bearbeiten, Fang eintragen und Fang mit Kennungen von A ergibt 404 „Diese Seite gibt es nicht.“ Die Antwort enthält keine Inhalte von A.
  - PostgREST mit dem Zugang von B:
    - `select` auf Sessions und Fänge ergibt `[]`.
    - Anlegen mit `user_id = A` wird von RLS abgelehnt (42501).
    - Einen Fang in der Session von A anzulegen scheitert: 23503 `catches_session_owner_fkey` bzw. 42501.
    - Einen eigenen Fang in die Session von A zu verschieben scheitert ebenso: 23503 bzw. 42501.
    - Die eigene Session an A zu übergeben scheitert mit 42501.
    - `PATCH`/`DELETE` auf Zeilen von A ergeben `[]`.
    - `rpc/check_catch_in_session` und `rpc/set_updated_at` sind nicht aufrufbar (404).
  - Eine Kennung von A wiederzuverwenden (`startSession`, `createCatch`) ergibt „Bitte prüfe deine Eingaben.“
  - Belege: Owner `s2.mjs`, Abnahme-Lane.
- [x] **AC-33**: Ohne Anmeldung ergeben alle Seiten 307 → `/login`: `/`, `/start`, `/sessions/**` und `/account/export` (Owner auf `:3556`, Regressions-Lane auf `:3553`). Die Action `startSession` ohne Cookie ergibt 307 → `/login`. PostgREST mit dem anon-Key ergibt für `sessions` und `catches` 401/42501.
- [x] **AC-34**: Die Vorschläge von A und B enthalten jeweils nur eigene Namen (Abnahme-Lane, siehe AC-7).

#### Datenschutz
- [x] **AC-35**: `/account/export` liefert `version 2` mit 8 Sessions und 7 Fängen, genau wie in der DB. Enthalten sind alle Felder samt Positionen, Genauigkeit, `position_source` und `species_label`, aber kein `user_id` und keine fremden Daten (Abnahme-Lane; Owner: kein `user_id`, keine ID von B). Die Header lauten `application/json`, `attachment`, `private, no-store` (`:3556`).
- [x] **AC-36**: `getCurrentPosition` gibt es nur in `use-location.ts`. `requestPosition()` wird nur beim Speichern aufgerufen: im Start-Formular, beim Nachtragen nur mit Schalter, im Fang-Formular nur bei laufender Session. `watchPosition` gibt es nicht. Beleg: `use-location.test.ts:74` (Abnahme-Lane).
- [x] **AC-37**: `location-explainer.tsx` enthält den Text aus dem Design, einen Link auf `/privacy` und „Weiter“. Belege: `use-location.test.ts:173,194,215`. Wie der Dialog aussieht, ist NOT VERIFIED.
- [x] **AC-38**: `removeSessionPosition` leert die Position der Session, die Fänge behalten ihre Kopien (`session`). `removeCatchPosition` setzt die Position auf leer und die Herkunft auf `none`. Die Detailseite zeigt „Ohne Position“ (Abnahme-Lane).
- [x] **AC-39**: `/privacy` enthält „Dein Fangbuch“ mit Daten, Zweck, „Nur du kannst sie sehen.“ und Speicherdauer bis zur Löschung (Abnahme- und Regressions-Lane).
- [x] **AC-40**: Nach dem Löschen von Fang, Session und Konto stehen per `psql` 0 Zeilen in der DB. Es gibt keine Spalte für weiches Löschen (Migration) (Abnahme-Lane).

## Edge Cases

- [x] **EC-1**: 4 parallele Starts ergeben 3 × `session-running`, 1 × `session-started` und genau 1 laufende Zeile. Garantie: eindeutiger Index `sessions_one_running_per_user` (Migration `20260930120000_sessions_catches.sql`, `create unique index … where ended_at is null`).
- [x] **EC-2**: Eine Wiederholung mit derselben Kennung (Session und Fang) ergibt Erfolg ohne zweite Zeile. Garantie: Primärschlüssel plus Zweig `duplicate-id` (`db-errors.ts`, `sessions.ts` ca. Z. 223–226, `catches.ts` ca. Z. 253–266). Die Button-Sperre belegt `use-server-action.test.ts:55`. Neu: `entry-id.test.ts` belegt, dass jede Formular-Kennung eine gültige v4-UUID ist, auch im Ersatzweg ohne `crypto.randomUUID`.
- [x] **EC-3**: Belegt über Tests, zur Laufzeit nicht provoziert: Warn-Notice „Keine Verbindung …“, gleiche Kennung, gemerkte Position (`catch-form.test.tsx:114`, `session-forms.test.tsx:50,70`, `use-server-action.test.ts:42`). Ein echter Verbindungsabbruch ist NOT VERIFIED.
- [x] **EC-4**: Session anderswo um 01:17 beendet, Fang um 01:27 → „Die Session wurde inzwischen beendet (Ende 01:17).“ Ein Fang innerhalb wird mit der ermittelten GPS-Position gespeichert. Garantie: Trigger `check_catch_in_session` mit `for share` auf der Session-Zeile, gegen die Zeilensperre des Session-Updates mit `sessions_check_keeps_catches`. Ein REST-Insert außerhalb ergibt P0001 `catch_outside_session`.
- [x] **EC-5**: Nach dem Löschen der Session ergeben `createCatch`, `updateSession`, `endSession` und `updateCatch` `/?notice=session-gone`, und `/` zeigt „Diese Session gibt es nicht mehr.“ (Abnahme-Lane). Siehe auch BUG-5.
- [ ] **EC-6** — BUG-1 (Medium). Ohne Fänge nach der 48-h-Marke hält die Regel: „Jetzt“ wird mit „… höchstens 48 Stunden (bis …)“ abgelehnt, Deaktivierung und Vorauswahl belegen `end-session-sheet.test.tsx:63,74`. Eine laufende Session nimmt aber Fänge **nach** der 48-h-Marke an. Danach lässt sie sich mit keiner Option mehr beenden (Owner `s4.mjs`, Abnahme-Lane).
- [x] **EC-7**: Genauigkeit 800 ergibt „± 800 m“, 1234 ergibt „± 1,2 km“. Beide werden gespeichert (Abnahme-Lane).
- [x] **EC-8**: 13.09. 22:30 bis 14.09. 02:10 ergibt „bis 14.09., 02:10“ und „3:40 h“ und steht unter dem 13.09. Die Zeitumstellung 29.03. 01:30+01 bis 03:30+02 ergibt „1:00 h“ (Abnahme-Lane).
- [x] **EC-9**: Laufende Session, jeweils mit Meldung abgelehnt: Start in der Zukunft, Start nach dem ersten Fang, Start in einer anderen Session. Garantie: Trigger `sessions_check_keeps_catches`; ein REST-Update ergibt P0001.
- [x] **EC-10**: `updateCatch` außerhalb der geänderten Session ergibt „Die Fangzeit muss zwischen 00:27 und 01:17 liegen.“ Garantie: derselbe Trigger bei einem Update von `caught_at`.
- [x] **EC-11**: Konto A hatte eine laufende Session, 9 Sessions und 8 Fänge. `deleteAccount` leitet nach `/login?notice=account-deleted`. Danach sind `sessions`, `catches`, `profiles` und `auth.users` je 0 (Abnahme-Lane). Die Regressions-Lane hat dasselbe unabhängig belegt (PROJ-1 EC-12).
- [x] **EC-12**: Mit 45 Sessions antwortet `GET /` in 134 ms mit 20 Karten und „Weitere laden“. `loadMoreSessions` liefert 20, dann 5, dann `nextCursor: null`. Die Antwort enthält keine `latitude`. Ob die Seite im Browser spürbar hängt, ist NOT VERIFIED.
- [ ] **EC-13** — BUG-3 (Low). In der App geht es korrekt: Keine Action setzt das Ende wieder auf leer, und `endSession` schreibt nur mit `.is('ended_at', null)`. Über die Datenbank-Schnittstelle kann ein Nutzer aber seine **eigene** beendete Session wieder öffnen: `PATCH sessions {ended_at:null}` ergibt `[{"ended_at":null}]` (Abnahme-Lane). Owner-Gegenprobe: Mit einer laufenden Session scheitert es nur am Index „eine laufende Session“ (23505).

#### Zusätzliche Edge Cases (nicht in der Spec)
- [ ] **Zweites Löschen desselben Fangs** — BUG-5 (Low): Der erste `deleteCatch` ergibt `catch-deleted`, der zweite `/?notice=session-gone` („Diese Session gibt es nicht mehr.“), obwohl die Session noch existiert (Owner `s5.mjs`).
- [x] **Zeitraum-Filter der Übersicht** (`loadMoreSessions`): Fremde Filter im Cursor (`…,user_id.neq.x`, `…)or(id.gt.0`), eine Zahl und `null` werden alle mit „Bitte prüfe deine Eingaben.“ abgelehnt. Nur ein ISO-Zeitpunkt wird angenommen (Owner `s3.mjs`; `queries.ts:177`).
- [x] **Übergroße Anfrage**: Eine Notiz mit 2 MB wird vom Body-Limit der Server Actions abgelehnt, es entsteht keine Session (Owner `s3.mjs`).
- [x] **Typverwirrung**: `endSession` mit `null`, `"x"`, Array, `{}`, `[]` oder `__proto__`/`constructor` im Objekt ergibt „Bitte prüfe deine Eingaben.“ (Owner `s2.mjs`).

## Security-Audit (Red Team)

_Ausgeführt vom `/qa`-Owner (Security-Lane ohne Bericht, siehe Kopf). Skripte `s1.mjs`–`s5.mjs` im Scratchpad des Laufs._

- [x] **Authentifizierung**: Alle neuen Adressen ergeben ohne Anmeldung 307 → `/login` (`:3556` und `:3553`). Eine Server Action ohne Cookie ergibt 307 → `/login`. Jede Action ruft zuerst `requireUser()` auf (`sessions.ts`, `catches.ts`, `overview.ts:14`).
- [x] **Autorisierung**: Siehe AC-32. B kommt weder über die App noch über PostgREST an Daten von A. Fremde und nicht existierende Kennungen ergeben dieselbe 404-Seite, die Antwort verrät also nicht, ob es die Kennung gibt. RLS-Policies `*_own` für `select`/`insert`/`update`/`delete` auf beiden Tabellen (Migration), dazu der Fremdschlüssel `catches_session_owner_fkey` auf (Session, Besitzer).
- [x] **Eingabeprüfung / XSS / Injection**:
  - `<script>alert(1)</script>` als Gewässername, `"><img src=x onerror=alert(1)>` in Notiz und Köder und `<svg onload=alert(1)>` als Artname werden gespeichert.
  - Auf `/`, der Detailansicht, „Bearbeiten“, „Fang bearbeiten“ und `/sessions/new` erscheinen sie nur maskiert, nie roh.
  - SQL-Text (`x' OR 1=1; drop table sessions;--`) wird wörtlich gespeichert.
  - Die Cursor-Injection wird abgelehnt (siehe oben).
  - Belege: Owner `s3.mjs`; Zod-Schemas in `schemas.ts`.
- [!] **Rate Limiting auf den PROJ-2-Actions** — NOT VERIFIED, nicht umgesetzt (für das MVP optional). 40 `createCatch` in 7,9 s wurden alle gespeichert (Owner `s3.mjs`). Betroffen sind nur eigene Daten.
- [x] **Brute Force**: PROJ-2 hat keinen eigenen Pfad, der Zugangsdaten prüft. `grep signIn|signUp|verifyOtp|password` über `src/lib/fishing`, `src/components/fishing`, `src/components/shell` und die neuen Seiten ergibt keinen Treffer. Die Login-Bremse aus PROJ-1 greift weiter: 5 Fehlversuche führen zur Sperre, gefälschtes `X-Forwarded-For` hilft nicht, die 6. Registrierung wird abgelehnt (Regressions-Lane: PROJ-1 AC-23, AC-24, AC-26).
- [x] **Keine Kontoauflistung**: Für PROJ-2 heißt das, dass fremde und nicht existierende Kennungen gleich antworten (404 „Diese Seite gibt es nicht.“, `/?notice=session-gone`). Die Login-Meldungen sind laut Regressions-Lane für beide Fälle gleich (PROJ-1 AC-8, AC-16).
- [x] **Keine Zugangsdaten oder Positionen in URLs**: Alle Formulare von PROJ-2 senden per `method="post"` mit `onSubmit` (`catch-form.tsx:214`, `end-session-sheet.tsx:211`, `session-backfill-form.tsx:198`, `session-edit-form.tsx:117`, `session-start-form.tsx:127`). Alle beobachteten Weiterleitungen enthalten nur UUIDs und die festen `notice`-Codes. Kein Code baut Koordinaten in `href`, `push` oder `searchParams`.
- [x] **Keine Positionen in Server-Logs**: Die Logzeilen enthalten nur Bereich, Fehlercode und Fehlermeldung, nie `details` mit Zeilenwerten (`sessions.ts:65`, `catches.ts:83`, `overview.ts:23`, `(main)/page.tsx:72`). `logging.serverFunctions: false` in `next.config.ts` verhindert, dass Argumente von Server Actions geloggt werden.
- [x] **Keine Geheimnisse im Client-Bundle**: `grep` über `.next/static` nach dem Service-Role-Key (JWT, 164 Zeichen), dem Secret-Key (41 Zeichen), `service_role`, `SUPABASE_SERVICE_ROLE_KEY` und `TRUSTED_CLIENT_IP_HEADER` ergibt jeweils 0 Treffer.
- [x] **Keine sensiblen Daten in Antworten**: `/` und `loadMoreSessions` enthalten keine Koordinaten. Detailseite, Übersicht und Export enthalten kein `user_id` und keine E-Mail (Owner `s3.mjs`). Koordinaten erscheinen nur dem Besitzer in Detail, Bearbeiten und Export.
- [x] **CSRF**: Eine Server Action mit `Origin: https://evil.example` wird abgewiesen (500, keine neue Session) (Owner `s2.mjs`).
- [x] **Sicherheits-Header und Cache**: Auf `:3556` tragen alle Seiten `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: origin-when-cross-origin` und HSTS mit `includeSubDomains`. Angemeldet liefern `/`, `/start`, `/sessions/new`, `/sessions/backfill`, `/sessions/<id>` (auch 404), `/account` und `/account/export` `Cache-Control: private, no-store`.

## Regression (PROJ-1 Registrierung & Login)

Kein Feature hat den Status „Deployed“. Regressionsziel war PROJ-1 (Approved), weil es Code und Daten mit PROJ-2 teilt. Die Regressions-Lane hat alle PROJ-1-Kriterien gegen die laufende App ausgeübt:

- [x] **AC-1 bis AC-11, AC-13 bis AC-26 und AC-28 bis AC-34** bestehen. Belege: Skripte `t1.mjs` bis `t16.mjs` der Lane, z. B. Registrierung mit Mail, Link-Bestätigung, Login und Logout, Passwort zurücksetzen und ändern, Login-Bremse, Export v2 und Konto löschen.
- [x] **EC-1 bis EC-5 und EC-7 bis EC-13** bestehen.
  - EC-12 ist neu belegt: Ein gelöschtes Konto mit laufender Session und 3 Fängen hinterlässt 0/0/0/0 Zeilen.
- [x] **Unverändert seit PROJ-1** laut `git diff --quiet main..HEAD`: `src/proxy.ts`, `src/lib/auth/**`, `src/app/auth/**`, `src/app/(auth)/**`, `src/app/reset-password` und `src/components/account/**`.
- [x] **Der gemeinsame Formular-Baustein** (`use-server-action.ts`) wird von `use-auth-action.ts` genutzt. Das Verhalten der PROJ-1-Formulare zur Laufzeit ist unverändert.
- [!] **PROJ-1 AC-12, AC-2/AC-27 (Darstellung), AC-8 (E-Mail bleibt stehen) und EC-5 (Button-Sperre)**: reine Client-Interaktion, kein Browser.
- [!] **PROJ-1 EC-6 (Verbindungsabbruch)**: Supabase darf nicht gestoppt werden.
- **Keine neuen Bugs aus der Regression.** `X-Powered-By: Next.js` ist das bekannte PROJ-1-BUG-16 (Low), keine Regression.

## Unit-Tests aus /qa

- [x] `src/lib/fishing/entry-id.test.ts` (EC-2, EC-3): 5 Tests prüfen `newEntryId`.
  - Es entsteht eine v4-UUID, 200 Aufrufe ergeben 200 verschiedene Kennungen.
  - Im Ersatzweg ohne `randomUUID` werden die Versions- und Variantenbits auch bei Bytes aus lauter 0xff bzw. 0x00 gesetzt.
  - Die Bytes erscheinen in der richtigen Reihenfolge.
  - **Rote Runde:** Alle Erwartungen umgekehrt (Version 5 statt 4, 199 statt 200, die Werte ohne gesetzte Bits) ergeben 5/5 rot. Wiederhergestellt ergeben sie 5/5 grün.
- [x] `src/components/fishing/species-select.test.ts` (AC-21): 8 Tests prüfen `pickRecentSpecies`.
  - Höchstens 3, Reihenfolge bleibt, Duplikate fallen weg.
  - Ungültige Kennungen und geerbte Objektschlüssel (`toString`, `__proto__`) werden ignoriert und belegen keinen Platz.
  - „Sonstige“ gilt wie jede Art, ohne Verlauf ist die Liste leer.
  - **Rote Runde:** Alle Erwartungen umgekehrt ergeben 8/8 rot. Wiederhergestellt ergeben sie 8/8 grün.
- Befehl: `npx vitest run src/lib/fishing/entry-id.test.ts src/components/fishing/species-select.test.ts`, Ergebnis 13/13 grün.
- Nicht neu getestet, weil schon abgedeckt: `mapDbError`, `matchWaterNames`, `noticeFor`, die Formatierer und die Schemas.

## E2E-Tests
- Status: **nicht ausgeführt** (für kritische Abläufe `/e2e-tests` ausführen).

## Not Verified In This Run

- [!] **Darstellung im Browser**: Toasts, Sheet, Dialoge, 44-px-Touch-Ziele, Zahlentastatur, schwebende Leiste über der Tab-Leiste. `/qa` läuft ohne Browser, geprüft sind nur HTML, Payload und Quelltext.
- [!] **Cross-Browser** (Chrome, Firefox, Safari) und **Responsive** (375 / 768 / 1440 px): kein Browser, kein Viewport.
- [!] **Echte Standortabfrage**: Rechte-Dialog des Browsers, tatsächliche 10-s-Grenze, Erklärung vor der ersten Abfrage auf einem Gerät (AC-8, AC-14, AC-25, AC-36, AC-37). Geprüft sind nur Code und `use-location.test.ts`, eine Geolocation-Engine gibt es hier nicht.
- [!] **EC-3 mit echtem Verbindungsabbruch**: nicht provoziert, weil Dev-Server und Supabase nicht gestoppt werden dürfen. Belegt nur über Tests.
- [!] **EC-12 „Seite hängt nicht spürbar“**: Gemessen ist nur die Serverzeit (134 ms), das Rendering im Browser nicht.
- [!] **Tempo-Ziel unter 30 Sekunden am Smartphone** (Technische Anforderung): Das braucht einen Menschen mit Gerät.
- [!] **Echter gleichzeitiger Wettlauf** zwischen Fang und Beenden (EC-4, EC-10): nicht provoziert. Stattdessen ist die Garantie im Schema bestätigt (`for share` gegen die Zeilensperre des Updates).
- [!] **Rate Limiting auf den PROJ-2-Actions**: nicht umgesetzt (für das MVP optional).
- [!] **Browser-Konsole und Netzwerk-Tab**: Dafür braucht es DevTools.

## Bugs Found

#### BUG-1: Laufende Session nimmt Fänge nach der 48-h-Marke an und lässt sich danach nicht mehr beenden
- **Severity:** Medium
- **Betrifft:** EC-6 (dazu AC-10, AC-24)
- **Ursache:**
  - Die Fangzeit hat bei einer laufenden Session als obere Grenze nur „jetzt + 2 min“: `src/lib/fishing/schemas.ts:335` (`checkCatchTime`) und die Migration `20260930120000_sessions_catches.sql:225` (`coalesce(v_ended_at, now() + 2 min)`).
  - Das Ende muss aber höchstens 48 h nach dem Start liegen (`sessions_duration_check`).
  - Die Spec regelt den Fall nicht: AC-24 begrenzt eine laufende Session nur gegen die Zukunft.
- **Steps to Reproduce:**
  1. Session starten. Per „Bearbeiten“ den Start auf jetzt − 50 h setzen. Realistischer Weg dorthin: eine vergessene Session läuft über 48 h, und AC-9 leitet einen neuen Start genau dorthin um.
  2. „Fang eintragen“ mit Uhrzeit jetzt. Der Fang wird gespeichert (`catch-saved`).
  3. „Session beenden“ versuchen:
     - „Jetzt“ und „Zeit des letzten Fangs“ ergeben „Eine Session dauert höchstens 48 Stunden (bis …).“
     - Eine eigene Uhrzeit innerhalb der 48 h ergibt „Der Fang um … läge außerhalb der Session.“
  4. Erwartet: Die Session lässt sich beenden, oder der Fang nach der 48-h-Marke wird gar nicht erst angenommen.
  5. Tatsächlich: Kein Weg führt zum Ende. Der Nutzer muss erst den Fang oder den Start bearbeiten bzw. löschen (Workaround). Owner `s4.mjs`.
- **Priority:** vor dem Deployment beheben. Das braucht eine Vertragsentscheidung (`/refine PROJ-2`).

#### BUG-2: Meldungen beim Beenden nennen die erlaubte Spanne nicht
- **Severity:** Low
- **Betrifft:** AC-12
- **Steps to Reproduce:**
  1. „Session beenden“ → „Eigene Uhrzeit“ vor dem Start bzw. in der Zukunft bzw. vor dem letzten Fang.
  2. Erwartet: eine Meldung am Feld, die die erlaubte Spanne nennt (AC-12).
  3. Tatsächlich: „Das Ende muss nach dem Start liegen.“ / „Dieser Zeitpunkt liegt in der Zukunft.“ / „Der Fang um … läge außerhalb der Session.“ Die Spanne steht nur als fester Hinweis im Sheet (`endSpanHint`, `end-session-sheet.tsx`). Nur die 48-h-Meldung nennt eine Grenze.
- **Priority:** im nächsten Durchgang (`/build`, Meldungstexte in `src/lib/fishing/messages.ts` und der Endzeit-Prüfung).

#### BUG-3: Beendete Session lässt sich über die Datenbank-Schnittstelle wieder öffnen
- **Severity:** Low (nur eigene Daten)
- **Betrifft:** EC-13; `design.md` → Datenmodell („Beendete Sessions bekommen nie wieder ein leeres Ende“)
- **Steps to Reproduce:**
  1. Als angemeldeter Nutzer ohne laufende Session `PATCH /rest/v1/sessions?id=eq.<beendete>` mit `{"ended_at": null}` senden, mit eigenem Token.
  2. Erwartet: Ablehnung.
  3. Tatsächlich: `[{"ended_at":null}]`, die Session läuft wieder.
  - Die Umsetzungsnotizen in `design.md` nennen die Abweichung. Im Schema fehlt eine Sperre, etwa ein Trigger, der `ended_at` nicht von gesetzt auf leer wechseln lässt.
- **Priority:** Nice to have (`/build`, kleine Migration).

#### BUG-4: `createCatch` vertraut dem Client-Flag `sessionWasRunning`
- **Severity:** Low (nur eigene Daten)
- **Betrifft:** AC-26
- **Ursache:** `src/lib/fishing/actions/catches.ts:216-217` übernimmt das Flag aus der Anfrage, und `catches.ts:155` speichert dann die mitgeschickte Position als `gps`, auch in einer beendeten Session.
- **Steps to Reproduce:**
  1. „Fang nachtragen“ in einer beendeten Session als manipulierte Anfrage mit `sessionWasRunning: true` und einer Position senden.
  2. Erwartet: Die Kopie der Session-Position (`session`) bzw. `none` wird gespeichert (AC-26).
  3. Tatsächlich: Die Client-Koordinaten werden als `gps` gespeichert (Abnahme-Lane: lat 1, `gps`).
  - Hinweis: Über PostgREST kann ein Nutzer seine eigenen Zeilen ohnehin frei schreiben, etwa die Herkunft oder eine Startzeit in der Vergangenheit. Die Tabellen haben `insert`/`update` für `authenticated`. Das betrifft die Datenqualität der eigenen Daten, nicht fremde Daten.
- **Priority:** Nice to have. Zum Beispiel das Flag serverseitig ableiten (Session war beim Öffnen laufend = Fangzeit liegt vor dem jetzigen Ende und das Ende ist sehr frisch) oder bei beendeten Sessions nur annehmen, wenn das Ende nach dem Öffnen des Formulars liegt.

#### BUG-5: Zweites Löschen desselben Fangs meldet „Diese Session gibt es nicht mehr.“
- **Severity:** Low
- **Betrifft:** zusätzlicher Edge Case zu AC-28 / EC-5
- **Steps to Reproduce:**
  1. Einen Fang löschen, z. B. in einem zweiten Tab, der die Fang-Seite noch offen hat.
  2. Denselben Fang noch einmal löschen.
  3. Erwartet: „Fang gelöscht“ oder ein Hinweis, dass der Fang nicht mehr existiert, und die Detailansicht der Session.
  4. Tatsächlich: Weiterleitung auf `/?notice=session-gone`, obwohl die Session noch existiert (Owner `s5.mjs`; `deleteCatch` in `catches.ts` leitet bei nicht gefundenem Fang immer auf `SESSION_GONE`).
- **Priority:** Nice to have (`/build`).

#### Auch bemerkt (kein Bug)
- `/privacy` sagt, die Standortabfrage komme „beim Speichern eines Fangs“. Bei „Fang nachtragen“ fragt die App nicht ab. Der Text übertreibt also leicht in die sichere Richtung und steht so im Design.
- In `.next/dev/server/app/(app)/account/…` und `(app)/page` liegen noch Manifeste der alten Pfade. Das sind Reste des Dev-Builds ohne Wirkung zur Laufzeit.
- `X-Powered-By: Next.js` (PROJ-1 BUG-16, Low) ist unverändert.

## Summary
- **Acceptance Criteria:** 39/40 bestanden, 1 fehlgeschlagen (AC-12, Low). Kein AC ist ganz NOT VERIFIED. Die browserabhängigen Teile stehen oben unter „Not Verified“.
- **Edge Cases:** 11/13 bestanden, 2 fehlgeschlagen (EC-6 Medium, EC-13 Low). Dazu ein zusätzlicher Edge Case fehlgeschlagen (BUG-5, Low).
- **Bugs Found:** 5 insgesamt (0 Critical, 0 High, 1 Medium, 4 Low)
- **Security:** 11/12 Prüfungen belegt, 1 NOT VERIFIED (Rate Limiting auf den PROJ-2-Actions: nicht umgesetzt, optional für das MVP).
- **Regression PROJ-1:** keine Regression. Die Suite ist grün (353/353), Build und Lint sind grün.
- **Production Ready:** JA
- **Recommendation:** Deploy möglich. BUG-1 vorher per `/refine PROJ-2` entscheiden und beheben lassen (empfohlen), die Low-Bugs im nächsten Durchgang.

> „Production Ready: JA“ heißt: *keine Critical/High-Bugs*. Es heißt **nicht**, dass alles geprüft wurde. Offen sind die Browser-Darstellung, die echte Standortabfrage, das 30-Sekunden-Ziel am Smartphone und der echte Verbindungsabbruch. Diese Punkte brauchen einen Menschen oder `/e2e-tests`.

**Aufräumen:** Alle `qa-p2-*`-Testkonten sind gelöscht. Die Zählabfrage danach ergibt 0 Konten `qa-p2-%`, 0 Sessions, 0 Fänge und 0 Zeilen in `auth_throttle_events`. Schlüssel- und Cookie-Dateien im Scratchpad sind gelöscht. Der Produktionsserver auf `:3556` ist gestoppt.
