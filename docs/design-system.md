# Design-System — Petrilog

> **Quelle:** `docs/Fangquote App.html` (Design-Prototyp „Fangquote“, entpackt und ausgewertet von `/init` am 2026-09-29). Übernommen wurden Farben, Typografie, Abstände, Radien, Schatten und Komponenten-Konventionen. **Ergänzt** von `/init`: Dunkelmodus (abgeleitet aus derselben Palette), das Mapping auf die shadcn/ui-Tokens und zwei Kontrastkorrekturen.
>
> `/build` liest diese Datei bei jedem Feature. Die Werte sind verbindlich, keine Richtung.

## Charakter

Erdig, ruhig, draußen: Papier-Sand als Grund, Waldoliv als Marke, Bernstein für jede Handlung, Seeblau für Messwerte. Große Slab-Überschriften mit Charakter, nüchterne Bedienelemente. Gebaut für eine Hand, Sonne auf dem Display und wenig Zeit.

Der Schriftzug heißt **Petrilog** (im Prototyp noch „Fangquote“): Zilla Slab 700.

## Farbpalette (Rohwerte)

| Familie | Stufen |
|---------|--------|
| **Sand** — Papiergrund | 50 `#F4F1EA` · 100 `#E6E2D6` · 200 `#D8D2C2` · 300 `#BFB7A3` · 400 `#9A917C` · Weiß `#F8F6F0` |
| **Ink** — warmes Fast-Schwarz | 900 `#161A14` · 800 `#23281F` · 700 `#363C31` · 500 `#5C6255` · 400 `#7E8375` · 300 `#AFB2A8` |
| **Moss** — Waldoliv, Marke | 900 `#141B12` · 800 `#1F2A1B` · 700 `#2F3F28` · 600 `#435736` · 500 `#5D7248` · 200 `#BFC8AE` · 100 `#D9DECB` |
| **Amber** — Aktion / CTA | 700 `#8A4B12` · 600 `#B5651C` · 500 `#D07A2A` · 400 `#DE9249` · 100 `#F0DCC3` |
| **Lake** — Wetter & Messwerte | 800 `#1F3A46` · 700 `#2E5262` · 500 `#587C8C` · 300 `#98B0BA` · 100 `#D6DFE0` |
| **Bark** — Erdbraun | 900 `#2A1F16` · 700 `#4A3726` · 500 `#7A5E43` · 200 `#CDBEA9` |
| **Rust** — Löschen / Fehler | 700 `#8E3421` · 600 `#B0472F` · 100 `#F5DDD5` · (dunkel, neu) 400 `#E3826A` |

Kein reines `#000` oder `#fff` — der hellste Wert ist `#F8F6F0`, der dunkelste `#141B12`.

## Semantische Tokens — hell und dunkel

| Token | Rolle | Hell | Dunkel |
|-------|-------|------|--------|
| `surface-page` | Seitenhintergrund | Sand 100 | Moss 900 |
| `surface-card` | Karten, Formularfelder | Weiß `#F8F6F0` | Moss 800 |
| `surface-sunken` | Vertiefte Flächen, Skeleton, „ohne Wetterdaten“ | Sand 200 | `#10160E` |
| `surface-inverse` | Hero-Karten, Leiste der aktiven Session, Login | Moss 800 | Moss 700 |
| `surface-data` | Wetter-/Messwert-Kacheln | Lake 100 | Lake 800 |
| `text-strong` | Überschriften, Werte | Ink 900 | Sand 50 |
| `text-body` | Fließtext | Ink 700 | Sand 100 |
| `text-muted` | Metadaten, Hinweise | Ink 500 | Sand 300 |
| `text-faint` | nur Icons und Deko, **kein Text** (s. u.) | Ink 400 | Sand 400 |
| `text-on-inverse` | Text auf `surface-inverse` | Sand 50 | Sand 50 |
| `text-on-data` | Text auf `surface-data` | Lake 800 | Lake 100 |
| `text-on-action` | Text auf Amber-Buttons | Ink 900 | Ink 900 |
| `border-subtle` / `default` / `strong` | Linien | Sand 200 / Sand 300 / Ink 400 | Moss 700 / Moss 600 / Moss 500 |
| `action-primary` (+ hover / press) | Hauptaktion | Amber 500 (400 / 600) | Amber 500 (400 / 600) |
| `action-primary-subtle` | Auswahl-Hintergrund, Markierung | Amber 100 | Amber 700 |
| `action-secondary` (+ hover) | Zweitaktion | Moss 700 (600) | Moss 600 (500) |
| `focus-ring` | Fokus | Lake 500 | Lake 300 |
| `status-active` | Laufende Session | Amber 500 | Amber 400 |
| `status-released` | Zurückgesetzt | Moss 600 | Moss 200 |
| `status-kept` | Entnommen | Lake 700 | Lake 300 |
| `status-danger` | Fehler, Löschen | Rust 600 | Rust 400 |

### Mapping auf shadcn/ui (`src/app/globals.css`, HSL-Tripel)

| shadcn-Variable | Hell | Dunkel (`.dark`) |
|-----------------|------|------------------|
| `--background` | `45 24.2% 87.1%` (Sand 100) | `107 20% 8.8%` (Moss 900) |
| `--foreground` | `100 13% 9%` (Ink 900) | `42 31.3% 93.7%` (Sand 50) |
| `--card`, `--popover` | `45 36.4% 95.7%` (Weiß) | `104 21.7% 13.5%` (Moss 800) |
| `--card-foreground`, `--popover-foreground` | `100 13% 9%` | `42 31.3% 93.7%` |
| `--primary` | `29 66.4% 49%` (Amber 500) | `29 66.4% 49%` (Amber 500) |
| `--primary-foreground` | `100 13% 9%` (Ink 900) | `100 13% 9%` (Ink 900) |
| `--secondary` | `102 22.3% 20.2%` (Moss 700) | `96 23.4% 27.6%` (Moss 600) |
| `--secondary-foreground` | `42 31.3% 93.7%` (Sand 50) | `42 31.3% 93.7%` (Sand 50) |
| `--muted` | `44 22% 80.4%` (Sand 200) | `102 22.3% 20.2%` (Moss 700) |
| `--muted-foreground` | `88 7.1% 35.9%` (Ink 500) | `43 17.9% 69.4%` (Sand 300) |
| `--accent` | `76 22.4% 83.3%` (Moss 100) | `102 22.3% 20.2%` (Moss 700) |
| `--accent-foreground` | `104 21.7% 13.5%` (Moss 800) | `76 22.4% 83.3%` (Moss 100) |
| `--destructive` | `11 57.8% 43.7%` (Rust 600) | `12 68.4% 65.3%` (Rust 400) |
| `--destructive-foreground` | `42 31.3% 93.7%` (Sand 50) | `100 13% 9%` (Ink 900) |
| `--border`, `--input` | `43 17.9% 69.4%` (Sand 300) | `96 23.4% 27.6%` (Moss 600) |
| `--ring` | `198 22.8% 44.7%` (Lake 500) | `198 19.8% 66.3%` (Lake 300) |
| `--radius` | `0.5rem` | `0.5rem` |

Die Paletten-Familien (Sand, Ink, Moss, Amber, Lake, Bark, Rust) werden zusätzlich als eigene Tailwind-Farben verfügbar gemacht (`bg-moss-800`, `text-lake-800` …), damit Hero-Karten und Wetterkacheln nicht auf Einzelwerte ausweichen.

**Dunkelmodus-Umschaltung:** folgt der Systemeinstellung des Geräts (`prefers-color-scheme`). Ein manueller Schalter ist nicht Teil dieser Version.

## Typografie

| Rolle | Schrift | Größe / Zeilenhöhe | Gewicht |
|-------|---------|--------------------|---------|
| Display (Hero-Titel, Gewässername) | Zilla Slab | 40 px / 1.05 (Login: 46 px, Hero-Karte: 30–40 px) | 700 |
| Wortmarke „Petrilog“ | Zilla Slab | 34 px / 1 | 700 |
| Eyebrow (Überzeile) | Barlow, VERSALIEN, Laufweite 0.08em | 12 px / 1.2 | 600 |
| Title (AppBar) | Barlow | 24 px / 1.25 | 500 |
| Heading (Abschnitt) | Barlow | 17 px / 1.25 | 600 |
| Body | Barlow | 15 px / 1.5 | 400 |
| Label | Barlow | 13 px / 1.25 | 500 |
| Caption | Barlow | 12 px / 1.25 | 400 |
| Figure (Kennzahl) | Barlow | 32 px / 1 | 500 |
| Koordinaten | IBM Plex Mono | 13 px / 1.25 | 400 |
| Eingabetext | Barlow | **16 px** (verhindert Zoom auf iOS) | 500 |

Schriften werden über `next/font/google` geladen (Zilla Slab 500/600/700, Barlow 400/500/600/700, IBM Plex Mono 400/500), mit Fallbacks `Rockwell, Georgia, serif` / `system-ui, sans-serif` / `ui-monospace, monospace`.

Zahlen im deutschen Format (`1,7`, `1.018 hPa`), Einheiten metrisch mit schmalem Abstand (`31 cm`, `13,8 °C`).

## Abstände, Radius, Tiefe

- **Abstandsskala:** 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 px. Seitenrand (`screen-gutter`) 20 px, Inhaltsbreite höchstens 440 px, mittig.
- **Radius — eine Entscheidung:** 8 px für alle Bedienelemente (Buttons, Felder, Badges, Tabs, Notices). Karten 12 px, Hero-Karten 16 px, Kreise (Avatare, Punkte) voll rund. Nichts anderes.
- **Tiefe:** Schatten statt Rahmen für Karten — `shadow-sm` für Karten, `shadow-md` für Toasts, `shadow-lg` für die schwebende Leiste der aktiven Session. Formularfelder haben einen 1-px-Rahmen (`border-default`). Im Dunkelmodus werden Schatten durch hellere Flächen ersetzt (Karte Moss 800 auf Moss 900).
- **Textur:** Hero-Karten und der Login-Hintergrund tragen eine feine Papier-Rauschtextur (SVG-Noise, ca. 11 % Deckkraft) über der Grundfarbe.
- **Bewegung:** 120 ms (schnell) / 200 ms (normal) / 320 ms (langsam), Kurve `cubic-bezier(.22,.8,.3,1)`. Bei `prefers-reduced-motion` entfallen Skalierungen.

## Komponenten-Konventionen

Alle Bausteine werden auf den installierten shadcn/ui-Komponenten aufgebaut, nicht nachgebaut.

- **Button** (`ui/button`): Varianten `primary` (Amber, Text Ink 900), `secondary` (Moss), `outline`, `ghost`, `destructive` (Rust). Größen: `sm` 36 px, `md` 44 px, `lg` **56 px** (Standard für Hauptaktionen unten im Daumenbereich, volle Breite). Schrift 600. Gedrückt: Skalierung 0.97 und leicht abgedunkelt. Deaktiviert: 45 % Deckkraft.
- **Formularfeld** (`ui/input`, `ui/select`, `ui/textarea`): Höhe **52 px**, Innenabstand 16 px, Label darüber (Label-Stil), Hinweis darunter (Caption, `text-muted`), Fehlertext darunter in `status-danger` mit Rahmen in derselben Farbe. Einheit als Suffix im Feld (`cm`, `g`).
- **Segmented** (Entnommen / Zurückgesetzt): `ui/tabs` oder `ui/radio-group` im Segment-Stil, 44 px hoch.
- **Badge** (`ui/badge`): 24 px hoch, 12 px/600. Ton `live` (Amber mit Punkt, „Läuft“), `released`, `kept`, `neutral`.
- **Card** (`ui/card`): Töne `surface`, `sunken`, `data` (Wetter), `inverse` (Hero).
- **Notice** (`ui/alert`): Töne `info` (Lake), `success` (Moss), `warning` (Amber 700), `danger` (Rust), mit Icon, Titel 14 px/600 und Text 13 px.
- **Toast:** eine Erfolgs-Notice oben am Bildschirm, ca. 2 Sekunden sichtbar (`ui/sonner`, Position oben).
- **Icons:** Lucide (`lucide-react`), 20 px Standard, 16 px in Fließtext, 14 px in Koordinaten.
- **Touch-Ziele:** mindestens **44 px**, Hauptaktionen 56 px.
- **Leere Zustände:** ein kurzer Satz in `text-muted`, mittig, mit passender Aktion (z. B. „Noch keine Fänge. Petri Heil!“).
- **Laden:** `ui/skeleton` in der Form der späteren Karten, in `surface-sunken`.
- **Ohne Wetterdaten:** vertiefte Fläche mit Icon `cloud-off` und dem Text „Ohne Wetterdaten“.

## Pflicht-Regeln

- **Hell und dunkel sind beide definiert** — jede neue Farbe bekommt beide Werte.
- **Kein reines Schwarz oder Weiß.**
- **Markenfarben nie flach auf großen Flächen:** Moss und Amber haben Hover-, Aktiv- und Subtle-Varianten; große Flächen tragen die Papier-Textur.
- **Jedes interaktive Element hat einen sichtbaren Hover- und Fokus-Zustand.** Fokus = 3-px-Ring in `focus-ring` (hell `rgba(88,124,140,.5)`), nie entfernt.
- **Ein Radius (8 px) für alle Bedienelemente.**
- **Kontrast mindestens 4,5:1** für Text in beiden Modi. Geprüft: Ink 900 auf Amber 500 = 5,45 · Sand 50 auf Moss 800 = 13,3 · Ink 500 auf Sand 100 = 4,86 · Sand 300 auf Moss 800 = 7,5 · Lake 100 auf Lake 800 = 8,8 · Rust 400 auf Moss 800 = 5,5.

### Korrekturen gegenüber dem Prototyp

1. **`text-faint` (Ink 400) ist kein Textfarbton mehr.** Auf Sand 100 erreicht er nur 3,0:1, auf Weiß 3,6:1. Der Prototyp nutzt ihn für die Beschriftung inaktiver Tabs — dort gilt jetzt `text-muted` (Ink 500, 4,86:1). Ink 400 bleibt für Icons und Deko.
2. **Text auf `surface-sunken` (Sand 200) nutzt `text-body` (Ink 700, 7,5:1)**, nicht `text-muted` (4,18:1 — zu wenig). Betrifft z. B. „Ohne Wetterdaten“.
