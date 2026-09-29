# PROJ-1 Aufgaben: Registrierung & Login

> Erzeugt von `/tasks` aus `spec.md` und `design.md`. Das ist der geordnete, nachverfolgbare Bauplan zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallel ausführbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also an einen eigenen Sub-Agenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC- bzw. EC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Aufgabe → Test.
> `[user]` = eine Einstellung, die nur du machen kannst: `where:` statt `files:`, nie `[P]`, abgehakt von dir. `/build` übergibt sie, `/deploy` liefert nicht aus, solange sie offen ist.
> `[user go-live]` = dasselbe, braucht aber das gehostete Projekt bzw. die Produktions-Adresse. Das geht nicht vor `/deploy`, deshalb blockiert es weder `/qa` noch „Approved“. `/deploy` erledigt es und hakt es ab.
> Owner: `/tasks` legt diese Datei an, `/build` hakt ab, außer bei `[user]`-Aufgaben, die du abhakst.
> Kein Statusfeld hier: Die Häkchen sind der Fortschritt, der Status des Features lebt nur in `features/INDEX.md`.
> Die Dateinamen der Migrationen sind fest vorgegeben, damit die Reihenfolge stimmt, auch wenn die Aufgaben parallel gebaut werden.

## Ebene 1: Datenbank und Grundlagen

- [x] T1 [P]  Migration Profile: Tabelle `profiles` (id = Auth-Konto, created_at), automatische Anlage beim Entstehen eines Auth-Kontos, Mitlöschen mit dem Konto, Row Level Security „nur eigenes Profil lesen“, keine Schreibrechte für Nutzer, keine Rechte für anonyme Aufrufer  · files: supabase/migrations/20260929120000_profiles.sql  · → AC-4, AC-14, AC-15, AC-28, EC-12
- [x] T2 [P]  Migration Protokoll der Login-Bremse: Tabelle `auth_throttle_events` (kind, email, ip, outcome, created_at; zwei Indizes; Row Level Security an, keine Regeln, Rechte der öffentlichen Rollen entzogen) und die Funktion „Kontostatus einer Adresse“ (none, unconfirmed, confirmed), ausführbar nur mit dem Server-Schlüssel  · files: supabase/migrations/20260929120100_auth_throttle.sql  · → AC-23, AC-24, AC-25, AC-26, EC-8
- [x] T3 [P]  Migration Aufräumjobs (pg_cron aktivieren, stündlich): Protokolleinträge älter als 24 h löschen, unbestätigte Auth-Konten älter als 7 Tage löschen  · files: supabase/migrations/20260929120200_auth_cleanup_jobs.sql  · → AC-31, AC-32
- [x] T4 [P]  Lokale Supabase-Einstellungen laut design.md (site_url localhost, Weiterleitungsziele, E-Mail-Bestätigung an, Mindestlänge 8, Link-Gültigkeit 86 400 s, Mindestabstand 10 s, großzügige Supabase-Grenzen) und deutsche Mailvorlagen mit Link auf `/auth/confirm` (Token-Hash und Typ)  · files: supabase/config.toml, supabase/templates/confirmation.html, supabase/templates/recovery.html  · → AC-1, AC-3, AC-5, AC-16, AC-17, EC-5
- [x] T5 [P]  Design-System anwenden: Tokens hell und dunkel in globals.css laut `docs/design-system.md`, Schriften Zilla Slab, Barlow und IBM Plex Mono über next/font, `lang="de"`, App-Titel und -Beschreibung, Toaster (sonner) für Erfolgs-Notices im Grundlayout  · files: src/app/globals.css, src/app/layout.tsx  · → AC-1, AC-7, AC-19
- [x] T6 [P]  Sicherheits-Header in der Next.js-Konfiguration (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security)  · files: next.config.ts  · → AC-3, AC-13, AC-17
- [x] T7 [P]  Supabase-Zugang mit Server-Schlüssel, nur auf dem Server nutzbar (Paket `server-only`), Platzhalter `SUPABASE_SERVICE_ROLE_KEY` in der Beispiel-Env-Datei  · files: src/lib/supabase/admin.ts, .env.local.example, package.json, package-lock.json  · → AC-23, AC-24, AC-25, AC-26, AC-28
- [ ] T8 [user]  Server-Schlüssel der lokalen Supabase eintragen  · where: `.env.local` → neue Zeile `SUPABASE_SERVICE_ROLE_KEY=<Secret key bzw. service_role key aus „supabase status“>`, ohne `NEXT_PUBLIC_`  · → AC-23, AC-24, AC-25, AC-26, AC-28

## Ebene 2: Kernbausteine

- [x] T9 [P]  Eingaberegeln (E-Mail normalisieren und prüfen; neues Passwort 8–72 Zeichen; bestehendes Passwort Pflicht, höchstens 72) als Zod-Schemas für Browser und Server und alle deutschen Meldungen an einer Stelle, mit Unit-Tests  · files: src/lib/auth/schemas.ts, src/lib/auth/schemas.test.ts, src/lib/auth/messages.ts  · → AC-5, AC-8, EC-7
- [x] T10 [P]  Login-Bremse (erst eintragen, dann zählen; 5 pro Adresse bzw. 20 pro IP in 15 min; Wartezeit berechnen; Ausgang setzen), Mail-Grenze (3 pro Adresse und Stunde), Registrierungs-Grenze (5 pro IP und Stunde), IP-Ermittlung und 500-ms-Mindestantwortzeit, mit Unit-Tests  · files: src/lib/auth/throttle.ts, src/lib/auth/throttle.test.ts, src/lib/auth/client-ip.ts, src/lib/auth/min-duration.ts  · → AC-23, AC-24, AC-25, AC-26, EC-5, EC-11
- [x] T11 [P]  Proxy (Anmeldung erneuern, Abgemeldete zu `/login`, Angemeldete von den Login-Seiten zu `/`, Liste der öffentlichen Adressen) und Anmeldeprüfung für geschützte Seiten, die Supabase direkt fragt (ungültig → `/login?notice=session-ended`)  · files: src/proxy.ts, src/lib/auth/require-user.ts  · → AC-10, AC-11, AC-13, EC-9

## Ebene 3: Server-Aktionen, Endpunkte und gemeinsame Bausteine

- [x] T12 [P]  Server Actions Registrieren (Kontostatus: none → registrieren, unconfirmed → nur Mail erneut, confirmed → nichts; immer gleicher Zustand), „Mail erneut senden“, „Passwort vergessen“ und „Neue Mail anfordern“ vom abgelaufenen Link, alle mit Grenzen und Mindestantwortzeit  · files: src/lib/auth/actions/register.ts, src/lib/auth/actions/mail.ts  · → AC-1, AC-2, AC-6, AC-16, AC-25, AC-26, EC-1, EC-2, EC-5, EC-8
- [x] T13 [P]  Server Actions Login (Login-Bremse, gleiche Fehlermeldung, Hinweis bei unbestätigtem Konto, Weiterleitung zu `/`) und Abmelden (Anmeldung beenden, Seitenspeicher verwerfen, `/login`)  · files: src/lib/auth/actions/session.ts  · → AC-7, AC-8, AC-9, AC-22, AC-23, AC-24
- [x] T14 [P]  Server Actions Passwort ändern (aktuelles Passwort durch die Bremse, andere Geräte abmelden), neues Passwort nach dem Zurücksetzen (andere Geräte abmelden, `/` mit Erfolgs-Notice) und Konto löschen (Passwort durch die Bremse, Admin-Löschung, Cookies löschen, `/login?notice=account-deleted`)  · files: src/lib/auth/actions/account.ts  · → AC-17, AC-18, AC-20, AC-21, AC-27, AC-28, EC-11, EC-12
- [x] T15 [P]  Endpunkt `/auth/confirm`: nur die Typen email und recovery; Token prüfen; beim Zurücksetzen die 1-Stunden-Grenze über den Zeitpunkt der Mail; immer Weiterleitung ohne Token (`/`, `/reset-password`, `/login?notice=email-confirmed` oder `/auth/link-expired?type=…`)  · files: src/app/auth/confirm/route.ts  · → AC-3, AC-17, EC-1, EC-2, EC-3, EC-4, EC-10
- [x] T16 [P]  Endpunkt `/account/export`: nur angemeldet, JSON-Datei `petrilog-export-JJJJ-MM-TT.json` mit Formatkennung, Exportzeitpunkt, Konto und Profil, nie aus dem Cache  · files: src/app/(app)/account/export/route.ts  · → AC-29
- [x] T17 [P]  Passwortfeld mit „Passwort anzeigen“ (aus shadcn `input` und `button`) und Layout für Abgemeldete (dunkler Wald-Hintergrund mit Papier-Textur, Schriftzug „Petrilog“)  · files: src/components/auth/password-input.tsx, src/app/(auth)/layout.tsx  · → AC-12

## Ebene 4: Seiten

- [ ] T18 [P]  Login-Seite: Formular (react-hook-form + Zod, Absenden per Server Action, Button während der Verarbeitung gesperrt), Fehler-Notices (falsche Daten, Sperre mit Minuten, keine Verbindung), Hinweis bei unbestätigtem Konto mit „Mail erneut senden“, Hinweise aus `?notice=`, Links „Passwort vergessen?“, „Konto anlegen“, „Datenschutz“  · files: src/app/(auth)/login/page.tsx, src/components/auth/login-form.tsx  · → AC-7, AC-8, AC-9, AC-23, AC-24, AC-28, AC-30, EC-4, EC-5, EC-6, EC-9
- [ ] T19 [P]  Registrierungsseite: Formular mit Hinweis „mindestens 8 Zeichen“ und Satz zur Datenschutzerklärung, danach Zustand „Prüfe dein Postfach“ (Adresse, Hinweis auf Login und „Passwort vergessen“, „Mail erneut senden“), Fehler- und Grenzen-Notices  · files: src/app/(auth)/register/page.tsx, src/components/auth/register-form.tsx, src/components/auth/check-email.tsx  · → AC-1, AC-2, AC-5, AC-6, AC-25, AC-26, AC-30, EC-5, EC-6
- [ ] T20 [P]  Seite „Passwort vergessen“ mit neutraler Bestätigung und Seite „Link abgelaufen“ mit Formular „Neue Mail anfordern“ und Link zum Login  · files: src/app/(auth)/forgot-password/page.tsx, src/components/auth/forgot-password-form.tsx, src/app/auth/link-expired/page.tsx, src/components/auth/request-new-link-form.tsx  · → AC-16, AC-25, EC-1, EC-2, EC-6
- [ ] T21 [P]  Seite „Neues Passwort festlegen“ (nur mit Anmeldung, kompakte Kopfzeile, Meldung bei gleichem Passwort)  · files: src/app/reset-password/page.tsx, src/components/auth/new-password-form.tsx  · → AC-17, AC-18, EC-6
- [ ] T22 [P]  Layout des angemeldeten Bereichs mit Anmeldeprüfung und Startseite als Platzhalter (Begrüßung, Link zur Konto-Seite, Erfolgs-Notice aus `?notice=password-changed`); die Beispielseite von Next.js wird entfernt  · files: src/app/(app)/layout.tsx, src/app/(app)/page.tsx, src/app/page.tsx  · → AC-3, AC-7, AC-13, AC-17, EC-9
- [ ] T23 [P]  Konto-Seite: E-Mail-Anzeige, Sheet „Passwort ändern“, „Meine Daten exportieren“, Link „Datenschutz“, „Abmelden“, Löschdialog mit Passwort und Warntext  · files: src/app/(app)/account/page.tsx, src/components/account/change-password-sheet.tsx, src/components/account/delete-account-dialog.tsx, src/components/account/account-actions.tsx  · → AC-19, AC-20, AC-21, AC-22, AC-27, AC-28, AC-29, EC-11
- [ ] T24 [P]  Datenschutzerklärung als Platzhaltertext auf Basis von `docs/privacy.md`, ohne Anmeldung erreichbar, deutlich als Entwurf gekennzeichnet  · files: src/app/privacy/page.tsx  · → AC-30

## Ebene 5: Beim ersten Deploy

- [ ] T25 [user go-live]  Server-Schlüssel beim Hoster  · where: Hoster → Umgebungsvariablen → `SUPABASE_SERVICE_ROLE_KEY` = Wert aus gehostetem Supabase → Settings → API  · → AC-23, AC-24, AC-25, AC-26, AC-28
- [ ] T26 [user go-live]  Auth-Einstellungen im gehosteten Supabase: E-Mail-Bestätigung an, Mindestlänge 8, Link-Gültigkeit 86 400 s, Mindestabstand 10 s  · where: Supabase → Authentication → Sign In / Providers → Email (oder `supabase config push`, falls die CLI es kann)  · → AC-1, AC-3, AC-5, EC-5
- [ ] T27 [user go-live]  Site URL und Weiterleitungsziele auf die Produktions-Adresse  · where: Supabase → Authentication → URL Configuration  · → AC-3, AC-17
- [ ] T28 [user go-live]  Deutsche Mailvorlagen übernehmen  · where: Supabase → Authentication → Emails → Templates, Inhalt aus `supabase/templates/`  · → AC-1, AC-16
- [ ] T29 [user go-live]  Eigener Mail-Dienst (SMTP)  · where: Supabase → Authentication → Emails → SMTP Settings, Zugangsdaten des gewählten Dienstes  · → AC-1, AC-16
- [ ] T30 [user go-live]  Supabase-eigene Grenzen passend zum Mail-Dienst  · where: Supabase → Authentication → Rate Limits  · → AC-23, AC-24, AC-25, AC-26
- [ ] T31 [user go-live]  AVV mit Supabase annehmen  · where: Supabase → Organization Settings → Legal Documents  · → AC-28

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig zusammengeführt und gegen ihre AC-IDs geprüft ist: Datenbank (E1) → Kernbausteine (E2) → Server-Aktionen (E3) → Seiten (E4).
- **`[P]` verlangt getrennte Dateien.** Keine zwei `[P]`-Aufgaben einer Ebene nennen denselben Pfad unter `files:`. Geprüft: Alle Ebenen sind dateidisjunkt.
- **T8 muss erledigt sein, bevor Ebene 3 gegen die echte lokale Datenbank geprüft wird.** Die Unit-Tests aus Ebene 2 laufen auch ohne ihn.
- **Nach Ebene 1** startet `/build` die lokale Supabase neu (`supabase stop` und `supabase start`) und spielt die Migrationen ein (`supabase db reset`), damit Einstellungen und Tabellen gelten.
- **EC-3** (nur der neueste Link zum Zurücksetzen gilt) garantiert Supabase selbst. `/qa` prüft es ausdrücklich.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Sub-Agenten mit eigenem Git-Worktree. Danach führt der Haupt-Agent zusammen, prüft gegen die AC-IDs der Ebene und hakt hier ab. Sub-Agenten erklären sich nie selbst für fertig.
