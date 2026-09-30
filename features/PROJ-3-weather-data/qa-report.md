# QA-Testergebnisse: PROJ-3 Automatische Wetterdaten

**Getestet:** 2026-09-30, zweiter `/qa`-Lauf (Re-Verifikation, Stand `50b4e17`). Der erste Lauf (Stand `43f8ae4`, Bericht in `54a2007`) fand BUG-1 bis BUG-5.
**App-URL:** http://localhost:3553 (`probe.kind: http`, Dev-Server `npm run dev`). Lokale Supabase in Docker (API `127.0.0.1:55321`). Open-Meteo war erreichbar und wurde echt angefragt (insgesamt etwa 15 Anfragen in diesem Lauf, das Kontingent wurde geschont).
**Tester:** QA Engineer (AI). Drei unabhängige `qa-engineer`-Läufe, die den Bau nicht kannten: Abnahme (Step 2), Security (Step 3), Regression (Step 4 + Suite-Teil von Step 5), jeweils mit eigenem Skriptordner (`scratchpad\r2-acc`, `r2-sec`, `r2-reg`). Der `/qa`-Owner hat die Suiten einmal vor dem Fan-out laufen lassen und die Ergebnisse zusammengeführt.
**Autonomer Lauf:** Der Nutzer hat den Lauf vorab freigegeben („bei /qa gehen wir nach deinen Empfehlungen vor“).

**Umfang: Re-Verifikation — `git diff --stat 54a2007..HEAD`.** Geänderte Produktionsdateien:
- `supabase/migrations/20260930180000_weather_budget.sql` (neu)
- `src/lib/weather/actions.ts`
- `src/components/weather/weather-auto-fill.tsx`
- `src/app/(app)/sessions/[id]/catches/[catchId]/page.tsx`
- `src/components/fishing/session-list.tsx` (PROJ-2-Code)
- dazu 2 Testdateien, `design.md`, `docs/data-model.md`, `docs/privacy.md`

Weil der Diff eine Migration, eine neue Entität im Datenmodell und PROJ-2-Code berührt, liefen alle drei Lanes in voller Breite. Neu geprüft wurden die offenen Bugs, alle AC/EC, deren Dateien im Diff liegen, und die Regression von PROJ-1 und PROJ-2. **Übernommen** (nicht neu ausgeübt) sind die übrigen Ergebnisse aus Lauf 1; sie sind unten mit „unverändert seit Lauf 1“ markiert und nicht neu abgehakt.

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund) · `— unverändert seit Lauf 1` übernommen, nicht neu ausgeübt

### Automatisierte Tests und Build (einmal vor dem Fan-out)
- [x] **Unit-Suite `npm test`:** 30 Dateien, 499 bestanden, 0 fehlgeschlagen — `suite-run-r2.txt` (Start 07:16:49).
- [x] **Lint** `npm run lint`: exit 0 — `lint-r2.txt`.
- [x] **Produktions-Build** `npm run build`: exit 0, TypeScript fehlerfrei (Owner, nach den Fixes auf `50b4e17`).
- [x] **Migrationen:** Alle 8 Migrationen in einer Transaktion mit `ROLLBACK` auf frischem `public`-Schema mit Daten eingespielt, exit 0. `claim_weather_budget` (4 × 50 → `true`, dann `false`), Cron-Job `petrilog-weather-fetch-log-cleanup` löscht nur Zeilen älter als 60 min, FK-Kaskade bis `weather_fetch_log` (Regression, `r2-reg\replay.sql`). Lokal ist die Migration in `schema_migrations` eingetragen, der Cron-Job lief um 05:15 UTC mit `succeeded`.
- [x] **Einzeldateien (Gegenprobe):** `actions.test.ts` + `weather-auto-fill.test.tsx` 32/32 grün (Abnahme).
- E2E: kein `tests/`-Verzeichnis, nichts auszuführen.

## Acceptance Criteria

#### Wetter abrufen
- [x] **AC-1**: `startSession` über die App → sofort `pending`; Nachholen → `ok`, Start 05:22Z → Stunde 05:00Z, alle 7 Werte; HTML „Wetter beim Start“ (Abnahme r2).
- [x] **AC-2**: Fang mit GPS über `createCatch` → `pending`, dann `ok` zur Stunde 05:00Z; 60 Fänge mit Position von der Session → `ok` (Abnahme r2).
- [x] **AC-3**: `backfillSession` 2019-06-15 mit Position → `ok`, Stunde 04:00Z, 20,4 °C (Abnahme r2).
- **AC-4** — unverändert seit Lauf 1 (12:29Z → 12:00Z, 12:30Z → 13:00Z); `core.ts` nicht im Diff.
- [x] **AC-5**: `git diff --stat 54a2007..HEAD -- src/lib/fishing/` leer; nach dem Speichern sofort `pending` (212 ms), das Wetter kommt über die getrennte Action (Abnahme r2).
- [x] **AC-6**: HTML vorher „Wetter wird abgerufen …“ mit `needed:true`, danach die Kacheln; `router.refresh()` per Unit-Test belegt. Sichtbares Einblenden im Browser NOT VERIFIED. Randfall zweites Gerät → BUG-6.
- **AC-7** — unverändert seit Lauf 1; die Regel `no_position` liegt im Trigger (nicht im Diff).

#### Fehlschlag & Nachholen
- [x] **AC-8**: Session von 1935 → `{"filled":0,"failed":true}`, Zeile `failed`, bleibt erhalten; HTML „Wetter konnte nicht abgerufen werden.“ (Abnahme r2).
- [x] **AC-9**: `pending` wird immer nachgeholt; `failed` innerhalb 60 s kein Versuch und kein Budgetverbrauch, bei 61 s neuer Versuch (Abnahme r2, `t7.mjs`). Altbestand: Nachbefüllung im Replay belegt (Regression r2). Randfall Budget → BUG-8.
- [x] **AC-10**: manuell innerhalb 10 s kein Versuch, nach 15 s neuer Versuch mit Warnung bei `failed`; Knopf gesperrt während des Abrufs; bei aufgebrauchtem Budget „Wetter gerade nicht verfügbar …“ (Abnahme r2). Randfall Fang-Seite → BUG-7.

#### Änderungen am Eintrag
- **AC-11, AC-12, AC-13** — unverändert seit Lauf 1; Trigger und Speicher-Actions nicht im Diff. EC-1 und EC-2 wurden in diesem Lauf mit echten Races erneut geprüft (siehe unten).

#### Anzeige
- **AC-14, AC-16, AC-17, AC-18** — unverändert seit Lauf 1; Anzeige-Bausteine nicht im Diff.
- [x] **AC-15**: Fang-Seite „Wetter beim Fang · Luft 13,6 °C · Luftdruck 1025 hPa · Wind 16 km/h SO · Bewölkung 100 % · Niederschlag 0,0 mm · Wetter Bewölkt · Werte für 07:00 Uhr · Open-Meteo“ (Abnahme r2, HTML).

#### Zugriffsschutz & Datenschutz
- [x] **AC-19**: B mit As `sessionId`/`catchId` (auto und manuell) → `filled:0`, As Zeilen unverändert, keine fremde Reservierung, B ohne Budgetverbrauch; B mit eigener Session und As `catchId` → `filled:0`; `weather_fetch_log` für B `403`; As Fang-Seite für B `404` (Abnahme + Security r2).
- [x] **AC-20**: `open-meteo.ts`/`core.ts` nicht im Diff; Rundung `open-meteo.ts:25-26`; neue Log-Zeile `actions.ts:233` ohne Position oder IDs (Abnahme + Security r2). Ausgehende Anfrage nicht mitgeschnitten (NOT VERIFIED).
- **AC-21** — unverändert seit Lauf 1 (Export-Route nicht im Diff); Regression r2 bestätigt `version`-Export mit 25 Sessions. Zum Budget-Protokoll im Export → BUG-10.
- **AC-22** — unverändert seit Lauf 1; Regression r2: Kontolöschung entfernt jetzt auch `weather_fetch_log`.
- [x] **AC-23**: `server-only`/`'use server'`; 0 Treffer für `open-meteo`, `archive-api`, `claim_weather_budget`, `weather_fetch_log`, `SERVICE_ROLE` in 31 Client-Chunks und in `.next/static` (Abnahme + Security r2).
- **AC-24** — unverändert seit Lauf 1; `/privacy` nicht im Diff.

## Edge Cases
- [x] **EC-1**: echter Race — Nachholen gestartet, 120 ms später `PATCH caught_at` → `filled:0`, Zeile `pending`; nächstes Öffnen → Wetter zur neuen Stunde. Garantie `actions.ts:187-195` + Trigger (Abnahme r2).
- [x] **EC-2**: echter Race — Session 120 ms nach Start gelöscht → `filled:0`, kein Fehler, nichts neu angelegt (Abnahme r2).
- [x] **EC-3**: 5 bzw. 6 parallele Aufrufe → genau ein Schreiber (gleiches `weather_fetched_at`), die übrigen `filled:0` ohne Netzabruf; Garantie: bedingte Reservierung `actions.ts:129-150` + bedingtes Schreiben `:194` (Abnahme + Security r2).
- [x] **EC-4**: erneut geöffnete Fang-Seite mit `needed:true`, Nachholen → `ok` (Abnahme r2). Schließen der App mitten im Abruf NOT VERIFIED.
- [x] **EC-5**: 60 offene Fänge: Detailansicht 735 ms mit „Wetter wird abgerufen …“, Nachholen 50 Einträge in 445 ms (Abnahme r2).
- **EC-6** — unverändert seit Lauf 1.
- [x] **EC-7**: aufgebrauchtes Budget → `{"status":"error"}` für automatisch und manuell, kein Abruf, Zeilen unverändert; innerhalb der Abkühlzeit weder Abruf noch Budgetverbrauch (Abnahme + Security r2). Echtes 429 von Open-Meteo nicht provoziert (Code unverändert seit Lauf 1).
- **EC-8, EC-9, EC-10** — unverändert seit Lauf 1; `core.ts`/`open-meteo.ts` nicht im Diff.

## Security Audit Results
- [x] Authentication: Fang-Seite und Action ohne Cookie → `307 /login` (Security r2).
- [x] Authorization: siehe AC-19; `weather_fetch_log` für `authenticated` bei GET/POST/PATCH/DELETE `403 42501`, für `anon` `401`; RLS an, 0 Policies (Security r2).
- [x] Budget-Funktion `claim_weather_budget`: nur `auth.uid()`, kein Parameter für fremde Nutzer (Aufruf mit `p_user` → `404`), manipuliertes JWT → `401`; Randwerte 0/−1/51/null/±2³¹ → `false`, Nicht-Zahlen → `400`; `GET` → `405`; `SECURITY DEFINER` mit leerem `search_path`, alle Bezüge qualifiziert; `anon` ohne Ausführungsrecht (Security r2).
- [x] Advisory-Lock unter Last: 20 × 50 parallel → genau 4 × `true` (Summe 200); 40 × 7 parallel → genau 28 × `true` (Summe 196) (Security r2).
- [x] Input validation: `catchId` mit SQL-/PostgREST-Fragmenten, Zahlen, Arrays, Objekten, 10.000 Zeichen → `{"status":"error"}` (Security r2).
- [!] Rate limiting der Action allgemein: NOT VERIFIED — nicht umgesetzt (optional fürs MVP). Die Anfragen an Open-Meteo begrenzt jetzt das Budget (BUG-2 geschlossen).
- [!] Brute force, Enumeration, Massen-Registrierung: NOT VERIFIED — nicht anwendbar, PROJ-3 prüft keine Zugangsdaten; `src/lib/auth` und `src/proxy.ts` nicht im Diff.
- [x] Credentials in der URL: kein neues Formular; die Action läuft per POST (Security r2).
- [x] No secrets in the client bundle: Service-Role-, Secret- und JWT-Werte 0× in `.next/static` (Security r2).
- [x] Sensitive data in responses / Logs: Action liefert nur `{status}` bzw. `{status, filled, failed}`; im Dev-Log 0 Treffer für Test-IDs, Koordinaten, E-Mail-Adressen (Security r2).
- [x] CSRF: fremde `Origin` → `500` (Security r2).
- [x] Security headers (Stichprobe `/login`): alle vier vorhanden (Security r2).

## Regression
- [x] **PROJ-1:** Profil bei Registrierung, Umleitungen ohne Anmeldung (7 Adressen `307`, 4 öffentliche `200`), Login setzt Cookie, Angemeldete von `/login`/`/register` weg, Konto-Seite vollständig, Export `200` als Datei, Kontolöschung mit falschem Passwort abgelehnt und mit richtigem vollständig (inkl. `weather_fetch_log`), Logout löscht Cookie, fremde Daten `404`/`[]` (Regression r2).
- [x] **PROJ-2:** Session starten, Fang eintragen, Übersicht mit 20 + „Weitere laden“ (6 weitere, keine Überschneidung, keine Positionen, ungültiger Cursor abgelehnt), Detailansicht, Session löschen mit Kaskade, alle Formularseiten `200`, DB-Garantien live (`409 sessions_one_running_per_user`, `400 sessions_no_overlap`, `400 catch_outside_session`) und im Replay (Regression r2).
- [x] **BUG-1 geschlossen:** `session-list.test.tsx` 336 von 336 parallelen Läufen grün (vorher 1 Fehlschlag in 48); `session-list.tsx:51` entfernt die Warnung jetzt vor der Transition (Regression r2).

## E2E Tests
- Status: **not run** (run `/e2e-tests` for critical flows)

## Not Verified In This Run
- [!] Cross-Browser (Chrome / Firefox / Safari) und Layout bei 375 / 768 / 1440 px — kein Browser. (Der Build-Lauf hat Screenshots bei 375 px hell und dunkel gemacht; das ist kein QA-Beleg.)
- [!] Sichtbares Einblenden der Kacheln ohne Neuladen (AC-6), Umschalten des Hinweises beim Nachtragen (AC-18), Ein-/Ausblenden der Warnung bei „Weitere laden“ — belegt nur durch Unit-Tests und Code.
- [!] Die tatsächlich ausgehende Anfrage an Open-Meteo (AC-20) — nicht mitschneidbar; Code unverändert seit Lauf 1.
- [!] Echtes 429 / erschöpftes Kontingent bei Open-Meteo (EC-7) — nicht provoziert, um das Kontingent zu schonen; die Budget-Ablehnung wurde live geprüft.
- [!] Schließen der App mitten im Abruf (EC-4).
- [!] Rate limiting der Action allgemein — nicht umgesetzt (optional fürs MVP).
- [!] Features mit Status „Deployed“ — es gibt keine; geprüft wurden PROJ-1 und PROJ-2 (Approved).

## Bugs Found

### Aus Lauf 1
- **BUG-1 (High, Suite-Regel) — geschlossen.** Race in `SessionList`; Fix `session-list.tsx:51`; 336/336 parallele Läufe grün.
- **BUG-2 (Medium) — geschlossen.** Budget pro Nutzer (`claim_weather_budget`, 200 Einträge / 60 min, Sperre pro Nutzer) und bedingte Reservierung vor dem Abruf; parallele Aufrufe → ein Abruf; Zurücksetzen per REST verbraucht nur das eigene Budget und endet bei 200.
- **BUG-3 (Low) — geschlossen** für das automatische Nachholen (Fang an Platz 61 wird zuerst geholt). Der Knopf ist als BUG-7 neu erfasst.
- **BUG-4 (Low) — geschlossen ohne Änderung.** Die Lanes bestätigen: „Versuche es später erneut“ trifft in der Abkühlzeit zu.
- **BUG-5 (Low) — geschlossen ohne Änderung.** Die Lanes bestätigen: keine gehostete Datenbank mit Daten.

### Neu in diesem Lauf (alle Low)

#### BUG-6: Zweites Gerät sieht „Wetter wird abgerufen …“ bis zum Neuladen
- **Severity:** Low
- **Steps:** Fang `pending`, Gerät 1 hat reserviert und ruft ab; Gerät 2 öffnet die Fang-Seite.
- **Expected (AC-6):** Die Werte erscheinen ohne Neuladen. **Actual:** Die Action antwortet `filled:0` (Eintrag in der Abkühlzeit), der Refresh zeigt weiter „Wetter wird abgerufen …“; erst ein Neuladen zeigt die Werte. Neu durch die Reservierung; das Zeitfenster ist kurz.
- **Priority:** Nice to have

#### BUG-7: „Wetter erneut abrufen“ auf der Fang-Seite bevorzugt den eigenen Fang nicht
- **Severity:** Low
- **Steps:** Session mit mehr als 50 fälligen `failed`-Einträgen, Fang-Seite eines späten Fangs, Knopf tippen.
- **Actual:** `page.tsx:41` gibt dem Knopf keine `catchId`; der Versuch kann den geöffneten Fang auslassen (nur aus dem Code, nicht live provoziert).
- **Priority:** Nice to have

#### BUG-8: Budget ist „alles oder nichts“, der geöffnete Eintrag geht nicht vor
- **Severity:** Low
- **Steps:** Budget weitgehend verbraucht (z. B. 160/200), dann eine Session mit 50 fälligen Einträgen öffnen.
- **Actual:** `v_used + p_entries > 200 → false`; es wird gar nichts geholt, auch nicht der geöffnete Eintrag. Ein frisch gefangener Fisch kann so bis zu 60 min ohne Wetter bleiben (AC-9 holt es danach nach).
- **Priority:** Next sprint

#### BUG-9: Parallele Aufrufe verbrauchen Budget, ohne abzurufen
- **Severity:** Low
- **Steps:** Session mit fälligen Einträgen, 6 parallele Aufrufe.
- **Actual:** Das Budget wird vor der Reservierung belastet (`actions.ts:228` vor `:240`); +4 Einheiten für einen Abruf. Trifft nur das eigene Konto und verfällt nach 60 min.
- **Priority:** Next sprint (zusammen mit BUG-8)

#### BUG-10: Das Budget-Protokoll steht nicht im Datenexport
- **Severity:** Low
- **Steps:** `GET /account/export` nach Wetterabrufen.
- **Actual:** `weather_fetch_log` (Nutzerkennung, Anzahl, Zeitpunkt, höchstens 60 min gespeichert) fehlt im Export. `docs/data-model.md` nimmt es bewusst aus, wie das Protokoll der Login-Bremse; PROJ-1 AC-29 spricht aber von „allen zu ihm gespeicherten Daten“.
- **Einordnung:** Gleiche Behandlung wie das Login-Brems-Protokoll aus PROJ-1. Empfehlung: bei `/dsgvo` vor dem ersten gehosteten Betrieb bewerten, in `docs/privacy.md` als offener Punkt geführt.
- **Priority:** Next sprint

#### BUG-11: Restrisiko — kein Gesamtbudget über alle Konten
- **Severity:** Low (bewusste Designgrenze)
- **Actual:** Pro Konto höchstens 200 Einträge pro Stunde; mehrere Konten zusammen können das gemeinsame kostenlose Kontingent weiterhin erschöpfen (Registrierung: 5 Konten pro IP und Stunde mit Mail-Bestätigung). Möglicher Ausbau: zusätzliche Gesamtgrenze in `claim_weather_budget`.
- **Priority:** Vor einem öffentlichen Betrieb bewerten

### Außerdem festgehalten (kein Bug)
- Jede Reservierung und jedes Wetterschreiben setzt `updated_at` des Eintrags neu (PROJ-2-Trigger `set_updated_at`). Das Wetter ist Teil des Eintrags; verwandt mit BUG-5, keine Änderung.
- Eigene Wetterwerte sind über die Datenbank-Schnittstelle änderbar (bewusste Grenze aus `design.md`, wie PROJ-2 BUG-4).

## Summary
- **Acceptance Criteria:** 24/24 bestanden (13 in diesem Lauf neu ausgeübt, 11 unverändert seit Lauf 1 übernommen); Teile von AC-6, AC-18, AC-20 NOT VERIFIED (Browser bzw. Mitschnitt)
- **Edge Cases:** 10/10 bestanden (7 neu ausgeübt, 3 übernommen)
- **Bugs:** Lauf 1: 5 geschlossen (3 behoben, 2 ohne Änderung). Neu: 6 Low, 0 Critical/High/Medium
- **Security:** 11/13 Prüfungen belegt, 2 NOT VERIFIED (allgemeines Rate limiting — nicht umgesetzt; Brute force — nicht anwendbar)
- **Production Ready:** **YES** — keine Critical/High-Bugs offen.
- **Recommendation:** Approved. Die Low-Befunde BUG-6 bis BUG-11 in einem späteren `/refine PROJ-3` bündeln (Vorschlag: Budget in Teilen gewähren und den geöffneten Eintrag vorziehen, Knopf mit `catchId`, ein verzögerter zweiter Refresh). BUG-10 und BUG-11 vor dem ersten gehosteten Betrieb bei `/dsgvo` bzw. `/security-check` bewerten.

> „Production Ready: YES“ heißt *keine Critical/High-Bugs* — nicht, dass alles geprüft wurde. Die NOT-VERIFIED-Punkte oben bleiben offen und brauchen einen Menschen oder `/e2e-tests`.
