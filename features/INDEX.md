# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Mapped** - already built before the kit arrived; proposed by `/map`, confirmed at `/init`, no spec folder yet — `/reverse-spec` writes it
- **Spec'd** - `/reverse-spec` done: runs in production, criteria confirmed, not yet verified — `/qa` closes that gap
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **Tasked** - `/tasks` done, tasks.md approved, ready to build
- **In Progress** - `/build` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production
- **Merged** - spec folded into another feature by `/refine`; the Spec cell names it, the folder lies in `features/archive/`

## Features

> The **Spec** column links to the feature **folder** (`features/PROJ-X-name/`), not a single file. Each folder contains `spec.md`, `design.md`, `tasks.md`, and `qa-report.md`.
>
> **A row is never a log.** This file is loaded into every session. What was built, fixed, measured or decided goes into the feature's folder (`design.md`, `qa-report.md`) and the commit — here only the status changes.
>
> **Feature** is the name only — two to four words, the way you would say it ("User accounts & login", "Kanban board"). **Description** is one sentence of what it does. Priority and dependencies are not columns: they are the **build order** line under the table, and it is the only place they live — there is no second roadmap table anywhere else.

| ID | Feature | Description | Status | Spec | Created |
|----|---------|-------------|--------|------|---------|
| PROJ-1 | Registrierung & Login | Registrierung, Login und Logout mit E-Mail und Passwort, Umleitung nicht angemeldeter Nutzer, schlanke Konto-Seite und das Row-Level-Security-Muster (jeder sieht nur seine eigenen Daten). | Approved | [PROJ-1-user-auth](PROJ-1-user-auth/) | 2026-09-29 |
| PROJ-2 | Sessions & Fänge | Sessions live oder nachträglich erfassen, Fänge mit GPS-Position eintragen, bearbeiten und löschen, dazu Übersicht, Detailansicht und der App-Rahmen (Kopfzeile, Tab-Leiste, Leiste der aktiven Session). | Planned | [PROJ-2-sessions-catches](PROJ-2-sessions-catches/) | 2026-09-29 |
| PROJ-3 | Automatische Wetterdaten | Ruft Wetterdaten von Open-Meteo zu Position und Uhrzeit jeder Session und jedes Fangs ab (auch rückwirkend), kennzeichnet Einträge ohne Wetterdaten und zeigt sie in den Detailansichten. | Roadmap | — | 2026-09-29 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 (braucht PROJ-1) → PROJ-3 (braucht PROJ-2)

<!-- Add features above this line -->

## Deployments

> One line per release, written by `/deploy` — **the single deployment record**: tag · date · production URL · the features it shipped. `/security-check` reads the production URL here, `/audit` expects every Deployed feature on one line. A feature that was live before the kit arrived (reconstructed from code) gets its line from `/qa`: `live before the kit — verified by /qa on <date> · PROJ-X`.

- _v1.0.0 · 2026-01-31 · https://app.example.com · PROJ-1, PROJ-2_

## Next Available ID: PROJ-4
