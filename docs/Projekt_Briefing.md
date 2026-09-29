# Produkt: Fangquote (Arbeitstitel)

## Kurzbeschreibung
Fangquote ist ein digitales Fangbuch für Angler, das Fänge, Angelzeit,
Fangort (GPS) und Wetter speichert. Weil nicht nur Fänge, sondern auch die
tatsächliche Angelzeit erfasst wird, entsteht die Grundlage für ehrliche
Auswertungen: Fänge pro Angelstunde statt nur absoluter Fangzahlen.

## Problem
Klassische Fangbücher und Fangmeldungen speichern nur Fänge oder bestenfalls
Angeltage. Wer immer abends angelt, fängt zwangsläufig die meisten Fische
abends – das sagt nichts darüber aus, ob der Abend wirklich die beste Zeit ist.
Fangorte und Wetterdaten werden selten oder ungenau notiert, weil man am
Wasser keine Zeit dafür hat.

## Zielgruppe
- Hobbyangler in Deutschland (Süßwasser, Küste, Bodden), mobil am Wasser
- Angler, die ihre Erfolge verbessern wollen und ihre Spots privat halten möchten
- Nutzung überwiegend am Smartphone, oft mit einer Hand und unter Zeitdruck

## Kernidee
- Eine "Session" ist ein Angelausflug mit Start, Ende und GPS-Position.
- Fänge gehören immer zu einer Session und haben eine eigene GPS-Position.
- Wetterdaten werden automatisch zur Position und Uhrzeit abgerufen und gespeichert.
- Grundlage für spätere Auswertungen: Fänge pro Angelstunde (Catch per Unit Effort).

## Feature-Map (Umfang dieses Projekts: 3 Features)

### F1 – Registrierung & Login
- Registrierung und Login mit E-Mail und Passwort über Supabase Auth
- Logout
- Nur angemeldete Nutzer sehen den App-Bereich; nicht angemeldete Nutzer
  werden zum Login umgeleitet
- Row Level Security: Jeder Nutzer sieht und bearbeitet ausschließlich
  seine eigenen Sessions und Fänge

### F2 – Automatische Wetterdaten (externe Integration: Open-Meteo)
- Beim Start einer Session und bei jedem Fang werden Wetterdaten zur
  Position und Uhrzeit von Open-Meteo abgerufen (öffentliche API, kein Key)
- Gespeichert werden: Lufttemperatur, Luftdruck, Windgeschwindigkeit,
  Windrichtung, Bewölkung, Niederschlag, Wettercode
- Bei nachträglich eingetragenen Sessions/Fängen werden die stündlichen
  Wetterdaten für den vergangenen Zeitpunkt abgerufen, soweit Open-Meteo sie liefert
- Ist die API nicht erreichbar oder liefert keine Daten, wird der Eintrag
  trotzdem gespeichert und als "ohne Wetterdaten" gekennzeichnet
- Ohne Position werden keine Wetterdaten abgerufen
- Wetterdaten werden in der Session- bzw. Fang-Detailansicht angezeigt

### F3 – Sessions & Fänge erfassen (Kernnutzen)
- Session starten: Startzeit automatisch, GPS-Position über die
  Geolocation-API des Browsers, optional Gewässername und Notiz
- Session beenden: Endzeit wird gespeichert, Dauer wird angezeigt
- Nur eine aktive Session gleichzeitig pro Nutzer
- Session nachträglich anlegen mit manueller Start- und Endzeit
  (Ende muss nach Start liegen)
- Fang zur aktiven oder einer vergangenen Session hinzufügen:
  Uhrzeit (Standard: jetzt), Fischart (Auswahlliste gängiger Arten + "Sonstige"),
  Länge in cm, optional Gewicht in g, Köder, entnommen oder zurückgesetzt
- Fangzeit muss innerhalb der Session liegen
- Bei Fängen in einer aktiven Session wird die aktuelle GPS-Position
  inklusive Genauigkeit automatisch gespeichert
- Bei nachträglich eingetragenen Fängen oder verweigerter GPS-Freigabe wird
  die Position der Session übernommen (falls vorhanden)
- Fänge bearbeiten und löschen
- Übersicht aller Sessions (neueste zuerst) mit Datum, Dauer, Anzahl Fänge
- Detailansicht einer Session mit allen Fängen, Koordinaten und Wetterdaten

## Geplant, aber NICHT Teil dieser Version (nur zur Information)
Die folgenden Punkte werden in diesem Projekt nicht umgesetzt, nicht
spezifiziert und nicht in features/INDEX.md aufgenommen.

### Kartendarstellung der Fangorte (nächstes geplantes Feature)
- Karte auf Basis von OpenStreetMap (Leaflet) mit allen eigenen Fängen als Marker
- Filter nach Fischart, Marker-Details mit Link zur Session
- Position von Sessions und Fängen per Tippen auf die Karte setzen oder korrigieren
  (wichtig für nachträglich eingetragene Fänge)
- Gewässername-Vorschlag über Nominatim (OpenStreetMap)

### Weitere Roadmap
- Statistik "Fänge pro Angelstunde" nach Uhrzeit, Luftdruck, Wind,
  Mondphase, Köder und Ort, inkl. Hinweis bei zu wenig Daten
- Mondphase (lokal berechnet), Wassertemperatur Küste (Open-Meteo Marine),
  Pegelstände (PEGELONLINE)
- Offline-Modus mit späterer Synchronisation
- Fotos zu Fängen
- Export einer fertigen Fangmeldung (Fänge + Angeltage/-stunden) für
  Vereine und Gewässerbewirtschafter
- Vereinsfunktionen: Rollen (Mitglied, Gewässerwart, Vorstand),
  Vereinsgewässer, Vereinsstatistik mit Aufwand in Angelstunden
- Mögliche Anbindung an Angelkarten-Anbieter, sofern diese eine
  Schnittstelle anbieten
- Teilen von Fängen, Community-Funktionen
- Bezahlmodell

## Nicht-funktionale Anforderungen
- Mobile-first, bedienbar auf dem Smartphone am Wasser
- Oberfläche auf Deutsch, Einheiten metrisch (cm, g, °C, hPa, km/h)
- GPS-Daten sind privat und nur für den jeweiligen Nutzer sichtbar
- Keine Secrets im Repository; Supabase-Zugangsdaten nur über .env,
  eine .env.example mit Platzhaltern liegt im Repo
- Kostenlose Dienste: Supabase Free Plan, Open-Meteo ohne API-Key
- Kein Deployment erforderlich, lokal lauffähig

## Grobes Datenmodell
- sessions: id, user_id, started_at, ended_at, latitude, longitude,
  water_name, note, weather (JSON oder eigene Spalten), created_at
- catches: id, session_id, user_id, caught_at, species, length_cm,
  weight_g, bait, released, latitude, longitude, gps_accuracy_m,
  weather, created_at
- RLS auf beiden Tabellen: Zugriff nur, wenn user_id = auth.uid()
- Das Datenmodell ist so angelegt, dass die geplante Karte später ohne
  Änderungen an den Tabellen ergänzt werden kann

## Erfolgskriterien
- Ein neuer Nutzer kann sich registrieren, eine Session starten, einen Fang
  eintragen und sieht anschließend Session und Fang inklusive
  GPS-Koordinaten und Wetterdaten
- Ein zweiter Nutzer sieht keine Daten des ersten Nutzers