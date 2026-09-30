# Product Requirements Document — Petrilog

## Vision
Petrilog ist ein digitales Fangbuch für Angler. Es speichert Fänge zusammen mit der tatsächlichen Angelzeit, dem Fangort (GPS) und dem Wetter. Weil die Angelzeit mit erfasst wird, lassen sich Fänge später ehrlich auswerten: als Fänge pro Angelstunde (Catch per Unit Effort) statt als bloße Fangzahlen. Die Erfassung ist so schnell, dass sie am Wasser mit einer Hand gelingt.

## Zielgruppe
- **Hobbyangler in Deutschland** (Süßwasser, Küste, Bodden), die am Wasser mit dem Smartphone unterwegs sind, oft mit nur einer freien Hand und unter Zeitdruck.
- **Angler, die ihren Erfolg verbessern wollen:** Sie möchten wissen, was wirklich funktioniert, statt Zufallsmuster zu sehen („abends fange ich am meisten“, weil sie immer abends angeln).
- **Angler, die ihre Spots privat halten:** GPS-Positionen sind ein Geheimnis und dürfen nur für sie selbst sichtbar sein.

**Probleme heute:** Klassische Fangbücher erfassen nur Fänge oder bestenfalls Angeltage, aber nicht die Angelzeit. Fangort und Wetter werden selten oder ungenau notiert, weil man am Wasser keine Zeit dafür hat.

## Kernfunktionen (Roadmap)

_Die Feature-Liste mit Name, Beschreibung, Status und Build-Reihenfolge steht in **`features/INDEX.md`** und nur dort._

Das MVP muss drei Dinge können: Ein Angler legt ein Konto an, erfasst eine Angel-Session mit Start, Ende und GPS-Position und trägt darin seine Fänge mit eigener Position ein. Wetterdaten zu jeder Session und jedem Fang kommen automatisch dazu. Das ist die Datengrundlage für spätere Auswertungen.

Bewusst später kommen: Kartendarstellung (als nächstes Feature geplant), Statistik „Fänge pro Angelstunde“, weitere Datenquellen (Mondphase, Wassertemperatur, Pegel), Offline-Modus, Fotos, Fangmeldungs-Export und Vereinsfunktionen.

## Erfolgskriterien
- Ein neuer Nutzer kann sich registrieren, eine Session starten und einen Fang eintragen. Danach sieht er Session und Fang mit GPS-Koordinaten und Wetterdaten.
- Ein zweiter Nutzer sieht keine Daten des ersten Nutzers, auch nicht über direkte Aufrufe der Datenbank.
- Einen Fang in einer laufenden Session einzutragen dauert am Smartphone weniger als 30 Sekunden.
- Ein Eintrag geht nie verloren, weil die Wetter-API ausfällt: Er wird ohne Wetterdaten gespeichert und entsprechend gekennzeichnet.

## Rahmenbedingungen
- **Plattform:** Web-App, mobile-first, auf dem Smartphone am Wasser bedienbar. Oberfläche auf Deutsch, metrische Einheiten (cm, g, °C, hPa, km/h).
- **Stack:** Next.js 16, TypeScript, Tailwind CSS und shadcn/ui, Zod.
- **Backend:** Supabase (PostgreSQL, Auth), Free Plan.
- Environment strategy: local — Supabase läuft während der Entwicklung per Docker. Für die Abgabe kommt eine Supabase-Cloud-Instanz (Free Plan) dazu, auf die die Migrationen per `supabase db push` und die Auth-Einstellungen per `supabase config push` übertragen werden (Anleitung in `README.md`).
- Data region: eu-central-1 (Frankfurt) — verbindlich für jedes gehostete Supabase-Projekt, weil sich die Region nicht nachträglich ändern lässt.
- Hosting: keines in dieser Version. Die App läuft lokal (`npm run dev`) gegen die Supabase-Cloud-Instanz; abgegeben wird ein öffentliches GitHub-Repository. Vor einem öffentlichen Hosting gilt die Deploy-Sperre aus PROJ-1 (CAPTCHA).
- **Externe Dienste:** Nur kostenlose. Open-Meteo braucht keinen API-Key.
- **Secrets:** Keine im Repository. Supabase-Zugangsdaten stehen nur in `.env.local`, Platzhalter liegen in `.env.local.example`.
- Data protection law: GDPR (EU/DE), DSG (CH)
- Data protection stance: standard
- **Privatsphäre:** GPS-Daten, Sessions und Fänge sind ausschließlich für den jeweiligen Nutzer sichtbar. Das wird in der Datenbank per Row Level Security durchgesetzt.
- Design system: see `docs/design-system.md` (übernommen aus `docs/Fangquote App.html`, dazu ein abgeleiteter Dunkelmodus)
- **Datenmodell:** Es ist so angelegt, dass die geplante Karte später ohne Änderungen an den Tabellen dazukommen kann.

## Nicht-Ziele (diese Version)
- Keine Kartendarstellung, keine Position per Tippen auf eine Karte, kein Gewässername-Vorschlag
- Keine Statistiken oder Auswertungen (auch nicht „Fänge pro Angelstunde“ nach Faktoren). Einzige Ausnahme ist die einfache Kennzahl „Fänge pro Stunde“ pro Session in der Detailansicht, wie im Design vorgesehen.
- Keine Mondphase, Wassertemperatur oder Pegelstände
- Kein Offline-Modus, keine Fotos, kein Export einer Fangmeldung
- Keine Vereinsfunktionen oder Rollen, kein Teilen, keine Community, kein Bezahlmodell
- Kein Deployment in die Produktion
