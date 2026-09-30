# QA-Testergebnisse: PROJ-3 Automatische Wetterdaten

**Getestet:** 2026-09-30 (erster `/qa`-Lauf, Stand `43f8ae4`)
**App-URL:** http://localhost:3553 (`probe.kind: http`, Dev-Server `npm run dev`, vor dem Fan-out neu gestartet, weil der vorherige Dev-Server intern abgestürzt war und 500 lieferte). Lokale Supabase in Docker (API `127.0.0.1:55321`). Open-Meteo war erreichbar und wurde echt angefragt.
**Tester:** QA Engineer (AI). Geprüft haben drei unabhängige `qa-engineer`-Läufe, die den Bau nicht kannten: Abnahme (Step 2), Security (Step 3), Regression (Step 4 + Suite-Teil von Step 5). Der `/qa`-Owner hat die Suiten einmal vor dem Fan-out laufen lassen, den Unit-Test aus Step 6 geschrieben und die Ergebnisse zusammengeführt.
**Autonomer Lauf:** Der Nutzer hat den Lauf vorab freigegeben („bei /qa gehen wir nach deinen Empfehlungen vor“). Die Priorisierung der Bugs (Step 8) steht als Empfehlung unten und wird so umgesetzt.
**Umfang:** `full` — erster `/qa`-Lauf für PROJ-3, es gab keinen früheren Bericht.

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
>
> **Methode der Lanes:** Testnutzer über die lokale Auth-Admin-API, Session-Cookies selbst gebaut, Server Actions per HTTP (`Next-Action`-Header, ID aus dem ausgelieferten Client-Chunk), direkte Zugriffe über PostgREST mit dem Zugang des jeweiligen Testnutzers und `psql` im Container. Alle Testnutzer der Lanes wurden am Ende samt Daten gelöscht.

### Automatisierte Tests und Build (einmal vor dem Fan-out)
- [ ] BUG **Unit-Suite `npm test`, Lauf 1:** 30 Dateien, 488 bestanden, **1 fehlgeschlagen** (`src/components/fishing/session-list.test.tsx:99`, „shows the returned message as a warning and keeps what is loaded; a retry works“) — `suite-run.txt`. Siehe BUG-1.
- [x] **Unit-Suite `npm test`, Lauf 2:** 489 bestanden, 0 fehlgeschlagen — `suite-run-2.txt`. Die Einzeldatei lief danach 5× grün.
- [x] **Lint** `npm run lint`: exit 0, keine Befunde (Owner, vor dem Fan-out).
- [x] **Produktions-Build** `npm run build`: exit 0, TypeScript fehlerfrei, 18 Routen plus Proxy (Build von 06:50 auf Stand `52788e7`; seitdem nur ein Test und die INDEX-Zeile geändert).
- [x] **Migrationen:** Alle 7 Migrationen laufen in einer Transaktion mit `ROLLBACK` auf einer frisch aufgebauten `public`-Schema-Kopie fehlerfrei durch, auch auf gefüllten Tabellen. Die Nachbefüllung setzt Einträge mit Position auf `pending`, ohne auf `no_position` (Regression, `replay.sql`; `20260930160000_weather.sql:45-51`).
- [x] **Neuer Unit-Test aus diesem Lauf:** `src/lib/weather/actions.test.ts` → „sends at most 4 requests to Open-Meteo at the same time“, 16/16 grün. Rote Runde gemacht: Mit `MAX_PARALLEL_REQUESTS = 6` schlägt genau dieser Test fehl.
- E2E: Es gibt kein `tests/`-Verzeichnis, also nichts auszuführen.

## Acceptance Criteria

#### Wetter abrufen
- [x] **AC-1**: Laufende Session mit Position → `ok`, `weather_hour` = volle Stunde, alle 7 Werte gesetzt (Abnahme, DB-Abfrage). Der Trigger setzt beim Anlegen `pending` (`20260930160000_weather.sql:163-188`).
- [x] **AC-2**: Fang mit GPS → `ok` zur Fangzeit; Fänge mit von der Session übernommener Position behandelt der Trigger gleich (Abnahme; Migration `:163-176`).
- [x] **AC-3**: Nachgetragene Session von 2019 → `ok` aus dem Archiv (22,3 °C, Code 63). Endpunkt-Wahl `core.ts:59-61` (Abnahme).
- [x] **AC-4**: 12:29Z → 12:00Z, 12:30Z → 13:00Z (DB). Werte gleich einer direkten Open-Meteo-Abfrage. `core.ts:36-38` (Abnahme).
- [x] **AC-5**: Die Speicher-Actions aus PROJ-2 sind unverändert (`git diff --stat main..HEAD -- src/lib/fishing/actions/` leer); das Wetter holt erst die Detailansicht (`sessions/[id]/page.tsx:190`). Die Detailseite antwortet auch mit 60 offenen Fängen in 0,9 s mit „Wetter wird abgerufen …“ (Abnahme).
- [x] **AC-6**: „Wetter wird abgerufen …“ steht im server-gerenderten HTML; das Nachladen per `router.refresh()` (`weather-auto-fill.tsx:31-36`) ist durch `weather-auto-fill.test.tsx` belegt. Das sichtbare Einblenden im Browser ist NOT VERIFIED (kein Browser).
- [x] **AC-7**: Ohne Position → `no_position`, im HTML „Ohne Wetterdaten“ und „Ohne Position wird kein Wetter abgerufen.“, kein Button (Abnahme; `actions.ts:74`).

#### Fehlschlag & Nachholen
- [x] **AC-8**: Session von 1935 (Archiv antwortet 400) → `failed`, Eintrag bleibt, im HTML „Wetter konnte nicht abgerufen werden.“; Timeout und Nicht-200 in `open-meteo.ts:63-80` (Abnahme).
- [x] **AC-9**: Offene Einträge werden beim Öffnen nachgeholt (live), fehlgeschlagene nach 60 s (`format.ts:92`). Altbestand vor PROJ-3: Die Migration setzt ihn auf `pending`, im Replay auf gefüllten Tabellen belegt (Regression, `replay.sql`); `pending` wird immer nachgeholt (Abnahme). Siehe auch BUG-3 (Fang-Seite bei mehr als 50 offenen Einträgen).
- [x] **AC-10**: Button gesperrt während des Abrufs, Warnung bei erneutem Fehlschlag (`retry-weather-button.tsx:30,36,40`; `weather-auto-fill.test.tsx` 3/3); live setzt ein Knopfdruck nach mehr als 10 s `weather_attempted_at` neu (Abnahme). Zur Warnung in der Abkühlzeit siehe BUG-4.

#### Änderungen am Eintrag
- [x] **AC-11**: Nur Name, Notiz, Endzeit geändert → Wetter bleibt. Startzeit 10:10 → 08:40 → `pending`, Werte gelöscht, neu geholt für 09:00Z (Abnahme, REST + DB).
- [x] **AC-12**: Länge und Köder geändert → Wetter bleibt. Fangzeit auf 13:45 → Reset, danach 14:00Z (Abnahme).
- [x] **AC-13**: Session-Position entfernt → `no_position`, Werte gelöscht; ein Fang mit eigener Kopie behält `ok`. Fang-Position entfernt → `no_position` (Abnahme; Regression AC-38 über die App).

#### Anzeige
- [x] **AC-14**: HTML: „Wetter beim Start“ vor „Fänge“, „16,0 °C“, „1026 hPa“, „13 km/h O“, „100 %“, „0,0 mm“, „Bewölkt“, „Werte für 12:00 Uhr · Open-Meteo“ (Abnahme). Farben und Raster: NOT VERIFIED (kein Browser).
- [x] **AC-15**: Fang-Seite mit „Wetter beim Fang“, 6 Kacheln, „Werte für 15:00 Uhr“ (Abnahme, HTML).
- [x] **AC-16**: `failed` → „Ohne Wetterdaten“, Grund, Button (Zähler 1); `no_position` → kein Button (Abnahme; `weather-section.tsx:27,78-87`).
- [x] **AC-17**: Übersicht: `failed`, `no_position` und `pending` älter als 5 min tragen „ohne Wetter“, `pending` jünger als 5 min und `ok` nicht. Fangzeile: nur beim Fang ohne Position `aria-label="ohne Wetter"` (Abnahme; `format.ts:79`).
- [x] **AC-18**: `session-forms.test.tsx:130-135` im Owner-Lauf grün; `session-backfill-form.tsx:220-226`. Das Umschalten im Browser: NOT VERIFIED.

#### Zugriffsschutz & Datenschutz
- [x] **AC-19**: B sieht per REST weder Sessions noch Fänge von A (`[]`), PATCH/DELETE ändern 0 Zeilen, INSERT in As Session → `403 42501`. Die Action als B mit As Session-ID (auto und `manual`) → `filled:0`, A unverändert, kein Abruf. Seiten von A → 404 ohne As Daten (Abnahme + Security; Policies `sessions_*_own`/`catches_*_own` in `pg_policies`).
- [x] **AC-20**: URL nur aus Konstanten und gerundeten Koordinaten (`open-meteo.ts:21-37`, Rundung `:25-26` und `core.ts:86`), nur Header `accept` (`:63-68`); `open-meteo.test.ts` 14/14 (Security-Gegenprobe). Die tatsächlich ausgehende Anfrage wurde nicht mitgeschnitten.
- [x] **AC-21**: `GET /account/export` → `version: 3`, `weather` je Session und Fang (bei `ok` mit allen Werten, `weather_label`, `fetched_at`, sonst nur `{status}`), keine internen Zeitstempel; alle Felder von Version 2 bleiben (Abnahme + Regression).
- [x] **AC-22**: Fang/Session gelöscht → 0 Zeilen; Konto gelöscht → Sessions, Fänge, Profil 0 (Abnahme, Security; FKs mit `ON DELETE CASCADE`).
- [x] **AC-23**: `open-meteo.ts:1` `import 'server-only'`; 0 Treffer für `open-meteo`/`archive-api` in 21–24 Client-Chunks und in `.next/static` (Security, Abnahme).
- [x] **AC-24**: `/privacy` enthält „Wetterdaten“ mit allen geforderten Aussagen (`privacy/page.tsx:70-88`; Abnahme).

## Edge Cases
- [x] **EC-1**: Garantie aus `design.md` im Code: Trigger-Reset bei geänderter Bezugszeit (`weather.sql:166-172`) + bedingtes Schreiben `.eq(started_at/caught_at, alte Zeit)` (`actions.ts:152-156`). Provoziert: verspätetes Schreiben mit alter Zeit → 0 Zeilen (Abnahme).
- [x] **EC-2**: `.not('latitude','is',null)` + Statusfilter, nur `update`, nie `upsert` (`actions.ts:149-156`). Provoziert: nach Löschen bzw. entfernter Position → 0 Zeilen, kein Fehler (Abnahme, Security).
- [x] **EC-3**: `.in('weather_status',['pending','failed'])` (`actions.ts:156`), Wetter in derselben Zeile. 3 bzw. 5 parallele Aufrufe → genau ein Snapshot pro Eintrag, keine Fehler (Abnahme, Security). Nebenwirkung siehe BUG-2.
- [x] **EC-4**: `pending` wird beim nächsten Öffnen immer nachgeholt (`format.ts:92-95`), live mit 3 offenen Einträgen (Abnahme).
- [x] **EC-5**: 60 offene Fänge: GET 0,9 s; erster Aufruf `filled:50` in 1,1 s, zweiter `filled:11`; Bündeln `core.ts:82-105`; höchstens 4 parallel (neuer Unit-Test) (Abnahme, Owner).
- [x] **EC-6**: `ok` ohne Bewölkung, unbekannter Code 42, ohne Windrichtung → „Bewölkung –“, „Wetter –“, „22 km/h“ (Abnahme, HTML).
- [ ] BUG **EC-7**: 429 zählt als Fehlschlag, Abkühlzeit greift beim Neuladen (Abnahme; `open-meteo.test.ts:138`). Die Abkühlzeit lässt sich aber mit parallelen Aufrufen und über die Datenbank-Schnittstelle umgehen, sodass ein Nutzer das gemeinsame Kontingent erschöpfen kann → BUG-2.
- [x] **EC-8**: Zeitumstellung 29.03.2026: Fang 00:50Z → Stunde 01:00Z, Anzeige „03:00 Uhr“, Werte gleich der Archiv-Abfrage; Start um Mitternacht → „00:00 Uhr“ (Abnahme).
- [x] **EC-9**: Wenige Minuten alt → `ok` (Forecast); 2019 → `ok` (Archiv); 1935 → `failed` (Abnahme).
- [x] **EC-10**: Greifswalder Bodden (54,24 / 13,55, Open-Meteo `elevation 0.0`) → `ok` (Abnahme).

## Security Audit Results
- [x] Authentication: ohne Cookie → `307 /login` für Detail, Fang-Seite, Export und die Action (`actions.ts:166`, `require-user.ts:10-17`); `anon` ohne Tabellenrechte (`401`).
- [x] Authorization: zwei Nutzer über REST, Action und Seiten — nichts von A für B lesbar, änderbar oder auslösbar (siehe AC-19); Policies und FK `catches_session_owner_fkey` in der DB.
- [x] Input validation: `sessionId` mit SQL-/PostgREST-Fragmenten, `manual:"true"`, Array → `{status:"error"}` (`z.uuid()`); Wetterwerte aus Open-Meteo werden auf Typ und Grenzen geprüft (`core.ts:122-129`); DB-Regeln lehnen `<script>` als Status und Werte außerhalb der Grenzen ab (`400 23514`); kein SSRF (URL aus Konstanten).
- [!] Rate limiting der Action pro Nutzer oder IP: NOT VERIFIED — nicht umgesetzt (im Design nicht versprochen, optional fürs MVP). Die versprochene Abkühlzeit lässt sich umgehen → BUG-2.
- [!] Brute force, Enumeration, Massen-Registrierung: NOT VERIFIED — nicht anwendbar, PROJ-3 prüft keine Zugangsdaten (PROJ-1-Code unverändert, `git diff --stat b94c166..HEAD -- src/proxy.ts src/lib/auth …` leer).
- [x] Credentials never appear in the URL: PROJ-3 fügt kein Formular hinzu; „Wetter erneut abrufen“ ist `type="button"` (`retry-weather-button.tsx:36`).
- [x] No secrets in the client bundle: lokaler Service-Role-Key 0× in `.next`; `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `weather_requested_at` 0× in `.next/static`.
- [x] Sensitive data in responses: Action liefert nur `{status, filled, failed}`; Übersicht ohne Positionen und Werte; Export mit `Cache-Control: private, no-store`.
- [x] Positionen in URLs und Logs: Action per POST mit nur der Session-ID; Logs nur mit Art und HTTP-Status (`open-meteo.ts:48`, `actions.ts:66-70`); `logging.serverFunctions: false`.
- [x] CSRF: Action mit fremder `Origin` → `500 Invalid Server Actions request.`
- [x] Security headers (Stichprobe `/privacy`): `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS mit `includeSubDomains`.

## Regression
- [x] **PROJ-2-Garantien in der DB** (im Migrations-Replay, als `authenticated`): höchstens eine laufende Session, keine Überschneidung, Fangzeit-Garantie, keine Wiedereröffnung, nur Besitzer, Kaskade bei Kontolöschung. Trigger-Reihenfolge `*_check_*` → `*_reset_weather` → `*_set_updated_at`, `reset_weather` schreibt nur `weather_*`-Spalten.
- [x] **PROJ-2-Abläufe über die laufende App** (Server Actions per HTTP): Session starten, zweiter Start, Fang mit und ohne GPS, doppelte Fang-ID, Fang in der Zukunft, ungültige Länge, bearbeiten, beenden (auch zweimal), nachtragen, über 48 h, Überschneidung, Fang nachtragen, Fang außerhalb nach Zeitänderung, Position entfernen, Fang und Session löschen, Zugriff als B, Konto mit laufender Session löschen, Export (alle Felder aus Version 2 vorhanden).
- [x] **Gemeinsame Seiten per HTML:** Übersicht, Leiste der aktiven Session auf `/` und `/account`, `/start`, Detailansicht (Kennzahl, Positionen mit Herkunft, leerer Zustand), Fang bearbeiten, Session bearbeiten, Nachtragen, `/privacy` (PROJ-2-Abschnitt unverändert).
- [x] **PROJ-1:** Code unverändert; Login setzt das Cookie, Abgemeldete werden umgeleitet, öffentliche Seiten liefern 200, Konto-Seite vollständig.
- [ ] BUG **Suite deterministisch:** siehe BUG-1.

## E2E Tests
- Status: **not run** (run `/e2e-tests` for critical flows)

## Not Verified In This Run
- [!] Cross-Browser (Chrome / Firefox / Safari) — `/qa` läuft ohne Browser.
- [!] Layout bei 375 / 768 / 1440 px, Farben (Lake-Kacheln, vertiefte Fläche) — braucht einen echten Viewport.
- [!] Das sichtbare Einblenden der Kacheln ohne Neuladen (AC-6) und das Umschalten des Hinweises beim Nachtragen (AC-18) im Browser — belegt nur durch Unit-Tests und Code.
- [!] Die tatsächlich ausgehende Anfrage an Open-Meteo (Parameter, Header) — nicht mitschneidbar, belegt durch Code und `open-meteo.test.ts`.
- [!] Echte Races für EC-1/EC-2 — nicht provoziert; die Garantien sind im Code und in der DB bestätigt, verspätete Schreibversuche einzeln provoziert.
- [!] Obergrenzen 50 / 4 / 8 s zur Laufzeit voll ausgereizt — nur 50 live (EC-5), 4 per Unit-Test, 8 s per Code; das Kontingent von Open-Meteo wurde geschont.
- [!] Rate limiting pro Nutzer oder IP — nicht umgesetzt (siehe BUG-2).
- [!] Features mit Status „Deployed“ — es gibt keine; geprüft wurden PROJ-1 und PROJ-2 (Approved).

## Bugs Found

#### BUG-1: Instabiler Test in der Session-Liste (Race in `SessionList`)
- **Severity:** High (Step-5-Regel: jeder Fehlschlag der Suite) — Ursache liegt im PROJ-2-Code, die UI-Auswirkung ist nur Low
- **Steps to Reproduce:**
  1. `src/components/fishing/session-list.test.tsx` mehrfach parallel unter Last laufen lassen (z. B. 6 Prozesse gleichzeitig).
  2. Expected: 8/8 grün, jedes Mal.
  3. Actual: gelegentlich 1 fehlgeschlagen (HEAD: 1× in 48 Läufen; vor PROJ-3 auf `b94c166`: 3× in 94 Läufen — also schon vorher vorhanden).
- **Ursache:** `session-list.tsx:48-63` — `setError(null)` läuft im async `startTransition` vor dem `await`, `setItems`/`setNextCursor` danach außerhalb der Transition. Die Liste kann schon neu sein, während die Warnung noch steht. In der App bleibt die alte Warnung nach einem erfolgreichen „Weitere laden“ kurz sichtbar.
- **Priority:** Fix before deployment (die Suite muss deterministisch sein)

#### BUG-2: Abkühlzeit gegen eine Anfrageflut an Open-Meteo lässt sich umgehen
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Session und Fang auf `pending`, dann 5 parallele Aufrufe von `fillMissingWeather` mit dem eigenen Konto.
  2. Expected (`design.md` → Technische Entscheidungen, EC-7): „Neuladen oder Tippen in Serie löst keine Anfrageflut aus … gilt auch über Geräte hinweg.“
  3. Actual: Alle 5 Aufrufe laufen durch den Abrufpfad (je 0,8–0,9 s statt 0,3 s), zwei davon schreiben je einen Eintrag — beide hatten beide Einträge ausgewählt und Open-Meteo gefragt. `isDue` liest `weather_attempted_at`, gesetzt wird der Wert erst nach dem Abruf (`actions.ts:73-79, 138-147`).
  4. Zweiter Weg: `PATCH catches?id=eq.<eigener Fang> {"weather_attempted_at":null}` mit dem eigenen Token → `200`, der nächste Aufruf fragt sofort erneut.
- **Auswirkung:** Ein einzelner Nutzer kann in einer Schleife beliebig viele Anfragen von der Server-IP auslösen und das kostenlose Kontingent erschöpfen; danach bekommen alle Nutzer „Ohne Wetterdaten“. Kein Datenverlust, keine fremden Daten.
- **Priority:** Fix before deployment

#### BUG-3: Die Fang-Seite holt ihren eigenen Fang nicht bevorzugt
- **Severity:** Low
- **Steps to Reproduce:**
  1. Session mit mehr als 50 offenen Einträgen, Fang-Seite eines späten Fangs öffnen.
  2. Expected: Der geöffnete Fang bekommt sein Wetter (AC-6, AC-9).
  3. Actual: Die Action nimmt immer zuerst die Session, dann die Fänge nach Fangzeit (`actions.ts:82-98`); der geöffnete Fang bleibt bis zum nächsten Öffnen bei „Wetter wird abgerufen …“.
- **Priority:** Fix before deployment (klein)

#### BUG-4: Warnung beim Knopf auch während der Abkühlzeit
- **Severity:** Low
- **Steps to Reproduce:**
  1. Innerhalb von 10 s nach einem Versuch erneut „Wetter erneut abrufen“ tippen.
  2. Actual: Antwort `filled:0, failed:false` (kein Abruf), angezeigt wird „Wetter gerade nicht verfügbar. Versuche es später erneut.“ (`retry-weather-button.tsx:27-30`).
- **Einordnung:** Die Meldung trifft in der Abkühlzeit inhaltlich zu („versuche es später erneut“). Empfehlung: **keine Änderung**.
- **Priority:** Nice to have

#### BUG-5: Die Migration setzt `updated_at` aller bestehenden Sessions und Fänge neu
- **Severity:** Low
- **Steps to Reproduce:** Die Nachbefüllung in `20260930160000_weather.sql:45-51` löst den PROJ-2-Trigger `set_updated_at` aus; bestehende Einträge bekommen den Migrationszeitpunkt als „letzte Änderung“, der auch im Export steht (Regression, aus dem Code abgeleitet).
- **Einordnung:** Es gibt keine gehostete Datenbank mit echten Daten (PRD: kein Deployment; `features/INDEX.md` → Deployments nur Platzhalter). Beim ersten Einspielen auf einer leeren Datenbank betrifft die Nachbefüllung keine Zeile. Empfehlung: **keine Änderung**.
- **Priority:** Nice to have

### Außerdem festgehalten (kein Bug)
- **Eigene Wetterwerte über die Datenbank-Schnittstelle änderbar:** Der Besitzer kann per PostgREST eigene Wetterwerte schreiben. Das ist in `design.md` als bewusste Grenze dokumentiert (wie PROJ-2 BUG-4). Die Produktentscheidung „Wetter ist nicht von Hand änderbar“ betrifft die App, die kein solches Feld anbietet. Fremde Daten sind nicht betroffen.
- **Bedingtes Schreiben prüft nur „Position vorhanden“, nicht „Position gleich“:** Die App ändert Positionen nie, sie entfernt sie nur; der Trigger setzt bei jeder Positionsänderung zurück. Ein Restfall betrifft nur Direktzugriffe auf eigene Daten.

## Summary
- **Acceptance Criteria:** 24/24 bestanden (Teile von AC-6, AC-14, AC-18, AC-20 zusätzlich NOT VERIFIED, weil sie einen Browser bzw. einen Mitschnitt bräuchten)
- **Edge Cases:** 9/10 bestanden, EC-7 mit BUG-2
- **Bugs Found:** 5 total (0 critical, 1 high, 1 medium, 3 low)
- **Security:** 9/11 Prüfungen belegt, 2 NOT VERIFIED (Rate limiting pro Nutzer — nicht umgesetzt; Brute force — nicht anwendbar)
- **Production Ready:** **NO** — BUG-1 (High) ist offen.
- **Recommendation:** Fix bugs first. Empfohlene Reihenfolge: BUG-1, BUG-2, BUG-3 über `/build`; BUG-4 und BUG-5 ohne Änderung schließen. Danach `/qa` als Re-Verifikation.

> „Production Ready: YES“ heißt *keine Critical/High-Bugs* — nicht, dass alles geprüft wurde. Die NOT-VERIFIED-Punkte oben bleiben offen und brauchen einen Menschen oder `/e2e-tests`.
