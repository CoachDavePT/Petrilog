# PROJ-3 Aufgaben: Automatische Wetterdaten

> Erzeugt von `/tasks` aus `spec.md` und `design.md`. Das ist der geordnete, nachverfolgbare Bauplan zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallel ausführbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also an einen eigenen Sub-Agenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC- bzw. EC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Aufgabe → Test.
> Owner: `/tasks` legt diese Datei an, `/build` hakt ab.
> Kein Statusfeld hier: Die Häkchen sind der Fortschritt, der Status des Features lebt nur in `features/INDEX.md`.
> `[user]`-Aufgaben gibt es in PROJ-3 nicht (`design.md` → „Einstellungen, die du selbst machst“: keine).

**Feste Namen, damit parallel gebaute Aufgaben zusammenpassen:**
- **Spalten** (gleich in `sessions` und `catches`): `weather_status`, `weather_requested_at`, `weather_attempted_at`, `weather_hour`, `weather_temperature_c`, `weather_pressure_hpa`, `weather_wind_speed_kmh`, `weather_wind_direction_deg`, `weather_cloud_cover_pct`, `weather_precipitation_mm`, `weather_code`, `weather_fetched_at`.
- **Status-Werte:** `pending`, `ok`, `failed`, `no_position`.
- **Typen** (T2, `src/lib/weather/types.ts`):
  - `WeatherStatus`: die vier Status-Werte
  - `WeatherValues`: `temperatureC`, `pressureHpa`, `windSpeedKmh`, `windDirectionDeg`, `cloudCoverPct`, `precipitationMm`, `weatherCode`, jeweils Zahl oder `null`
  - `WeatherSnapshot`: `{ status, hour, values, fetchedAt }` (`hour`/`fetchedAt` als ISO-Text oder `null`, `values` bei `ok` gesetzt, sonst `null`)
  - `WeatherState`: `{ status, requestedAt, attemptedAt }` (ISO-Texte) für Kennzeichnung und Nachholen
- **Server Action** (T7, `src/lib/weather/actions.ts`): `fillMissingWeather({ sessionId, manual })` → `{ status: 'ok', filled: number, failed: boolean }` bzw. `{ status: 'error' }`.
- **Regel „als ohne Wetter anzeigen“** (T3): `isWithoutWeather(state, now)`, die 5-Minuten-Grenze für `pending` als Konstante. Die Regel „automatisch nachholen?“ als `needsAutoFill(state, now)`: `pending`, oder `failed` mit letztem Versuch vor mehr als 60 s.
- **Texte** (T3, `src/lib/weather/messages.ts`): „Wetter beim Start“, „Wetter beim Fang“, „Wetter wird abgerufen …“, „Ohne Wetterdaten“, „Wetter konnte nicht abgerufen werden.“, „Ohne Position wird kein Wetter abgerufen.“, „Wetter erneut abrufen“, „Wetter gerade nicht verfügbar. Versuche es später erneut.“, „ohne Wetter“, „Wetter von damals“ + „Wir rufen die stündlichen Wetterdaten für diesen Zeitraum ab, soweit verfügbar.“

## Ebene 1: Datenbank und Kern

- [x] T1 [P]  Migration Wetter: die 12 Spalten in `sessions` und `catches` mit Typen und Grenzen aus `design.md`, Befüllen der vorhandenen Zeilen (`pending` mit Position, sonst `no_position`), Prüfregeln (Status ↔ Position, `ok` ↔ Stunde + Abrufzeit, Werte nur bei `ok`, bei `ok` nicht alle Werte leer), Trigger „vor dem Schreiben“ auf beiden Tabellen (Anlegen: Wetter leeren, Status setzen; Zeitänderung oder entfernte Position: zurücksetzen; sonst unverändert), Funktionen nicht direkt ausführbar für `anon`/`authenticated`. Danach gegen die lokale Datenbank prüfen: Anlegen mit mitgeschicktem Wetter, Zeitänderung, Position entfernen, bedingtes Schreiben nach Zeitänderung (0 Zeilen), fremder Nutzer, Session-Position entfernen lässt Fänge unberührt  · files: supabase/migrations/20260930160000_weather.sql  · → AC-7, AC-11, AC-12, AC-13, AC-19, AC-22, EC-1, EC-2, EC-3
- [x] T2 [P]  Wetter-Kern (reine Funktionen) mit Typen: Position auf 2 Nachkommastellen runden, nächste volle Stunde in UTC (ab :30 aufwärts), Endpunkt wählen (≤ 90 Tage Vorhersage-API, älter historische API), Kandidaten nach gerundeter Position + UTC-Tag bündeln, Antwort von Open-Meteo auslesen (genau die Stunde, Einzelwerte außerhalb der Grenzen → `null`, alle leer → Fehlschlag), WMO-Code → deutscher Text und Icon-Name, Windrichtung → 8 Sektoren; Unit-Tests  · files: src/lib/weather/types.ts, src/lib/weather/core.ts, src/lib/weather/core.test.ts  · → AC-3, AC-4, AC-14, AC-20, EC-5, EC-6, EC-8, EC-9

## Ebene 2: Server-Grundlagen

- [x] T3 [P]  Anzeige-Helfer und Texte: Kachelwerte im deutschen Format (11,4 °C · 1018 hPa ohne Tausenderpunkt · 14 km/h SW · 60 % · 0,0 mm · Wetterlage), „–“ für fehlende Werte, Zeile „Werte für 14:00 Uhr · Open-Meteo“ in Europe/Berlin (mit Datum bei anderem Tag), `isWithoutWeather`, `needsAutoFill`, alle Texte aus „Feste Namen“; Unit-Tests  · files: src/lib/weather/format.ts, src/lib/weather/format.test.ts, src/lib/weather/messages.ts  · → AC-6, AC-7, AC-8, AC-10, AC-14, AC-16, AC-17, EC-6
- [x] T4 [P]  Open-Meteo-Anfrage (`server-only`): Adresse je Endpunkt mit genau den Parametern aus `design.md` (gerundete Koordinaten, Zeitraum, 7 Stundenwerte, `timezone=GMT`), 8 s Zeitgrenze, kein Cache, Ergebnis „Antwort“ oder „Fehlschlag“ (Zeitüberschreitung, Netz, Status ≠ 200 inkl. 429, kaputte Antwort), Protokoll nur mit Art und HTTP-Status; Unit-Tests mit nachgebildetem `fetch` (prüfen u. a., dass nie mehr als 2 Nachkommastellen und keine weiteren Parameter gesendet werden)  · files: src/lib/weather/open-meteo.ts, src/lib/weather/open-meteo.test.ts  · → AC-3, AC-8, AC-20, AC-23, EC-7, EC-9, EC-10
- [x] T5 [P]  Lesefunktionen erweitern: Übersicht (und „Weitere laden“) liest `weather_status` + `weather_requested_at` der Session, Detail liest alle Wetter-Spalten der Session und für die Fänge `weather_status`/`weather_requested_at`/`weather_attempted_at`, Fang-Seite liest alle Wetter-Spalten des Fangs; Rückgabe als `WeatherSnapshot`/`WeatherState`; nie Wetterwerte in der Übersicht; Tests anpassen  · files: src/lib/fishing/queries.ts, src/lib/fishing/queries.test.ts  · → AC-14, AC-15, AC-17
- [x] T6 [P]  Datenexport Version 3 (`weather`-Objekt je Session und Fang: `status`, bei `ok` Stunde, sieben Werte, `weather_label`, `fetched_at`; keine internen Zeitstempel) und Abschnitt „Wetterdaten“ in der Datenschutzerklärung (Open-Meteo als Empfänger, gerundete Position und Zeitpunkt, vom Server ohne IP-Adresse und Konto, Zweck, Löschung mit dem Eintrag und beim Entfernen der Position); Tests des Exports anpassen  · files: src/app/(app)/(main)/account/export/route.ts, src/app/(app)/(main)/account/export/route.test.ts, src/app/privacy/page.tsx  · → AC-21, AC-24

## Ebene 3: Nachholen und Anzeige-Bausteine

- [x] T7 [P]  Server Action `fillMissingWeather`: Anmeldung prüfen, Session mit „Kennung + Besitzer“ lesen (fremd oder gelöscht → still „nichts zu tun“), Kandidaten mit Position und `pending`/`failed` (Abkühlzeit 60 s automatisch, 10 s per Knopf, höchstens 50, Session zuerst), bündeln, höchstens 4 Anfragen gleichzeitig, bedingtes Schreiben pro Eintrag (gleiche Bezugszeit, Position vorhanden, Status `pending`/`failed`; Erfolg → `ok` + Werte, Fehlschlag → `failed`), Schreiben mit der Anmeldung des Nutzers, Ergebnis ohne Werte und Positionen; Unit-Tests mit nachgebildetem Supabase und Open-Meteo  · files: src/lib/weather/actions.ts, src/lib/weather/actions.test.ts  · → AC-1, AC-2, AC-3, AC-5, AC-8, AC-9, AC-10, AC-19, AC-20, AC-23, EC-1, EC-2, EC-3, EC-4, EC-5, EC-7
- [x] T8 [P]  Anzeige-Bausteine: WeatherGrid (6 Kacheln, 3 Spalten, Ton `data`/Lake, Icons, „–“), WeatherSection (Überschrift + Zustände ok / ausstehend / fehlgeschlagen / ohne Position, Platz für den Button, der nur bei `failed` erscheint), NoWeatherMarker (klein für die Fangzeile, mit Text „ohne Wetter“ für die Session-Karte, Screenreader-Text); Komponententests  · files: src/components/weather/weather-grid.tsx, src/components/weather/weather-section.tsx, src/components/weather/no-weather-marker.tsx, src/components/weather/weather-section.test.tsx  · → AC-7, AC-8, AC-14, AC-15, AC-16, AC-17, EC-6

## Ebene 4: Browser-Bausteine und Kennzeichnung

- [x] T9 [P]  RetryWeatherButton (ruft `fillMissingWeather` mit `manual`, gesperrt mit „Wird abgerufen …“, danach Router-Refresh, bei weiterhin `failed` Warn-Notice) und WeatherAutoFill (einmal pro Seitenaufruf, nur wenn gemeldet wird, dass etwas fehlt; danach Router-Refresh nur, wenn etwas gefüllt wurde; bei gescheitertem Aufruf Zustand „fehlgeschlagen“ mit Button für den Abschnitt); Komponententests  · files: src/components/weather/retry-weather-button.tsx, src/components/weather/weather-auto-fill.tsx, src/components/weather/weather-auto-fill.test.tsx  · → AC-6, AC-9, AC-10, EC-4
- [x] T10 [P]  Kennzeichnung und Nachtragen: Session-Karte zeigt „ohne Wetter“ (NoWeatherMarker, Regel `isWithoutWeather`), Fang-Karte das kleine Symbol, Formular „Session nachtragen“ zeigt bei eingeschaltetem Schalter die Info-Notice „Wetter von damals“; bestehende Tests anpassen  · files: src/components/fishing/session-card.tsx, src/components/fishing/catch-card.tsx, src/components/fishing/session-backfill-form.tsx, src/components/fishing/session-forms.test.tsx  · → AC-17, AC-18

## Ebene 5: Seiten verdrahten

- [ ] T11  Detailansicht: WeatherSection „Wetter beim Start“ an der Stelle des Platzhalters, vor „Fänge“, mit RetryWeatherButton und WeatherAutoFill (meldet, ob Session oder ein Fang nachgeholt werden muss); Fang-Seite: WeatherSection „Wetter beim Fang“ über dem Formular, WeatherAutoFill für die Session des Fangs. Danach live gegen die lokale Supabase und Open-Meteo prüfen: Session starten, Fang speichern, nachtragen (auch Jahre zurück), Zeit ändern, Position entfernen, Open-Meteo nicht erreichbar, zweiter Nutzer  · files: src/app/(app)/sessions/[id]/page.tsx, src/app/(app)/sessions/[id]/catches/[catchId]/page.tsx  · → AC-1, AC-2, AC-5, AC-6, AC-9, AC-14, AC-15, AC-16

## Abdeckung

Jedes AC und jeder EC aus `spec.md` hat mindestens eine Aufgabe:

| ID | Aufgaben | ID | Aufgaben |
|---|---|---|---|
| AC-1 | T7, T11 | AC-13 | T1 |
| AC-2 | T7, T11 | AC-14 | T2, T3, T5, T8, T11 |
| AC-3 | T2, T4, T7 | AC-15 | T5, T8, T11 |
| AC-4 | T2 | AC-16 | T3, T8, T11 |
| AC-5 | T7, T11 | AC-17 | T3, T5, T8, T10 |
| AC-6 | T3, T9, T11 | AC-18 | T10 |
| AC-7 | T1, T3, T8 | AC-19 | T1, T7 |
| AC-8 | T3, T4, T7, T8 | AC-20 | T2, T4, T7 |
| AC-9 | T7, T9, T11 | AC-21 | T6 |
| AC-10 | T3, T7, T9 | AC-22 | T1 |
| AC-11 | T1 | AC-23 | T4, T7 |
| AC-12 | T1 | AC-24 | T6 |
| EC-1 | T1, T7 | EC-6 | T2, T3, T8 |
| EC-2 | T1, T7 | EC-7 | T4, T7 |
| EC-3 | T1, T7 | EC-8 | T2 |
| EC-4 | T7, T9 | EC-9 | T2, T4 |
| EC-5 | T2, T7 | EC-10 | T4 |

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene beginnt erst, wenn die vorige vollständig eingebaut und gegen ihre AC-IDs geprüft ist.
- **`[P]` nur bei getrennten Dateien.** Keine zwei `[P]`-Aufgaben einer Ebene nennen dieselbe Datei. Geprüft: Ebene 1 (Migration | `lib/weather` Kern), Ebene 2 (`format`/`messages` | `open-meteo` | `fishing/queries` | Export + Datenschutz), Ebene 3 (`actions` | `components/weather` Anzeige), Ebene 4 (`components/weather` Browser | `components/fishing`).
- **Grob, nicht kleinteilig**, und keine Aufgabe über einen Sub-Agenten-Kontext hinaus: eine Sache, höchstens etwa fünf Dateien.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Sub-Agenten. Der Haupt-Agent baut zusammen, prüft gegen die AC-IDs der Ebene und hakt hier ab. Sub-Agenten erklären sich nie selbst für fertig.
