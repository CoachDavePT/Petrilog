# Petrilog — digitales Fangbuch

Petrilog ist ein Fangbuch für Angler. Es speichert Angel-Sessions und Fänge zusammen mit der tatsächlichen Angelzeit, dem Fangort (GPS) und dem Wetter. Weil die Angelzeit mit erfasst wird, lassen sich Fänge ehrlich auswerten: als **Fänge pro Angelstunde** statt als bloße Fangzahl.

- **Registrierung & Login** (E-Mail + Passwort, Bestätigungs-Mail, Login-Bremse, Datenexport, Kontolöschung)
- **Sessions & Fänge** (live oder nachträglich erfassen, GPS-Position, Bearbeiten, Löschen, Fänge pro Stunde)
- **Automatische Wetterdaten** von [Open-Meteo](https://open-meteo.com) zu jeder Session und jedem Fang, auch rückwirkend — **ohne API-Key**
- **Privatsphäre:** Jeder Nutzer sieht nur seine eigenen Daten, durchgesetzt per Row Level Security in der Datenbank. An Open-Meteo geht nur die auf ~1 km gerundete Position, und zwar vom Server, nie vom Gerät.

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS + shadcn/ui, Zod, Supabase (PostgreSQL + Auth), Vitest.

Die App läuft lokal (`npm run dev`) und nutzt eine **Supabase-Cloud-Instanz (Free Plan)** als Datenbank und Login-System. Ein Hosting der App selbst ist nicht nötig.

---

## Voraussetzungen

- **Node.js** 20 oder neuer, **npm**
- Ein kostenloses Konto bei **[Supabase](https://supabase.com)**
- Die Supabase-CLI wird über `npx` genutzt, eine Installation ist nicht nötig

## Einrichtung mit Supabase Cloud (Free Plan)

### 1. Projekt holen

```bash
git clone https://github.com/CoachDavePT/Petrilog.git
cd Petrilog
npm install
```

### 2. Supabase-Projekt anlegen

Im [Supabase-Dashboard](https://supabase.com/dashboard) ein neues Projekt anlegen:
- **Region:** Central EU (Frankfurt) — `eu-central-1`
- Das Datenbank-Passwort notieren (wird beim Verknüpfen gefragt)

Die **Project Ref** steht danach in der Adresse des Dashboards (`https://supabase.com/dashboard/project/<project-ref>`).

### 3. Datenbank und Auth-Einstellungen übertragen

```bash
npx supabase login                               # öffnet den Browser zur Anmeldung
npx supabase link --project-ref <project-ref>    # fragt nach dem Datenbank-Passwort
npx supabase db push                             # spielt alle Migrationen aus supabase/migrations/ ein
npx supabase --workdir cloud-auth config push --project-ref <project-ref>   # überträgt die Auth-Einstellungen
```

- `db push` legt alle Tabellen, Regeln, Trigger, Row-Level-Security-Richtlinien und Aufräum-Jobs an (Dateien in [`supabase/migrations/`](supabase/migrations/), in dieser Reihenfolge).
- `config push` zeigt die Änderungen an und fragt vor dem Schreiben nach (mit `y` bestätigen). Übertragen wird nur, was in [`cloud-auth/supabase/config.toml`](cloud-auth/supabase/config.toml) steht: Site-URL `http://localhost:3553` samt Weiterleitungszielen, Passwort-Mindestlänge 8, Bestätigung per E-Mail, sicherer Passwortwechsel, Link-Gültigkeit 24 Stunden.
- Die deutschen Mailvorlagen aus [`supabase/templates/`](supabase/templates/) lassen sich im Free Plan nur mit eigenem Mail-Dienst (SMTP) übertragen. Ohne ihn verschickt Supabase seine englischen Standard-Mails (siehe „Hinweise zum Supabase Free Plan“).

### 4. Umgebungsvariablen

```bash
cp .env.local.example .env.local
```

In `.env.local` eintragen (Werte aus Supabase → **Project Settings → API Keys** bzw. **Data API**):

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, z. B. `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlicher Key (`anon` bzw. „publishable“) |
| `SUPABASE_SERVICE_ROLE_KEY` | geheimer Key (`service_role` bzw. „secret“) — **nur serverseitig, nie weitergeben, nie committen** |
| `TRUSTED_CLIENT_IP_HEADER` | leer lassen |

Der geheime Key wird für die Login-Bremse, die Prüfung bei der Registrierung und die Kontolöschung gebraucht. Ohne ihn starten diese Funktionen nicht.

### 5. Starten

```bash
npm run dev
```

Die App läuft unter **http://localhost:3553**. Für die Standortabfrage (GPS) muss sie über `localhost` oder HTTPS geöffnet werden.

---

## Hinweise zum Supabase Free Plan

- **Bestätigungs-Mails:** Der eingebaute Mailversand von Supabase stellt nur an Mitglieder der eigenen Supabase-Organisation zu und nur wenige Mails pro Stunde. Wer mit der **eigenen** E-Mail-Adresse registriert, bekommt die Bestätigung — als englische Standard-Mail („Confirm your signup“). Nach dem Klick auf den Link ist die Adresse bestätigt; danach unter http://localhost:3553/login anmelden.
- **Weitere Testkonten** (z. B. zwei Nutzer, um die Datentrennung zu prüfen) am einfachsten unter **Authentication → Users → Add user → Create new user** mit „Auto Confirm User“ anlegen.
- **„Passwort vergessen“** braucht die deutschen Mailvorlagen der App und funktioniert deshalb erst mit eigenem Mail-Dienst: SMTP unter **Authentication → Emails → SMTP Settings** eintragen, dann `npx supabase config push` (ohne `--workdir`) überträgt auch die Vorlagen. Lokal mit Docker (unten) funktioniert alles ohne diese Einschränkung.
- **Pausierung:** Kostenlose Projekte werden nach etwa einer Woche ohne Aktivität pausiert und lassen sich im Dashboard wieder starten.

## Alternative: alles lokal mit Docker

Mit laufendem [Docker Desktop](https://www.docker.com/products/docker-desktop/) läuft Supabase komplett lokal, inklusive eines Test-Postfachs für alle Mails:

```bash
npx supabase start          # startet Supabase lokal (Ports 553xx) und spielt die Migrationen ein
npx supabase status         # zeigt URL und Keys für .env.local
npm run dev
```

Die Mails landen im lokalen Postfach **Mailpit** unter http://127.0.0.1:55324.

---

## Tests

```bash
npm test          # Unit- und Integrationstests (Vitest)
npm run lint      # ESLint
npm run build     # Produktions-Build
```

## Projektunterlagen

Die App wurde spezifikationsgetrieben mit dem AI Engineering Kit gebaut. Anforderungen, Entwürfe und Testberichte liegen im Repository:

- [`docs/PRD.md`](docs/PRD.md) — Produktanforderungen
- [`docs/data-model.md`](docs/data-model.md) — Datenmodell
- [`docs/privacy.md`](docs/privacy.md) — Datenschutz-Nachweis
- [`features/`](features/) — je Feature: `spec.md` (Anforderungen mit Acceptance Criteria), `design.md` (technischer Entwurf), `tasks.md` (Bauplan), `qa-report.md` (Testbericht)
- [`features/INDEX.md`](features/INDEX.md) — Übersicht und Status aller Features

## Sicherheit

- Keine Secrets im Repository. Echte Zugangsdaten stehen nur in `.env.local` (per `.gitignore` ausgeschlossen), Platzhalter in [`.env.local.example`](.env.local.example).
- Zugriffsschutz doppelt: in der App (Anmeldeprüfung in jeder Server Action) und in der Datenbank (Row Level Security „nur eigene Zeilen“).
- Diese Version ist für den lokalen Betrieb gedacht. Vor einem öffentlichen Hosting fehlt noch ein CAPTCHA bei Registrierung und „Passwort vergessen“ (siehe [`features/PROJ-1-user-auth/spec.md`](features/PROJ-1-user-auth/spec.md) → Deploy-Sperre).
