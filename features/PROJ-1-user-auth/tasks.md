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
- [x] T8 [user]  Server-Schlüssel der lokalen Supabase eintragen  · where: `.env.local` → neue Zeile `SUPABASE_SERVICE_ROLE_KEY=<Secret key bzw. service_role key aus „supabase status“>`, ohne `NEXT_PUBLIC_`  · → AC-23, AC-24, AC-25, AC-26, AC-28

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

- [x] T18 [P]  Login-Seite: Formular (react-hook-form + Zod, Absenden per Server Action, Button während der Verarbeitung gesperrt), Fehler-Notices (falsche Daten, Sperre mit Minuten, keine Verbindung), Hinweis bei unbestätigtem Konto mit „Mail erneut senden“, Hinweise aus `?notice=`, Links „Passwort vergessen?“, „Konto anlegen“, „Datenschutz“  · files: src/app/(auth)/login/page.tsx, src/components/auth/login-form.tsx  · → AC-7, AC-8, AC-9, AC-23, AC-24, AC-28, AC-30, EC-4, EC-5, EC-6, EC-9
- [x] T19 [P]  Registrierungsseite: Formular mit Hinweis „mindestens 8 Zeichen“ und Satz zur Datenschutzerklärung, danach Zustand „Prüfe dein Postfach“ (Adresse, Hinweis auf Login und „Passwort vergessen“, „Mail erneut senden“), Fehler- und Grenzen-Notices  · files: src/app/(auth)/register/page.tsx, src/components/auth/register-form.tsx, src/components/auth/check-email.tsx  · → AC-1, AC-2, AC-5, AC-6, AC-25, AC-26, AC-30, EC-5, EC-6
- [x] T20 [P]  Seite „Passwort vergessen“ mit neutraler Bestätigung und Seite „Link abgelaufen“ mit Formular „Neue Mail anfordern“ und Link zum Login  · files: src/app/(auth)/forgot-password/page.tsx, src/components/auth/forgot-password-form.tsx, src/app/auth/link-expired/page.tsx, src/components/auth/request-new-link-form.tsx  · → AC-16, AC-25, EC-1, EC-2, EC-6
- [x] T21 [P]  Seite „Neues Passwort festlegen“ (nur mit Anmeldung, kompakte Kopfzeile, Meldung bei gleichem Passwort)  · files: src/app/reset-password/page.tsx, src/components/auth/new-password-form.tsx  · → AC-17, AC-18, EC-6
- [x] T22 [P]  Layout des angemeldeten Bereichs mit Anmeldeprüfung und Startseite als Platzhalter (Begrüßung, Link zur Konto-Seite, Erfolgs-Notice aus `?notice=password-changed`); die Beispielseite von Next.js wird entfernt  · files: src/app/(app)/layout.tsx, src/app/(app)/page.tsx, src/app/page.tsx  · → AC-3, AC-7, AC-13, AC-17, EC-9
- [x] T23 [P]  Konto-Seite: E-Mail-Anzeige, Sheet „Passwort ändern“, „Meine Daten exportieren“, Link „Datenschutz“, „Abmelden“, Löschdialog mit Passwort und Warntext  · files: src/app/(app)/account/page.tsx, src/components/account/change-password-sheet.tsx, src/components/account/delete-account-dialog.tsx, src/components/account/account-actions.tsx  · → AC-19, AC-20, AC-21, AC-22, AC-27, AC-28, AC-29, EC-11
- [x] T24 [P]  Datenschutzerklärung als Platzhaltertext auf Basis von `docs/privacy.md`, ohne Anmeldung erreichbar, deutlich als Entwurf gekennzeichnet  · files: src/app/privacy/page.tsx  · → AC-30

## Ebene 5: Beim ersten Deploy

- [ ] T25 [user go-live]  Server-Schlüssel beim Hoster  · where: Hoster → Umgebungsvariablen → `SUPABASE_SERVICE_ROLE_KEY` = Wert aus gehostetem Supabase → Settings → API  · → AC-23, AC-24, AC-25, AC-26, AC-28
- [ ] T26 [user go-live]  Auth-Einstellungen im gehosteten Supabase: E-Mail-Bestätigung an, Mindestlänge 8, Link-Gültigkeit 86 400 s, Mindestabstand 10 s  · where: Supabase → Authentication → Sign In / Providers → Email (oder `supabase config push`, falls die CLI es kann)  · → AC-1, AC-3, AC-5, EC-5
- [ ] T27 [user go-live]  Site URL und Weiterleitungsziele auf die Produktions-Adresse  · where: Supabase → Authentication → URL Configuration  · → AC-3, AC-17
- [ ] T28 [user go-live]  Deutsche Mailvorlagen übernehmen  · where: Supabase → Authentication → Emails → Templates, Inhalt aus `supabase/templates/`  · → AC-1, AC-16
- [ ] T29 [user go-live]  Eigener Mail-Dienst (SMTP)  · where: Supabase → Authentication → Emails → SMTP Settings, Zugangsdaten des gewählten Dienstes  · → AC-1, AC-16
- [ ] T30 [user go-live]  Supabase-eigene Grenzen passend zum Mail-Dienst  · where: Supabase → Authentication → Rate Limits  · → AC-23, AC-24, AC-25, AC-26
- [ ] T31 [user go-live]  AVV mit Supabase annehmen  · where: Supabase → Organization Settings → Legal Documents  · → AC-28

## Runde 2: nach QA (2026-09-29)

> Nach `/qa`, `/refine PROJ-1` und `/architecture PROJ-1`. Hier stehen nur die Änderungen: neue Kriterien AC-33, AC-34 und EC-13, geschärfte AC-24 und AC-26 sowie die Fixes für BUG-1 und BUG-3 bis BUG-8 aus `qa-report.md`. Ebene 5 (go-live) blockiert Runde 2 nicht. `/build` beginnt mit Ebene 6.

### Ebene 6: Datenbank und Grundlagen

- [ ] T32 [P]  Neue Migration: Ergebnis `duplicate` im Check von `auth_throttle_events.outcome` erlauben; Funktion `claim_mail_request(p_email, p_ip)` in einem Schritt unter einer Sperre pro Adresse: zugelassener Eintrag jünger als 10 s → Eintrag `duplicate`, Antwort `duplicate`; sonst ≥ 3 zugelassene in 60 min → Eintrag `blocked`, Antwort `limit`; sonst Eintrag `allowed`, Antwort `send`. Ausführbar nur mit dem Server-Schlüssel, `search_path` leer. Die vorhandenen Migrationen bleiben unverändert  · files: supabase/migrations/20260929130000_mail_release.sql  · → AC-25, EC-5
- [ ] T33 [P]  Lokale Supabase: `secure_password_change = true`  · files: supabase/config.toml  · → AC-21, AC-33
- [ ] T34 [P]  Eingaberegeln und Meldungen: neues Passwort 8 Zeichen bis 72 Bytes (UTF-8) mit der Meldung aus AC-34; bestehendes Passwort ohne Obergrenze im Schema (die Bremse übernimmt das, T41); Meldung aus EC-13 und erlaubter Konto-Code `reset-expired`; kaputte Anfragen (kein Objekt, falscher Typ) → „Bitte prüfe deine Eingaben.“ statt englischer Zod-Texte. Unit-Tests ergänzen  · files: src/lib/auth/schemas.ts, src/lib/auth/schemas.test.ts, src/lib/auth/messages.ts, src/lib/auth/messages.test.ts  · → AC-5, AC-34, EC-13
- [ ] T35 [P]  IP-Ermittlung nur aus dem Header, den `TRUSTED_CLIENT_IP_HEADER` nennt (bei `x-forwarded-for` der letzte Eintrag), sonst `untrusted`; Platzhalter `TRUSTED_CLIENT_IP_HEADER=` (leer) mit Erklärung in der Beispiel-Env-Datei. Unit-Tests: gefälschter Header ohne Einstellung wird ignoriert  · files: src/lib/auth/client-ip.ts, src/lib/auth/client-ip.test.ts, .env.local.example  · → AC-24, AC-26
- [ ] T36 [P]  Bremse: Wartezeit nur aus dem jüngsten `failed` (ohne den eigenen Eintrag, Zukunft zählt als „jetzt“), 1 bis 15 Minuten, Sperre nur durch gleichzeitige Prüfungen → 1 Minute; Mail-Grenze ruft `claim_mail_request` auf und liefert `send`, `duplicate` oder `limit` statt ja/nein. Unit-Tests ergänzen  · files: src/lib/auth/throttle.ts, src/lib/auth/throttle.test.ts  · → AC-23, AC-25, EC-5
- [ ] T37 [P]  Freigabe zum Festlegen als eigener Baustein: anlegen (App-Metadaten `password_reset` mit `session_id` der aktuellen Anmeldung und `expires_at` = jetzt + 15 min, über den Server-Schlüssel), prüfen (Ergebnis `valid`, `expired` oder `none`; die Anmeldungskennung aus der geprüften Anmeldung, nie aus Browser-Eingaben), entfernen. Unit-Tests  · files: src/lib/auth/reset-grant.ts, src/lib/auth/reset-grant.test.ts  · → AC-33, EC-13

### Ebene 7: Server-Aktionen und Endpunkte

- [ ] T38 [P]  Registrierung und Mail-Aktionen auf die neue Mail-Grenze umstellen: `duplicate` → dieselbe Erfolgsmeldung ohne Mail, `limit` → Wartemeldung; bei **jedem** Fehler von Supabase beim Anlegen den Kontostatus erneut abfragen, gibt es das Konto jetzt → „Prüfe dein Postfach“  · files: src/lib/auth/actions/register.ts, src/lib/auth/actions/mail.ts  · → AC-1, AC-6, AC-25, EC-5
- [ ] T39 [P]  „Neues Passwort festlegen“ prüft beim Abschicken die Freigabe (`valid` → speichern, Freigabe entfernen, andere Geräte abmelden, `/?notice=password-changed`; `expired` → Freigabe entfernen, `/account?notice=reset-expired`; `none` → `/account`); gleiches Passwort lässt die Freigabe bestehen. „Passwort ändern“ speichert mit der Anmeldung aus der gerade erfolgten Passwortprüfung und funktioniert nachweislich auch mit einer Anmeldung älter als 24 h  · files: src/lib/auth/actions/account.ts  · → AC-17, AC-20, AC-33, EC-13
- [ ] T40 [P]  `/auth/confirm`: nach einem gültigen Link zum Zurücksetzen (innerhalb 1 h) die Freigabe anlegen, dann `/reset-password`; schlägt das Anlegen fehl → abmelden und `/auth/link-expired?type=recovery`. Unit-Tests ergänzen  · files: src/app/auth/confirm/route.ts, src/app/auth/confirm/route.test.ts  · → AC-17, AC-33
- [ ] T41 [P]  Passwortprüfung: ein bestehendes Passwort über 72 Bytes geht durch die Bremse und wird ohne Anfrage an Supabase als `failed` gewertet („E-Mail oder Passwort ist falsch.“ bzw. „Das aktuelle Passwort ist falsch.“)  · files: src/lib/auth/password-check.ts  · → AC-8, AC-21, AC-23

### Ebene 8: Seiten

- [ ] T42 [P]  Seite `/reset-password` prüft beim Öffnen die Freigabe: `valid` → Formular, `expired` → Freigabe entfernen und `/account?notice=reset-expired`, `none` → `/account`; nicht angemeldet → `/login` wie bisher  · files: src/app/reset-password/page.tsx  · → AC-33, EC-13
- [ ] T43 [P]  Konto-Seite zeigt den Hinweis aus `?notice=reset-expired` als Warn-Notice oben, unbekannte Codes werden ignoriert  · files: src/app/(app)/account/page.tsx  · → EC-13
- [ ] T44 [P]  Deutsche Seite für unbekannte Adressen: „Diese Seite gibt es nicht.“ mit Link „Zur Startseite“, hell, ohne Rahmen  · files: src/app/not-found.tsx  · → Technische Anforderung „Sprache“ (kein eigenes AC)

### Ebene 9: Beim ersten Deploy

- [ ] T45 [user go-live]  Sicherer Passwortwechsel im gehosteten Supabase  · where: Supabase → Authentication → Sign In / Providers → Email → „Secure password change“ = an  · → AC-21, AC-33
- [ ] T46 [user go-live]  Vertrauenswürdigen IP-Header setzen  · where: Hoster → Umgebungsvariablen → `TRUSTED_CLIENT_IP_HEADER` = der Header, den der Hoster selbst setzt und nicht vom Aufrufer übernimmt (vorher in dessen Doku prüfen); ohne passenden Header leer lassen  · → AC-24, AC-26
- [ ] T47 [user go-live]  **Deploy-Sperre:** direkten Weg zu Supabase schützen  · where: `/refine PROJ-1` vor dem ersten `/deploy` (CAPTCHA unter Supabase → Authentication → Attack Protection samt Widget in den Formularen, echte IP hinter dem Server klären); erledigt erst, wenn der direkte Weg gegen Durchprobieren und Massen-Registrierung geschützt ist  · → AC-23, AC-24, AC-25, AC-26

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig zusammengeführt und gegen ihre AC-IDs geprüft ist: Datenbank (E1) → Kernbausteine (E2) → Server-Aktionen (E3) → Seiten (E4).
- **`[P]` verlangt getrennte Dateien.** Keine zwei `[P]`-Aufgaben einer Ebene nennen denselben Pfad unter `files:`. Geprüft: Alle Ebenen sind dateidisjunkt.
- **T8 muss erledigt sein, bevor Ebene 3 gegen die echte lokale Datenbank geprüft wird.** Die Unit-Tests aus Ebene 2 laufen auch ohne ihn.
- **Nach Ebene 1** startet `/build` die lokale Supabase neu (`supabase stop` und `supabase start`) und spielt die Migrationen ein (`supabase db reset`), damit Einstellungen und Tabellen gelten.
- **Runde 2:** Ebenen 6 → 7 → 8, jede dateidisjunkt geprüft. Nach Ebene 6 startet `/build` die lokale Supabase neu (`supabase stop` und `supabase start`, wegen `secure_password_change`) und spielt die neue Migration ein. `claim_mail_request` (T32) und sein Aufruf (T36) laufen parallel; der Vertrag steht deshalb in beiden Aufgaben: Parameter `p_email`, `p_ip`, Antwort `send` | `duplicate` | `limit`.
- **EC-3** (nur der neueste Link zum Zurücksetzen gilt) garantiert Supabase selbst. `/qa` prüft es ausdrücklich.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Sub-Agenten mit eigenem Git-Worktree. Danach führt der Haupt-Agent zusammen, prüft gegen die AC-IDs der Ebene und hakt hier ab. Sub-Agenten erklären sich nie selbst für fertig.
