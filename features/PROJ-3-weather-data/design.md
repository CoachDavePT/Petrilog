# PROJ-3 — Technisches Design: Automatische Wetterdaten

> Das technische Design (das WIE) zu `spec.md`. Zwei Leser: du (zur Freigabe) und `/build` (baut direkt danach). Kein Code, aber so genau, dass niemand raten muss.
> Owner: `/architecture`. Der Vertrag (WAS) steht in `spec.md`, die Aufgabenliste später in `tasks.md`.
> Kein Status und kein Datum hier: Der Status lebt nur in `features/INDEX.md`.

## Überblick in einem Absatz

Das Wetter wird **direkt in den Tabellen `sessions` und `catches`** gespeichert, in eigenen Spalten mit dem Präfix `weather_` und einem Status (`pending`, `ok`, `failed`, `no_position`). Das Speichern einer Session oder eines Fangs bleibt genau so schnell wie in PROJ-2: Die Datenbank setzt beim Anlegen nur den Status auf „ausstehend“. Das eigentliche Holen übernimmt **eine neue Server Action „fehlendes Wetter holen“**, die die Detailansicht der Session und die Fang-Seite nach dem Laden von selbst aufrufen. Dieselbe Action steckt hinter „Wetter erneut abrufen“. Sie fragt Open-Meteo **vom Server aus** mit auf ~1 km gerundeten Koordinaten und schreibt das Ergebnis mit der Anmeldung des Nutzers, sodass Row Level Security ein zweites Mal prüft. Ein **Datenbank-Trigger** garantiert: Ändert sich die Zeit eines Eintrags oder wird seine Position entfernt, verschwindet das alte Wetter sofort. Eine verspätete Antwort für die alte Zeit wird verworfen, weil das Schreiben nur gelingt, wenn Zeit und Position noch dieselben sind. Neue Pakete, Umgebungsvariablen oder Einstellungen gibt es nicht.

## Seiten und Adressen

Keine neuen Adressen. PROJ-3 ergänzt bestehende Seiten aus PROJ-2:

| Adresse | Was dazukommt | → AC / EC |
|---|---|---|
| `/` Sessions-Übersicht | Kennzeichnung „ohne Wetter“ auf Session-Karten | AC-17 |
| `/sessions/[id]` Detailansicht | Abschnitt „Wetter beim Start“ (vor „Fänge“), automatisches Nachholen, kleines Wolken-Symbol an Fang-Karten ohne Wetter | AC-1–AC-11, AC-14, AC-16, AC-17, EC-1–EC-9 |
| `/sessions/[id]/catches/[catchId]` Fang bearbeiten | Abschnitt „Wetter beim Fang“ über dem Formular, automatisches Nachholen | AC-2, AC-12, AC-13, AC-15, AC-16 |
| `/sessions/backfill` | Info-Hinweis „Wetter von damals“, sobald der Positions-Schalter an ist | AC-18 |
| `/account/export` | Wetter pro Session und Fang, Export-Version 3 | AC-21 |
| `/privacy` | Abschnitt zum Wetterabruf | AC-24 |

## Komponenten-Struktur

```
/sessions/[id]  Detailansicht (PROJ-2)
+-- … Kopf, Kennzahlen, Position, Notiz (unverändert)
+-- WeatherSection „Wetter beim Start“                 ← neu, an der Stelle des Platzhalters, VOR „Fänge“
|   +-- Zustand ok:          WeatherGrid (6 Kacheln, 3 Spalten, Ton „data“/Lake)
|   |   +-- Luft · Luftdruck · Wind · Bewölkung · Niederschlag · Wetter
|   +-- Zustand ausstehend:  vertiefte Fläche, Wolken-Symbol, „Wetter wird abgerufen …“ (dezent pulsierend)
|   +-- Zustand fehlgeschlagen: vertiefte Fläche, Icon cloud-off, „Ohne Wetterdaten“,
|   |                           „Wetter konnte nicht abgerufen werden.“, Button „Wetter erneut abrufen“
|   +-- Zustand ohne Position: vertiefte Fläche, Icon cloud-off, „Ohne Wetterdaten“,
|                               „Ohne Position wird kein Wetter abgerufen.“ (kein Button)
+-- Fänge
|   +-- CatchCard (PROJ-2) + kleines cloud-off-Symbol mit Beschriftung „ohne Wetter“ für Screenreader,
|       wenn der Fang als ohne Wetter gilt (siehe „Wann gilt ein Eintrag als ohne Wetter“)
+-- WeatherAutoFill (unsichtbar, nur im Browser)       ← neu
    +-- ruft nach dem Laden einmal „fehlendes Wetter holen“ für diese Session auf, wenn etwas fehlt,
        und lädt danach die Seitendaten neu (ohne ganze Seite neu zu laden)

/sessions/[id]/catches/[catchId]  Fang bearbeiten (PROJ-2)
+-- WeatherSection „Wetter beim Fang“ (dieselben vier Zustände)  ← neu, über dem Formular
+-- WeatherAutoFill für die Session dieses Fangs                 ← neu
+-- CatchForm (unverändert)

/  Sessions-Übersicht (PROJ-2)
+-- SessionCard + „ohne Wetter“ mit cloud-off-Symbol in der Meta-Zeile (wie im Prototyp)

/sessions/backfill
+-- SessionBackfillForm + Info-Notice „Wetter von damals“ (nur bei eingeschaltetem Schalter)
```

**Neue Bausteine** (`src/components/weather/`):
- **WeatherGrid:** reine Anzeige der sechs Kacheln. Aufbau wie der Prototyp (`docs/Fangquote App.html` → WeatherGrid): Kachel mit Icon, Beschriftung, Wert, Einheit, Ton `data` (`surface-data`, Lake). Icons aus lucide: Thermometer, Gauge, Wind, Cloud, CloudRain und für „Wetter“ ein zur Wetterlage passendes Icon (Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning). Fehlt ein Wert, steht „–“ (EC-6).
- **WeatherSection:** Überschrift plus die vier Zustände oben. Wird auf dem Server gerendert, nur der Button ist ein Browser-Baustein.
- **RetryWeatherButton:** Browser-Baustein, ruft die Action auf, ist währenddessen gesperrt und zeigt „Wird abgerufen …“. Bleibt es beim Fehlschlag, erscheint direkt darunter die Warn-Notice „Wetter gerade nicht verfügbar. Versuche es später erneut.“ (AC-10).
- **WeatherAutoFill:** Browser-Baustein ohne eigene Anzeige, siehe „Nachholen“.
- **NoWeatherMarker:** cloud-off-Symbol in klein (Fangzeile) bzw. mit Text „ohne Wetter“ (Session-Karte).

Alles setzt sich aus vorhandenen shadcn-Komponenten zusammen (`card`, `button`, `alert`, `skeleton`). Nachgebaut wird nichts.

## Datenmodell

### Neue Spalten in `sessions` und `catches` (gleich in beiden Tabellen)

Die Session-Werte gelten für den **Start** (`started_at`), die Fang-Werte für die **Fangzeit** (`caught_at`). Das ist die „Bezugszeit“ des Eintrags.

- **weather_status**: Text, Pflicht, einer von:
  - `pending` — Position vorhanden, Wetter noch nicht geholt („Wetter wird abgerufen …“)
  - `ok` — Wetter gespeichert
  - `failed` — letzter Versuch fehlgeschlagen („Wetter konnte nicht abgerufen werden.“)
  - `no_position` — keine Position, es wird kein Wetter abgerufen
- **weather_requested_at**: Zeitpunkt mit Zeitzone, Pflicht. Wann der aktuelle Bedarf entstand: beim Anlegen, beim Ändern der Bezugszeit und beim Entfernen der Position. Wird nur vom Trigger gesetzt.
- **weather_attempted_at**: Zeitpunkt mit Zeitzone, optional. Wann zuletzt ein Abruf versucht wurde. Leer heißt „noch nie versucht“.
- **weather_hour**: Zeitpunkt mit Zeitzone, optional. Die volle Stunde, zu der die Werte gehören (AC-4).
- **weather_temperature_c**: Kommazahl mit 1 Nachkommastelle, −70,0 bis 60,0, optional.
- **weather_pressure_hpa**: Kommazahl mit 1 Nachkommastelle, 850,0 bis 1.100,0, optional. Luftdruck auf Meereshöhe.
- **weather_wind_speed_kmh**: Kommazahl mit 1 Nachkommastelle, 0 bis 500, optional. Wind in 10 m Höhe.
- **weather_wind_direction_deg**: ganze Zahl 0 bis 360, optional. Richtung, aus der der Wind kommt.
- **weather_cloud_cover_pct**: ganze Zahl 0 bis 100, optional.
- **weather_precipitation_mm**: Kommazahl mit 1 Nachkommastelle, 0 bis 1.000, optional. Summe der vorangehenden Stunde.
- **weather_code**: ganze Zahl 0 bis 99 (WMO-Wettercode), optional.
- **weather_fetched_at**: Zeitpunkt mit Zeitzone, optional. Wann die Werte geholt wurden.

**Regeln, die die Datenbank prüft:**
- `weather_status` = `no_position` genau dann, wenn keine Position gespeichert ist (Breite leer).
- `weather_status` = `ok` genau dann, wenn `weather_hour` und `weather_fetched_at` gesetzt sind.
- Ist der Status nicht `ok`, sind alle Werte-Spalten, `weather_hour` und `weather_fetched_at` leer.
- Bei `ok` darf jeder einzelne Wert leer sein (Open-Meteo lieferte ihn nicht, EC-6), aber nicht alle sieben zugleich. Ein Abruf ganz ohne Werte zählt als `failed`.
- Werte außerhalb der Spannen oben lehnt die Datenbank ab. Die App verwirft solche Einzelwerte vorher und speichert sie als leer, damit der Rest trotzdem gespeichert wird.

**Warum Spalten statt JSON:** Die spätere Auswertung („Fänge pro Angelstunde nach Luftdruck“) braucht Werte, die sich filtern, gruppieren und prüfen lassen. Spalten haben feste Typen und Grenzen in der Datenbank.

**Keine neue Tabelle, keine neue Entität:** Das Wetter ist eine Momentaufnahme des Eintrags. Es hängt an seiner Zeile, wird mit ihr gelöscht (AC-22, beim Konto automatisch über das Profil) und ist genau einmal vorhanden (EC-3).

### Wetter-Trigger (die Garantie für AC-7, AC-11–AC-13, EC-1, EC-2)

Je ein „vor dem Schreiben“-Trigger auf `sessions` und `catches`. Er entscheidet, was mit dem Wetter passiert, egal ob die App oder ein direkter Aufruf der Datenbank-Schnittstelle schreibt:

- **Beim Anlegen:** Alle Wetter-Spalten werden geleert (mitgeschickte Werte werden ignoriert). Status `no_position` ohne Position, sonst `pending`. `weather_requested_at` = jetzt, `weather_attempted_at` leer.
- **Beim Ändern, wenn sich die Bezugszeit ändert** (`started_at` bzw. `caught_at`) **oder die Position entfernt wird:** gleiches Zurücksetzen wie beim Anlegen (AC-11, AC-12, AC-13).
- **Bei jeder anderen Änderung** (Endzeit, Name, Notiz, Fangangaben, das Schreiben des Wetters selbst): Die Wetter-Spalten bleiben, wie sie geschrieben werden. Die Regeln oben gelten trotzdem.
- **Die Fänge einer Session sind vom Entfernen der Session-Position nicht betroffen.** Sie haben ihre eigene Kopie der Position und behalten ihr Wetter (AC-13).
- Die Trigger-Funktionen laufen mit den Rechten des Aufrufers und sind für `anon`/`authenticated` nicht direkt ausführbar, wie die Trigger aus PROJ-2.

### Bestehende Einträge (Migration)

- Einträge mit Position bekommen `pending` und `weather_requested_at` = Zeitpunkt der Migration. Sie werden beim nächsten Öffnen nachgeholt (AC-9).
- Einträge ohne Position bekommen `no_position`.
- Die Migration setzt die Werte direkt, ohne dass der Trigger dazwischenfunkt: erst Spalten und Werte, dann Regeln und Trigger.

### Indizes

- Keine neuen. Das Nachholen liest nur die Session und ihre Fänge über die vorhandenen Indizes „Kennung“ bzw. „Session + Fangzeit“.

### Zugriff (Row Level Security)

Unverändert aus PROJ-2: lesen, anlegen, ändern und löschen nur für eigene Zeilen, nicht angemeldete Aufrufer haben keine Rechte. Die Wetter-Spalten erben das (AC-19). Das Wetter schreibt die App **mit der Anmeldung des Nutzers**, nicht mit dem Server-Schlüssel.

**Bekannte Grenze (bewusst):** Wer die Datenbank-Schnittstelle direkt mit seinem eigenen Zugang aufruft, kann in **seine eigenen** Zeilen erfundene Wetterwerte schreiben. Fremde Daten sind davon nicht betroffen. Das entspricht der Entscheidung zu BUG-4 in PROJ-2: Wetter ist eine Angabe für den Nutzer selbst, keine Sicherheitsgrenze.

## Abläufe

### Wann gilt ein Eintrag als „ohne Wetter“ (AC-7, AC-8, AC-16, AC-17)

| Status | Detailansicht / Fang-Seite | Session-Karte / Fangzeile |
|---|---|---|
| `ok` | Kacheln | nichts |
| `pending` | „Wetter wird abgerufen …“, Nachholen läuft | nichts, solange `weather_requested_at` weniger als **5 Minuten** zurückliegt, danach „ohne Wetter“ |
| `failed` | „Ohne Wetterdaten“ + „Wetter konnte nicht abgerufen werden.“ + Button | „ohne Wetter“ |
| `no_position` | „Ohne Wetterdaten“ + „Ohne Position wird kein Wetter abgerufen.“ | „ohne Wetter“ |

Die 5 Minuten decken „Abruf läuft noch“ ab (AC-17). Ein Eintrag, der länger ausstehend bleibt (App direkt geschlossen, EC-4, oder Altbestand), ist für die Übersicht ehrlich „ohne Wetter“, bis er nachgeholt ist.

### Nachholen: die Server Action „fehlendes Wetter holen“ (AC-1–AC-3, AC-5, AC-6, AC-8–AC-10, EC-4, EC-5, EC-7)

**Eingabe:** Kennung der Session (UUID) und ob es ein Knopfdruck war (`manual`, ja/nein). Mehr nicht. Die Action wird für die Session **und alle ihre Fänge** ausgeführt.

1. **Anmeldung prüfen** (wie jede Action). Den Nutzer nimmt die Action aus der geprüften Anmeldung. Die Session wird mit „Kennung + Besitzer“ gelesen. Fremd oder gelöscht → Ergebnis „nichts zu tun“, kein Fehler, keine Aussage darüber, ob sie existiert (AC-19, EC-2).
2. **Kandidaten auswählen:** Session und Fänge mit Position und Status `pending` oder `failed`.
   - **Automatisch** (`manual` = nein): Einträge überspringen, deren `weather_attempted_at` weniger als **60 Sekunden** zurückliegt. Ein wiederholtes Neuladen löst also keine Anfrageflut aus (EC-7).
   - **Knopfdruck**: nur Einträge überspringen, deren letzter Versuch weniger als **10 Sekunden** zurückliegt.
   - **Höchstens 50 Einträge pro Aufruf**, zuerst die Session, dann die Fänge nach Fangzeit. Der Rest kommt beim nächsten Öffnen dran.
3. **Anfragen bündeln:** Für jeden Kandidaten wird bestimmt:
   - die **gerundete Position**: Breite und Länge auf 2 Nachkommastellen (AC-20)
   - die **volle Stunde**: die Bezugszeit auf die nächste volle Stunde gerundet, ab :30 aufwärts (AC-4). Gerechnet wird in UTC, das trifft wegen der ganzstündigen Zeitverschiebung von Europe/Berlin immer dieselbe Stunde (EC-8).
   Kandidaten mit gleicher gerundeter Position und gleichem Tag (UTC) teilen sich **eine** Anfrage. 40 Fänge von einem Angeltag an einem Ort sind so meist eine einzige Anfrage (EC-5).
4. **Open-Meteo fragen** (siehe „Anfrage an Open-Meteo“): höchstens **4 Anfragen gleichzeitig**, je höchstens **8 Sekunden**.
5. **Schreiben pro Eintrag, nur wenn sich nichts geändert hat** (EC-1, EC-2, EC-3): Die Action ändert die Zeile **nur, wenn** sie noch dem Nutzer gehört, die Bezugszeit noch dieselbe ist wie beim Lesen, die Position noch da ist und der Status noch `pending` oder `failed` ist.
   - **Erfolg:** Status `ok`, Werte, `weather_hour`, `weather_fetched_at`, `weather_attempted_at` = jetzt.
   - **Fehlschlag** (Zeitüberschreitung, Netzfehler, Antwort nicht 200, z. B. 429 bei erschöpftem Kontingent, keine Stunde passend, alle Werte leer): Status `failed`, `weather_attempted_at` = jetzt, Werte leer.
   - Trifft die Bedingung nicht mehr zu (Zeit geändert, gelöscht, Position entfernt, anderes Gerät war schneller), wird **nichts** geschrieben und nichts gemeldet.
6. **Ergebnis:** die Anzahl der Einträge, die jetzt `ok` sind, und ob einer davon fehlgeschlagen ist. Keine Wetterwerte und keine Positionen in der Antwort, die Seite liest sie beim Neuladen selbst.
7. **Nichts in Adressen oder Logs:** Fehler werden nur mit Art und HTTP-Status protokolliert, nie mit Koordinaten, Zeiten oder Kennungen.

### Automatisch nach dem Laden (WeatherAutoFill)

- Die Detailansicht und die Fang-Seite geben dem Baustein mit, ob in dieser Session **etwas mit Position fehlt** (Status `pending`, oder `failed` mit letztem Versuch vor mehr als 60 Sekunden). Nur dann ruft er die Action auf, **einmal pro Seitenaufruf**, sofort nach dem Laden.
- Danach lädt er die Seitendaten neu (Router-Refresh). Die Kacheln erscheinen ohne manuelles Neuladen (AC-6). Hat die Action nichts geändert, wird nicht neu geladen, also auch keine Schleife.
- **Speichern wartet nie** (AC-5): Die Actions aus PROJ-2 (Session starten, nachtragen, bearbeiten; Fang speichern, bearbeiten) bleiben unverändert und leiten wie bisher weiter. Erst die Seite, auf der man danach landet, holt das Wetter.
- **Scheitert der Aufruf selbst** (Handy ohne Verbindung): Der Abschnitt zeigt statt „Wetter wird abgerufen …“ „Ohne Wetterdaten“ mit „Wetter konnte nicht abgerufen werden.“ und dem Button. Gespeichert wird dabei nichts, der Eintrag bleibt `pending` und wird beim nächsten Öffnen erneut versucht.

### „Wetter erneut abrufen“ (AC-10)

Dieselbe Action mit `manual` = ja. Der Button ist gesperrt, solange sie läuft. Danach Router-Refresh. Ist der Eintrag danach noch `failed`, erscheint die Notice „Wetter gerade nicht verfügbar. Versuche es später erneut.“ im Warnton. Den Button gibt es nur bei `failed` bzw. bei gescheitertem Aufruf, nie bei `no_position` (AC-16).

### Anfrage an Open-Meteo (AC-3, AC-20, AC-23, EC-9, EC-10)

- **Nur vom Server** (AC-23). Das Modul ist als „nur Server“ markiert (`server-only`), sodass es nie im Browser landet. Der Browser des Nutzers spricht nie mit Open-Meteo, Open-Meteo sieht also weder seine IP-Adresse noch Cookies oder Kennungen.
- **Welcher Endpunkt:**
  - Stunde innerhalb der letzten **90 Tage** (oder in der nächsten Stunde): Vorhersage-API `https://api.open-meteo.com/v1/forecast`. Sie liefert über `start_hour`/`end_hour` auch vergangene Stunden bis 92 Tage zurück.
  - Älter: Historische API `https://archive-api.open-meteo.com/v1/archive` mit `start_date`/`end_date` (Tag der Stunde). Sie reicht bis 1940 zurück (EC-9).
- **Was mitgeschickt wird, und nur das:** `latitude` und `longitude` auf 2 Nachkommastellen, der Zeitraum, `hourly` = `temperature_2m, pressure_msl, wind_speed_10m, wind_direction_10m, cloud_cover, precipitation, weather_code`, `timezone=GMT` und die Einheiten `celsius`, `kmh`, `mm` (Standard). Kein API-Key, kein Nutzerbezug, kein Gewässername, keine Notiz (AC-20). Der User-Agent ist der Standard des Servers.
- **Zelle:** Standard-Zellenwahl von Open-Meteo. Auch für Positionen auf Bodden oder Ostsee kommt Wetter zurück (EC-10).
- **Stunde auswählen:** aus der Antwort genau die volle Stunde des Eintrags. Fehlt sie, gilt der Abruf als fehlgeschlagen.
- **Kein Zwischenspeicher** (Next-Cache aus), damit ein erneuter Versuch wirklich neu fragt.
- **Keine Wiederholung innerhalb der Action.** Wiederholt wird erst beim nächsten Öffnen bzw. auf Knopfdruck.

### Anzeige der Werte (AC-14, AC-15, EC-6)

| Kachel | Quelle | Format | Beispiel |
|---|---|---|---|
| Luft | `weather_temperature_c` | 1 Nachkommastelle, „°C“ | „11,4 °C“ |
| Luftdruck | `weather_pressure_hpa` | ganze Zahl, „hPa“ | „1018 hPa“ |
| Wind | `weather_wind_speed_kmh` + `weather_wind_direction_deg` | ganze Zahl, „km/h“, dazu Richtung aus 8 Sektoren: N, NO, O, SO, S, SW, W, NW (Grad ÷ 45 gerundet, 360° = N) | „14 km/h SW“ |
| Bewölkung | `weather_cloud_cover_pct` | ganze Zahl, „%“ | „60 %“ |
| Niederschlag | `weather_precipitation_mm` | 1 Nachkommastelle, „mm“ | „0,0 mm“ |
| Wetter | `weather_code` | deutscher Text, siehe unten | „Leicht bewölkt“ |

Fehlender Wert → „–“ ohne Einheit. Zahlen im deutschen Format. Der Luftdruck wird **ohne** Tausenderpunkt geschrieben („1018 hPa“), wie im Wetterbericht und im Prototyp.

**Wetterlage (WMO-Code → Text):** 0 Klar · 1 Überwiegend klar · 2 Leicht bewölkt · 3 Bewölkt · 45, 48 Nebel · 51, 53, 55 Nieselregen · 56, 57 Gefrierender Nieselregen · 61 Leichter Regen · 63 Regen · 65 Starker Regen · 66, 67 Gefrierender Regen · 71 Leichter Schneefall · 73 Schneefall · 75 Starker Schneefall · 77 Schneegriesel · 80, 81 Regenschauer · 82 Starke Regenschauer · 85, 86 Schneeschauer · 95 Gewitter · 96, 99 Gewitter mit Hagel · jeder andere Code → „–“.

Unter den Kacheln steht klein in `text-muted`: „Werte für 14:00 Uhr · Open-Meteo“ (die volle Stunde in Europe/Berlin, mit Datum, wenn sie auf einen anderen Tag fällt als die Bezugszeit). So ist ehrlich sichtbar, zu welcher Stunde die Werte gehören.

### Session-Übersicht und Fangzeile (AC-17)

- Die Übersicht (auch „Weitere laden“) liest zusätzlich `weather_status` und `weather_requested_at` der Session. **Keine Wetterwerte, keine Positionen.**
- Die Detailansicht liest für die Fänge dieselben Status-Spalten und für die Session alle Wetter-Spalten. Die Fang-Seite liest alle Wetter-Spalten des Fangs.
- Die Regel „als ohne Wetter anzeigen“ (Tabelle oben) ist **eine** gemeinsame Hilfsfunktion, damit Übersicht, Fangzeile und Detail nie auseinanderlaufen.

### Nachtragen (AC-18)

`SessionBackfillForm` zeigt, sobald der Schalter „Ich bin noch am Gewässer …“ an ist, die Info-Notice mit dem Titel „Wetter von damals“ und dem Text „Wir rufen die stündlichen Wetterdaten für diesen Zeitraum ab, soweit verfügbar.“

### Datenexport (AC-21)

`/account/export` bekommt **Version 3**. Jede Session und jeder Fang bekommt ein Objekt `weather`:
- `status` (`ok`, `pending`, `failed`, `no_position`)
- bei `ok` zusätzlich: `hour`, `temperature_c`, `pressure_hpa`, `wind_speed_kmh`, `wind_direction_deg`, `cloud_cover_pct`, `precipitation_mm`, `weather_code`, `weather_label` (deutscher Text) und `fetched_at`

`weather_requested_at` und `weather_attempted_at` sind interne Zustandsangaben ohne Aussagewert für den Nutzer und stehen nicht im Export.

### Datenschutzerklärung (AC-24)

Neuer Abschnitt „Wetterdaten“ auf `/privacy` (bleibt als Entwurf gekennzeichnet), Grundlage `docs/privacy.md`:
- Zu jeder Session (Start) und jedem Fang (Fangzeit) holt Petrilog das Wetter bei Open-Meteo.
- Übermittelt werden nur die auf etwa 1 km gerundete Position und der Zeitpunkt. Die Anfrage kommt vom Petrilog-Server, nicht von deinem Gerät, also ohne deine IP-Adresse und ohne dein Konto.
- Das Wetter wird mit dem Eintrag gespeichert, damit du später auswerten kannst, bei welchem Wetter du fängst. Es wird zusammen mit dem Eintrag gelöscht, und auch dann, wenn du die Position entfernst.

### Wer darf was (Zusammenfassung)

| Aktion | Wer | Abgelehnt / ohne Wirkung, wenn |
|---|---|---|
| Wetter lesen (Detail, Fang-Seite, Übersicht, Export) | angemeldeter Besitzer | nicht angemeldet, fremde oder gelöschte Kennung |
| Fehlendes Wetter holen (automatisch oder per Knopf) | angemeldeter Besitzer der Session | nicht angemeldet (→ Login), fremde oder gelöschte Session (still: nichts zu tun), Eintrag inzwischen geändert (still verworfen) |
| Wetter zurücksetzen | nur der Trigger, bei Zeitänderung oder entfernter Position | — |

## Wo die Teile liegen (für `/build`)

- **Migration** `supabase/migrations/<Zeitstempel>_weather.sql`: Wetter-Spalten in beiden Tabellen, Befüllen der vorhandenen Zeilen, Regeln, Trigger-Funktionen und Trigger. Die Migrationen aus PROJ-1 und PROJ-2 bleiben unverändert.
- **`src/lib/weather/`:**
  - reine Hilfen, gut testbar ohne Netz: Runden der Position, nächste volle Stunde, Bündeln, Wahl des Endpunkts, Auslesen der Antwort samt Grenzen, WMO-Text, Windrichtung, Formatierung der Kacheln, Regel „als ohne Wetter anzeigen“, alle deutschen Texte
  - Open-Meteo-Anfrage (`server-only`, 8 s Zeitgrenze, kein Cache)
  - Server Action „fehlendes Wetter holen“
- **`src/components/weather/`:** WeatherGrid, WeatherSection, RetryWeatherButton, WeatherAutoFill, NoWeatherMarker
- **Bestehende Dateien aus PROJ-2, die sich ändern:**
  - `src/lib/fishing/queries.ts`: zusätzliche Spalten in Übersicht, Detail, Fang
  - `src/app/(app)/sessions/[id]/page.tsx`: WeatherSection statt Platzhalter, vor „Fänge“, plus WeatherAutoFill
  - `src/app/(app)/sessions/[id]/catches/[catchId]/page.tsx`: WeatherSection + WeatherAutoFill
  - `src/components/fishing/session-card.tsx`, `catch-card.tsx`: NoWeatherMarker
  - `src/components/fishing/session-backfill-form.tsx`: Notice „Wetter von damals“
  - `src/app/(app)/(main)/account/export/route.ts`: Version 3
  - `src/app/privacy/page.tsx`: Abschnitt „Wetterdaten“
- **Die Actions aus PROJ-2 ändern sich nicht.** Das Zurücksetzen erledigt der Trigger. Die Actions fürs Bearbeiten und für „Position entfernen“ laden die betroffenen Seiten wie bisher neu.

## Abhängigkeiten (Pakete)

- **Keine neuen Pakete.** Die Anfrage läuft über das eingebaute `fetch` des Servers, `server-only` ist schon installiert, Icons kommen aus `lucide-react`.
- **Keine neuen Umgebungsvariablen:** Open-Meteo braucht keinen Key. Die beiden Adressen stehen als Konstanten im Code.

## Einstellungen, die du selbst machst

Keine.

## Technische Entscheidungen

| Entscheidung | Begründung | Alternative | Nachteil | Datum |
| --- | --- | --- | --- | --- |
| Wetter als eigene Spalten (`weather_…`) in `sessions` und `catches`, dazu ein Status | Die spätere Auswertung braucht filterbare, typgeprüfte Werte. Eine Momentaufnahme pro Eintrag ist genau eine Zeile, also gibt es nie Doppel (EC-3), und das Wetter wird automatisch mit dem Eintrag gelöscht (AC-22). | Ein JSON-Feld, oder eine eigene Tabelle `weather_snapshots` | 12 Spalten mehr pro Tabelle, jede neue Wettergröße ist eine Migration | 2026-09-30 |
| Das Wetter holt eine eigene Server Action, die die Detailansicht bzw. Fang-Seite nach dem Laden aufruft. Die Speicher-Actions aus PROJ-2 bleiben unverändert. | Speichern wartet garantiert nie (AC-5). Ein einziger Weg deckt Erstabruf, Nachholen, Altbestand und den Knopf ab. Wer die App direkt schließt, bekommt das Wetter beim nächsten Öffnen (EC-4). | Abruf nach der Antwort per `after()` in den Speicher-Actions | Wird die Seite nach dem Speichern nie geöffnet, bleibt das Wetter aus, bis sie geöffnet wird. Die Übersicht zeigt es dann nach 5 Minuten ehrlich als „ohne Wetter“. | 2026-09-30 |
| Garantie für AC-11–AC-13, EC-1, EC-2: Datenbank-Trigger setzt das Wetter bei Zeitänderung oder entfernter Position zurück. Das Schreiben des Wetters ist bedingt: nur bei unveränderter Bezugszeit, vorhandener Position und Status `pending`/`failed`. | Eine verspätete Antwort für die alte Zeit kann nie das neue Wetter überschreiben, auch bei zwei Geräten oder umgekehrter Reihenfolge. Gilt auch für Änderungen über die Datenbank-Schnittstelle. | Zurücksetzen in den Actions aus PROJ-2 | Etwas Logik in der Datenbank, wie schon die Fangzeit-Garantie | 2026-09-30 |
| Garantie für EC-3: bedingtes Schreiben nur bei Status `pending`/`failed` | Zwei Geräte, die gleichzeitig nachholen, schreiben höchstens einmal. Der zweite Versuch trifft auf `ok` und ändert nichts, ohne Fehler. | Letzter gewinnt | keiner | 2026-09-30 |
| Beim Anlegen ignoriert der Trigger mitgeschickte Wetterwerte | Einträge beginnen immer ohne Wetter. Nur der Abruf füllt es, so bleiben die Werte vergleichbar (Produktentscheidung „nicht von Hand änderbar“). | Werte beim Anlegen erlauben | Direkte Änderungen an eigenen Zeilen über die Datenbank-Schnittstelle bleiben möglich (bewusst, wie BUG-4) | 2026-09-30 |
| Positionen auf 2 Nachkommastellen gerundet, Anfrage nur vom Server (`server-only`) | AC-20, AC-23: Open-Meteo erfährt weder den genauen Spot noch IP-Adresse oder Konto des Nutzers. Das Raster von Open-Meteo ist gröber als 1 km, das Wetter wird nicht schlechter. | Anfrage direkt aus dem Browser | Jeder Abruf läuft über den Next.js-Server | 2026-09-30 |
| Vorhersage-API für die letzten 90 Tage, historische API für ältere Zeiten | Die Vorhersage-API liefert frische vergangene Stunden sofort, die historische hat einige Tage Verzögerung, reicht aber bis 1940 zurück (EC-9). | Nur die historische API | Zwei Endpunkte; die Werte stammen je nach Alter aus unterschiedlichen Modellen | 2026-09-30 |
| Nächste volle Stunde in UTC, Anfrage mit `timezone=GMT` | Keine Verwechslung an Zeitumstellungen (EC-8). Europe/Berlin hat nur ganzstündige Verschiebungen, die gerundete Stunde ist also dieselbe. | Anfrage in Ortszeit | keiner | 2026-09-30 |
| Bündeln nach gerundeter Position und Tag, höchstens 4 parallel, 8 s pro Anfrage, höchstens 50 Einträge pro Aufruf | Eine Session mit 40 Fängen am selben Ort ist meist eine Anfrage (EC-5). Das schont das kostenlose Kontingent. Die Seite erscheint trotzdem sofort, weil der Abruf erst danach läuft. | Eine Anfrage pro Eintrag | Mehr als 50 fehlende Einträge brauchen ein zweites Öffnen | 2026-09-30 |
| Abkühlzeit 60 s automatisch, 10 s per Knopf, gemessen an `weather_attempted_at` in der Datenbank | Neuladen oder Tippen in Serie löst keine Anfrageflut aus, auch nicht bei erschöpftem Kontingent (EC-7). Die Grenze steht in der Datenbank, gilt also auch über Geräte hinweg. | Keine Grenze, oder ein eigener Zähler pro Nutzer | Wer direkt nach einem Fehlschlag neu lädt, sieht 60 s lang noch „ohne Wetterdaten“ | 2026-09-30 |
| „ohne Wetter“ in der Übersicht erst, wenn ein ausstehender Abruf älter als 5 Minuten ist | AC-17: Während des Abrufs keine Kennzeichnung, ein liegengebliebener Eintrag erscheint aber ehrlich als ohne Wetter | Ausstehend nie kennzeichnen | Die Kennzeichnung kann bis zu 5 Minuten nachhinken | 2026-09-30 |
| Keine Wiederholung innerhalb einer Action, kein Cache | Einfach, und die Seite hängt nie an einem langsamen Dienst. Wiederholt wird beim Öffnen oder per Knopf. | Automatische Wiederholung mit Wartezeit | keiner | 2026-09-30 |
| Unplausible Einzelwerte werden verworfen („–“), der Rest wird gespeichert; ganz leere Antworten zählen als Fehlschlag | EC-6: Ein fehlender Wert kostet nicht das ganze Wetter. Die Datenbank-Grenzen fangen Unsinn ab. | Ganze Antwort verwerfen | keiner | 2026-09-30 |
| Export-Version 3 mit `weather`-Objekt je Session und Fang, ohne interne Zeitstempel | AC-21: vollständig und maschinenlesbar. Die Version zeigt die Änderung an. | Wetter-Spalten flach übernehmen | keiner | 2026-09-30 |

## Offene Fragen

- keine technischen. Die rechtliche Einordnung von Open-Meteo steht in `spec.md` → Offene Fragen.

## Umsetzungsnotizen (`/build`, 2026-09-30)

- **Migration** `20260930160000_weather.sql`: Der Trigger heißt `reset_weather` und hängt als `sessions_reset_weather` bzw. `catches_reset_weather` an beiden Tabellen. Zusätzlich zur Bezugszeit setzt er auch zurück, wenn sich Breite oder Länge **irgendwie** ändern (nicht nur beim Entfernen). So bleibt die Regel „Status ↔ Position“ auch bei direkten Änderungen über die Datenbank-Schnittstelle erfüllt.
- **WeatherAutoFill lädt nach jeder erfolgreichen Antwort neu**, nicht nur, wenn etwas geschrieben wurde. Grund: Hat ein anderes Gerät das Wetter gerade geholt, schreibt dieser Aufruf nichts, die Seite soll aber trotzdem die Kacheln zeigen statt „Wetter wird abgerufen …“. Eine Schleife entsteht nicht, weil der Baustein pro Seitenaufruf genau einmal läuft (auch unter React StrictMode).
- **Uhrzeit für „ohne Wetter“:** Session-Karte und Fang-Karte bekommen die Uhrzeit als Prop (`now`). Die Übersicht gibt die Server-Uhr an die Liste weiter, die Detailansicht ihre eigene Server-Uhr. So bleiben die Karten frei von unreinen Aufrufen beim Rendern.
- **Kacheln:** Beschriftungen dürfen getrennt werden (`hyphens-auto`, Seite ist `lang="de"`). Bei 375 px wird „Niederschlag“ zu „Nieder-schlag“ statt mitten im Wort umzubrechen.
- **„Wetter erneut abrufen“** zeigt die Warnung auch dann, wenn nur ein anderer Eintrag der Session weiter fehlschlägt. Das ist die einfache Lesart von „noch fehlgeschlagen“ auf Session-Ebene.
- **Live geprüft** gegen die lokale Supabase und das echte Open-Meteo, 20 Prüfungen mit zwei Nutzern: Speichern ohne Warten (unter 1 s bis zur Detailseite), Wetter erscheint ohne Neuladen, nächste volle Stunde, Fang-Wetter, Zeitänderung verwirft und holt neu (Session und Fang), Session von 2019 aus dem Archiv, Position entfernen, fehlgeschlagen mit Abkühlzeit und Knopf, Kennzeichnung in der Übersicht, Hinweis beim Nachtragen, Export Version 3, Datenschutzerklärung, fremder Nutzer. Dazu Screenshots bei 375 px, hell und dunkel.
- **Dev-Server:** Während der Live-Prüfung meldete der laufende Dev-Server einen internen Absturz („Jest worker encountered 2 child process exceptions“) und antwortete danach mit 500. Nach einem Neustart sollte das weg sein. Die letzte Prüfung lief deshalb gegen einen Produktions-Build (`next build` + `next start` auf Port 3554). `next build` läuft fehlerfrei durch.
