# QA-Testergebnisse: PROJ-1 Registrierung & Login

**Getestet:** 2026-09-29
**App-URL:** http://localhost:3553 (`probe.kind: http`, Dev-Server `npm run dev`), lokale Supabase in Docker (API `127.0.0.1:55321`, Mailpit `127.0.0.1:55324`)
**Tester:** QA Engineer (AI). Prüfung in drei unabhängigen `qa-engineer`-Läufen (Abnahme, Security-Red-Team, Regression) ohne Kenntnis des Baus; zusammengeführt vom `/qa`-Owner
**Umfang:** `full` (erster QA-Lauf)

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
>
> **Umgebungshinweis:** Die laufende lokale Supabase war noch mit `site_url = http://localhost:3000` gestartet (`docker inspect supabase_auth_Petrilog` → `GOTRUE_SITE_URL`), während `supabase/config.toml:158,162` bereits auf 3553 steht (Commit 9939181). Mail-Links zeigten deshalb auf Port 3000, wo eine fremde App läuft. Für die Tests wurde der Host der Links auf 3553 umgeschrieben. Das ist kein Fehler des Features: Ein Neustart der lokalen Supabase (`supabase stop` und `supabase start`) behebt es.
>
> **Testdaten:** Jede Prüf-Lane nutzte einen eigenen `X-Forwarded-For`-Bereich (10.0.1.x / 10.0.2.x / 10.0.3.x) und eigene Adressen (`qa-acc-*`, `qa-sec-*`, `qa-reg-*@example.test`). Die Konten liegen noch in der lokalen DB. Unbestätigte Konten löscht der Aufräumjob nach 7 Tagen; ein `supabase db reset` räumt alles sofort ab.

### Automatisierte Tests (einmal vor dem Fan-out gelaufen)
- [x] Unit-Suite `npm test`: 2 Dateien, 26 bestanden, 0 fehlgeschlagen, exit 0 (vitest 4.1.11)
- [x] Produktions-Build `npm run build`: exit 0, TypeScript fehlerfrei, 11 Routen plus Proxy
- [x] Lint `npm run lint`: exit 0, keine Befunde
- [x] Neue Unit-Tests aus diesem QA-Lauf: 3 Dateien, 22 Tests, alle grün (`npx vitest run src/lib/auth/messages.test.ts src/app/auth/confirm/route.test.ts src/proxy.test.ts`). Siehe „Unit-Tests aus /qa“ unten

## Acceptance Criteria

#### Registrierung
- [x] **AC-1**: Registrierung mit „ QA-ACC-…@Example.TEST “ und „Angel1234“ ergibt `status: success`. In `auth.users` steht die Adresse kleingeschrieben mit `email_confirmed_at = null`, in Mailpit genau eine Mail „Bestätige deine E-Mail-Adresse für Petrilog“ an diese Adresse. Den Zustand „Prüfe dein Postfach“ mit Adresse rendert der Client (`register-form.tsx:36-40`, `check-email.tsx:36-39`); Darstellung siehe NOT VERIFIED.
- [x] **AC-2**: Hinweistext und Links zu `/login` und `/forgot-password` in `check-email.tsx:42-55`. „Mail erneut senden“ zur Laufzeit geprüft: „Mail gesendet“, zweite Mail in Mailpit.
- [x] **AC-3**: Bestätigungslink in einem frischen Cookie-Jar ergibt 307 auf `/` mit Auth-Cookie, `GET /` 200, `email_confirmed_at` gesetzt. Nach Rückdatieren von `confirmation_sent_at` auf −23 h 58 min funktioniert der Link noch.
- [x] **AC-4**: Trigger `on_auth_user_created` (`supabase/migrations/20260929120000_profiles.sql:25-44`). DB: 23 `qa-acc`-Konten und 23 Profile; eine Doppel-Registrierung ergibt 1 Profil.
- [x] **AC-5**: Direkte Server-Aufrufe ohne Browserprüfung: „kein-at“ ergibt einen Feldfehler bei der E-Mail, 7 Zeichen „…mindestens 8 Zeichen…“, 73 Zeichen „…höchstens 72 Zeichen…“. Jeweils kein Konto in `auth.users`. Eingaben bleiben stehen, weil `use-auth-action.ts:22-41` das Formular nicht zurücksetzt. Randfall siehe BUG-7.
- [x] **AC-6**: Registrierung einer bestätigten Adresse mit anderem Passwort ergibt `success` nach 517 ms. Weiterhin 1 Konto, `encrypted_password` und `updated_at` unverändert, keine neue Mail.

#### Login & Anmeldezustand
- [x] **AC-7**: Login ergibt `x-action-redirect: /` mit Auth-Cookie, `GET /` 200.
- [x] **AC-8**: Falsches Passwort und unbekannte Adresse ergeben beide „E-Mail oder Passwort ist falsch.“ (527 ms / 522 ms). Die E-Mail bleibt im Feld (`login-form.tsx:74-77`, kein Reset).
- [x] **AC-9**: Unbestätigtes Konto mit richtigem Passwort ergibt den Hinweis „Bitte bestätige zuerst …“ (`unconfirmed: true`), kein Auth-Cookie. „Mail erneut senden“ ergibt „Mail gesendet“ und eine Mail in Mailpit.
- [x] **AC-10**: Keine Sitzungs-Timebox und kein Inaktivitäts-Timeout (`supabase/config.toml:280-284` auskommentiert). Ein abgelaufenes Access-Token im Cookie ergibt `GET /account` 200; der Proxy schreibt ein neues Token (`src/proxy.ts:35`). Wochen realer Zeit wurden nicht abgewartet.
- [x] **AC-11**: Angemeldet ergeben `/login`, `/register` und `/forgot-password` jeweils 307 auf `/`. Zusätzlich abgesichert durch den Unit-Test `src/proxy.test.ts`.
- [x] **AC-12** (Code + SSR): `password-input.tsx:18,30-32` schaltet zwischen `type=text` und `type=password` um, mit `aria-pressed` und „Passwort anzeigen/verbergen“. Alle vier Passwortformulare nutzen die Komponente. Das Antippen selbst siehe NOT VERIFIED.

#### Zugriffsschutz
- [x] **AC-13**: Abgemeldet ergeben `/`, `/account`, `/account/export`, `/reset-password`, `/irgendwas`, `/ACCOUNT`, `/%61ccount`, `/account%2Fexport`, `/login/../account` und `/loginx` jeweils 307 auf `/login`, ohne Inhalt. Der Header `x-middleware-subrequest` und ein gefälschtes `sb-…-auth-token`-Cookie ergeben ebenfalls 307. Öffentliche Seiten antworten 200. Dazu der Unit-Test `src/proxy.test.ts` (Seiten mit ähnlichem Namen gelten nicht als öffentlich).
- [x] **AC-14**: REST mit dem Token von Nutzer B: `profiles` liefert nur Bs Zeile, `?id=eq.<A>` ergibt `[]`. PATCH, DELETE und POST auf A ergeben 403 `42501`, A bleibt unverändert. `auth_throttle_events` und `rpc/auth_account_state` ergeben 403. Gegenprobe per psql als Rolle `authenticated`. Policy `profiles_select_own` (`20260929120000_profiles.sql:18-22`); Grants: `authenticated` hat nur SELECT auf `profiles`.
- [x] **AC-15**: Anonym ergeben `profiles`, `auth_throttle_events` und `rpc/auth_account_state` jeweils `42501 permission denied`; `rpc/handle_new_user` ist nicht aufrufbar (`PGRST202`).

#### Passwort vergessen
- [x] **AC-16**: Bestehende und unbekannte Adresse erhalten denselben Text „Falls es ein Konto …“ (522 / 524 ms). Mailpit: 1 Mail für die bestehende Adresse, 0 für die unbekannte.
- [x] **AC-17**: Neuer Link führt zu `/reset-password`. Neues Passwort setzen leitet auf `/?notice=password-changed`, die Seite enthält „Passwort geändert“. Gegenprobe: altes Passwort ergibt 400, neues 200. Die 1-Stunden-Grenze: `recovery_sent_at` −61 min ergibt `/auth/link-expired?type=recovery` ohne Cookie, −59 min ergibt `/reset-password`. Dazu der Unit-Test `src/app/auth/confirm/route.test.ts`.
- [x] **AC-18**: Zweites Gerät nach dem Zurücksetzen: `GET /account` ergibt 307 auf `/login?notice=session-ended` (`account.ts:32` meldet mit `scope: 'others'` ab).

#### Konto-Seite
- [x] **AC-19**: `GET /account` 200 mit E-Mail als reinem Text (`account/page.tsx:29`), „Passwort ändern“, „Meine Daten exportieren“, „Konto löschen“, „Abmelden“ und dem Link „Datenschutz“.
- [x] **AC-20**: Passwort ändern mit richtigem aktuellem Passwort ergibt „Passwort geändert“. Gerät 1 bleibt angemeldet (200), Gerät 2 wird auf `/login?notice=session-ended` geleitet. Das alte Passwort wird abgelehnt, das neue gilt. Umgehung über `/reset-password` siehe BUG-3.
- [x] **AC-21**: Falsches aktuelles Passwort ergibt den Feldfehler „Das aktuelle Passwort ist falsch.“; das alte Passwort gilt weiter. Umgehung siehe BUG-3.
- [x] **AC-22** (Serverseite): Abmelden ergibt `x-action-redirect: /login`, das Auth-Cookie wird gelöscht, danach führt `/account` per 307 auf `/login`. Der Proxy setzt `Cache-Control: private, no-store` (Unit-Test `src/proxy.test.ts`). Der Dev-Server überschreibt das mit `no-cache, must-revalidate`. Die Zurück-Taste selbst siehe NOT VERIFIED.

#### Missbrauchsschutz
- [x] **AC-23**: 22 Fehlversuche gegen ein Konto: Versuche 1–5 ergeben „falsch“, ab Versuch 6 „Zu viele Versuche. Bitte versuche es in 15 Minuten erneut.“, auch mit dem richtigen Passwort. 30 parallele Fehlversuche: nur 1 Passwortprüfung, 29 `blocked` („erst eintragen, dann zählen“, `throttle.ts:69-80`). Fehlversuche auf −10 min zurückdatiert ergeben „in 5 Minuten“, auf −15 min 1 s ist der Login wieder möglich. Über die App erfüllt; Umgehung über die Supabase-Schnittstelle siehe BUG-2, Minutenangabe bei Parallelität siehe BUG-5.
- [x] **AC-24** (bei fester IP): 20 Fehlversuche von einer IP mit 20 Adressen, danach wird der 21. Versuch (andere Adresse, richtiges Passwort) gesperrt. **Mit wechselnder IP umgehbar, siehe BUG-1.**
- [x] **AC-25**: Pro Adresse werden 3 Mails zugelassen, die 4. ergibt „Bitte warte etwas …“ ohne Mail. Das gilt für bestehende und unbekannte Adressen, für „Passwort vergessen“, „Mail erneut senden“ und `/auth/link-expired`, auch mit wechselnder IP. Nach −61 min wieder möglich.
- [x] **AC-26** (bei fester IP): 6 Registrierungen von einer IP: 5 werden angelegt, die 6. ergibt „Zu viele Registrierungen …“. Die `signup`-Einträge speichern keine E-Mail. **Mit wechselnder IP bzw. direkt über Supabase umgehbar, siehe BUG-1 und BUG-2.**

#### Datenschutz
- [x] **AC-27** (Code): `delete-account-dialog.tsx:55-70` enthält den AlertDialog „Konto endgültig löschen?“, den Text „Dein Konto und alle Sessions, Fänge und Positionen werden sofort und endgültig gelöscht.“ und ein Passwortfeld. Das Öffnen selbst siehe NOT VERIFIED.
- [x] **AC-28**: Löschen mit richtigem Passwort leitet auf `/login?notice=account-deleted` und entfernt das Cookie. `auth.users`, `profiles`, `auth.sessions` und `auth.identities` enthalten danach 0 Zeilen. Die Login-Seite zeigt „Dein Konto wurde gelöscht.“, ein erneuter Login ergibt „E-Mail oder Passwort ist falsch.“
- [x] **AC-29**: `GET /account/export` 200 mit `application/json`, `Content-Disposition: attachment; filename=petrilog-export-2026-09-29.json` und `Cache-Control: private, no-store`. Inhalt: `format`, `version`, `exported_at`, `account` (email, created_at, email_confirmed_at, last_sign_in_at) und `profile` (id, created_at).
- [x] **AC-30**: `/privacy` abgemeldet 200. Der Link auf `/privacy` steht auf `/login`, `/register` und `/account` (SSR). `/register` enthält den Satz mit Link und keine Checkbox (0× `type="checkbox"`).
- [x] **AC-31**: cron-Job `petrilog-auth-throttle-cleanup` (`5 * * * *`) ist aktiv, ein Lauf ist als `succeeded` protokolliert. Manuell ausgeführt: ein Eintrag von −24 h 01 min wird gelöscht, einer von −23 h 59 min bleibt (`20260929120200_auth_cleanup_jobs.sql:7-11`).
- [x] **AC-32**: Job `petrilog-unconfirmed-accounts-cleanup` manuell ausgeführt: ein unbestätigtes Konto von −7 d 1 min wird samt Profil gelöscht, eines von −6 d 23 h bleibt. Dieselbe Adresse lässt sich danach neu registrieren.

## Edge Cases

- [x] **EC-1**: `confirmation_sent_at` −24 h 01 min ergibt `/auth/link-expired?type=signup` mit Meldung, Formular „Neue Mail anfordern“ und „Zum Login“. Die neue Mail kommt an und ihr Link funktioniert. Bei einem bestätigten Konto geht keine Mail raus. Ein schon benutzter Link ergibt ebenfalls `link-expired`.
- [x] **EC-2**: Ein benutzter Recovery-Link ergibt `/auth/link-expired?type=recovery` mit gleicher Meldung und Formular.
- [x] **EC-3**: Zwei Recovery-Mails im Abstand von 11 s: Der alte Link ergibt `link-expired` ohne Cookie, der neue `/reset-password`.
- [x] **EC-4**: Der Bestätigungslink funktioniert in einem fremden Cookie-Jar (angemeldet, `/`). Der Rückfall ohne Anmeldung (`route.ts:39` leitet auf `/login?notice=email-confirmed`) ist nur per Unit-Test `route.test.ts` belegt, über HTTP ließ er sich nicht provozieren.
- [ ] **EC-5**: **BUG-4.** Doppel-Tipp auf „Link senden“ (2 parallele Anfragen) ergibt 2 Recovery-Mails mit verschiedenen Tokens; eine davon führt auf „abgelaufen“. Registrierung erfüllt (1 Konto, 1 Mail; Garantie: unique index `users_email_partial_key`). Die Buttons sind während der Verarbeitung gesperrt (`register-form.tsx:94`, `login-form.tsx:106`, `forgot-password-form.tsx:71`).
- [!] **EC-6**: NOT VERIFIED zur Laufzeit. Supabase wurde nicht gestoppt, weil parallel geprüft wurde, und ein Verbindungsabbruch im Browser ist hier nicht darstellbar. Code: `use-auth-action.ts:26-31` zeigt „Keine Verbindung …“ im Warnton ohne Reset; `register.ts:41-43`, `session.ts:18-25` und `mail.ts:40-42` liefern `MESSAGES.network`.
- [x] **EC-7**: Registrierung mit „  QA-ACC-…@Example.TEST “ wird kleingeschrieben gespeichert, Login mit Großschreibung und Leerzeichen gelingt (`schemas.ts:11-16`).
- [x] **EC-8**: Zweite Registrierung einer unbestätigten Adresse mit anderem Passwort ergibt `success`, 1 Konto, `encrypted_password` unverändert und eine neue Bestätigungsmail. Auch direkt über `/auth/v1/signup` bleibt das erste Passwort gültig.
- [x] **EC-9**: Nach einem Passwortwechsel bzw. dem Löschen auf Gerät 1 führt auf Gerät 2 jede erste Aktion (`GET /account`, eine Server Action, `/account/export`) auf `/login?notice=session-ended`. `/login` mit altem Cookie ergibt 200, das Cookie wird gelöscht und der Hinweis ist sichtbar.
- [x] **EC-10**: Adresse durch 5 Fehlversuche gesperrt: Über einen neuen Recovery-Link ist der Nutzer auf `/reset-password` angemeldet, setzt ein neues Passwort und erreicht `/`.
- [x] **EC-11**: Falsches Passwort im Löschdialog ergibt „Das Passwort ist falsch.“; das Konto bleibt, die Zeile `login_attempt/failed` wird geschrieben. 3 falsche Löschversuche plus 2 falsche „aktuelles Passwort“ sperren den Login.
- [!] **EC-12**: NOT VERIFIED. Die Tabellen für Sessions und Fänge gibt es erst mit PROJ-2. Die Garantie für die vorhandenen Tabellen ist bestätigt: `profiles` hat `on delete cascade` (`pg_constraint confdeltype='c'`), und `deleteUser` löscht hart (0 Zeilen). Muss mit PROJ-2 erneut geprüft werden.

#### Zusätzliche, undokumentierte Edge Cases
- [ ] **UE-1**: Passwortwechsel ohne aktuelles Passwort über `/reset-password`, siehe **BUG-3**.
- [ ] **UE-2**: Paralleler Schwall von 10 Logins auf eine frische Adresse: alle 10 werden abgelehnt mit „15 Minuten“, der nächste Versuch geht aber sofort durch. Siehe **BUG-5**.
- [ ] **UE-3**: Zwei parallele Registrierungen derselben neuen Adresse: Die zweite zeigt „Keine Verbindung“ statt „Prüfe dein Postfach“. Siehe **BUG-6**.
- [ ] **UE-4**: Passwort unter 72 Zeichen, aber über 72 Bytes (z. B. 40 Umlaute): Die App lässt es durch, Supabase lehnt es ab, der Nutzer sieht „Keine Verbindung“. Siehe **BUG-7**.
- [x] **UE-5**: `/auth/confirm` mit `type=magiclink` oder ungültigem Token ergibt `link-expired`. Ein unbekannter `?notice=` (auch `<script>`) wird ignoriert und erscheint nicht im HTML. Login-Antwortzeiten liegen bei allen Ergebnissen, auch bei Sperre, über 500 ms.

## Security-Audit

- [x] **Authentifizierung:** Kein Zugriff ohne Anmeldung, siehe AC-13 (curl mit 10 Pfadvarianten, Umgehungs-Header, gefälschtes Cookie). Zweite Prüfung in jeder geschützten Seite: `require-user.ts:12-17` und `export/route.ts:9`.
- [x] **Autorisierung:** Kein Zugriff auf fremde Daten, siehe AC-14 und AC-15 (REST mit fremdem und anonymem Token, psql als `authenticated`). RLS ist auf beiden Tabellen an.
- [x] **Eingabeprüfung / Injection:** XSS- und SQL-Adressen (`"<script>…"@…`, `x'or'1'='1@…`, `x@…' --`) ergeben Feldfehler, 0 Treffer in `auth.users`. Typverwirrung (`{"$ne":null}`, Arrays) wird abgewiesen (`schemas.ts:31-58`). `?notice=` und `?type=` mit `<script>` erscheinen nicht im HTML.
- [!] **Rate Limiting auf gewöhnlichen Endpunkten** (`/account/export`): NOT VERIFIED, nicht umgesetzt (optional im MVP).
- [x] **Brute Force über die App:** Ein Konto wird nach 5 Fehlversuchen gesperrt (22 Versuche nacheinander und 30 parallel gefeuert, siehe AC-23). Die Passwortprüfungen bei „Passwort ändern“ und „Konto löschen“ zählen mit (EC-11).
- [ ] **BUG, Brute Force und Massen-Registrierung an der App-Bremse vorbei:** siehe BUG-1 (gefälschte IP) und BUG-2 (direkt über Supabase).
- [x] **Keine Account-Enumeration:** Login (gleicher Text, 513–566 ms gegen 516–524 ms), Registrierung (AC-6, 524 / 519 ms), „Passwort vergessen“ (532 / 524 ms) und die Sperrmeldung (508–523 ms) verraten nicht, ob ein Konto existiert. Die 500-ms-Untergrenze steht in `min-duration.ts:12-19`.
- [x] **Keine Zugangsdaten in der URL:** Alle Formulare (`/login`, `/register`, `/forgot-password`, `/auth/link-expired`) rendern `method="post"` und schicken per Server Action ab (curl über das SSR-HTML).
- [x] **Keine Geheimnisse im Client-Bundle:** `.next/static` (Produktions-Build) und die ausgelieferten Chunks enthalten weder `SUPABASE_SERVICE_ROLE_KEY` noch `sb_secret_` noch die Service-Role-Kennung. Der Server-Schlüssel hat kein `NEXT_PUBLIC_`; `admin.ts:5` nutzt `server-only`.
- [x] **Keine sensiblen Daten in Antworten:** Die Actions liefern nur `status`, `message` und `fieldErrors`. Der Export enthält nur die eigenen Daten (`export/route.ts:9-15`, siehe AC-29).
- [x] **Passwörter nie im Klartext:** `auth.users.encrypted_password` ist bcrypt (`$2a$`, 60 Zeichen). In `auth_throttle_events` stehen keine Passwörter. Im Dev-Server-Log und in den Docker-Logs von auth, kong und db kommt das Test-Passwort 0-mal vor (`next.config.ts:8`: `logging.serverFunctions: false`).
- [x] **Sicherheits-Header:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin` und `Strict-Transport-Security: max-age=31536000; includeSubDomains` auf allen Routen, auch auf 307 und 404 (`curl -D -`, `next.config.ts:10-19`).
- [x] **Cookies:** Abgemeldete Seiten setzen kein Cookie; kein Tracking oder Analytics im Code. Hinweis: `@supabase/ssr` setzt das Auth-Cookie standardmäßig ohne `httpOnly`. Das ist Verhalten der Bibliothek, kein Bug.
- [x] **`[user]`-Aufgabe T8** (Server-Schlüssel in `.env.local`): In `tasks.md` noch **nicht abgehakt**. Zur Laufzeit ist der Schlüssel aber nachweislich gesetzt und wirksam: Die Bremse schreibt `auth_throttle_events`, und `auth.admin.deleteUser` löscht. Die Schutzfunktion fehlt also nicht, nur der Haken. **Bitte T8 in `tasks.md` abhaken.** Nicht als Bug gezählt.
- [!] **`[user go-live]` T25–T31:** NOT VERIFIED, go-live; wird in `/deploy` gemacht und geprüft. Die zugehörigen AC wurden oben gegen die lokale Supabase geprüft.

## Unit-Tests aus /qa

Neu, jeweils neben dem Quellcode:
- `src/lib/auth/messages.test.ts` (7 Tests): Minutenangabe der Sperre (Aufrunden, mindestens 1, Einzahl), erlaubte `?notice=`-Codes (keine geerbten Objekt-Schlüssel, keine Arrays), die wörtlich festgelegten Meldungen der Spec.
- `src/app/auth/confirm/route.test.ts` (8 Tests): erlaubte Link-Typen, 1-Stunden-Grenze beim Zurücksetzen mit Abmeldung, Rückfall `email-confirmed` (EC-4), Token nie im Weiterleitungsziel.
- `src/proxy.test.ts` (7 Tests): öffentliche und geschützte Adressen, Seiten mit ähnlichem Namen, Weiterleitung Angemeldeter, `no-store`, Aufräumen eines Cookies, dessen Sitzung anderswo beendet wurde.

**Fehlschlag-Probe (Red-Check):** Für jede Datei wurden die geprüften Stellen im Code gezielt kaputt gemacht, die Datei allein ausgeführt und der Code danach wiederhergestellt (`git diff` danach leer). Die Runde lief in zwei Durchgängen, bis jeder der 22 Tests mindestens einmal rot war:
- `messages.test.ts`: 7/7 rot, nach Änderungen an Aufrundung, Mindestwert, Schlüssel-Prüfung, Meldungstext, Liste der Codes und Behandlung von Arrays.
- `route.test.ts`: 8/8 rot, nach Änderungen an Laufzeit, erlaubten Typen, Abmeldung, Typ auf der Ablaufseite, Rückfall-Ziel und Übernahme des Tokens.
- `proxy.test.ts`: 7/7 rot, nach Änderungen an Präfix-Abgleich, `no-store`, Cookie-Aufräumen, Query-Übernahme, öffentlicher Liste und Liste nur für Abgemeldete.

## E2E-Tests
- Status: **nicht gelaufen** (für kritische Abläufe `/e2e-tests` ausführen). Es gibt noch kein `tests/`-Verzeichnis.

## Regression
- [!] Deployte Features: NOT VERIFIED. Kein Feature hat den Status Deployed; die Zeile unter „Deployments“ in `features/INDEX.md` ist das Vorlagen-Beispiel.
- [x] Migrationen: `npx supabase migration list --local` zeigt alle 3 angewendet. Der Inhalt in `schema_migrations` stimmt mit den Dateien überein. Tabellen, RLS, Policies, Grants, Funktionen (`SECURITY DEFINER`, `search_path=""`, EXECUTE nur für `service_role`), Trigger, Indizes und cron-Jobs sind vorhanden.
- [x] Alle Routen aus `design.md`, abgemeldet und angemeldet: keine 5xx. Das Dev-Server-Log enthält keine Fehlerzeilen.
- [x] Gemeinsame Teile: `<html lang="de">`, die Schriften Barlow, Zilla Slab und IBM Plex Mono, deutsche Titel „… · Petrilog“. Die Design-Tokens in `globals.css:127-145,173-191` entsprechen `docs/design-system.md`. Die Startseite ist ein Platzhalter ohne Next.js-Demo.
- [x] Kernablauf Ende-zu-Ende per HTTP: registrieren, Mail, bestätigen, Export, abmelden, anmelden, falsches Passwort. Es entsteht genau 1 Profil.

## Nicht geprüft in diesem Lauf

- [!] Browser-übergreifende Darstellung (Chrome / Firefox / Safari): `/qa` läuft ohne Browser; nur `/e2e-tests` deckt das ab.
- [!] Responsives Layout (375 / 768 / 1440 px), Dunkelmodus, Wald-Hintergrund, Daumenbereich: braucht einen echten Viewport.
- [!] Reine Client-Interaktionen: „Passwort anzeigen“ antippen (AC-12), Löschdialog öffnen (AC-27), sichtbarer Zustand „Prüfe dein Postfach“ (AC-1, AC-2), Toast „Passwort geändert“ (AC-17). Belegt sind sie nur über Code und SSR.
- [!] Zurück-Taste nach dem Abmelden (AC-22): braucht einen Browser. Im Produktionsbetrieb (`next start`) wurde der `Cache-Control`-Header nicht gemessen.
- [!] Mobile Tastatur und Autofill am Gerät: `inputMode`, `autoComplete` und `autoCapitalize` stehen im HTML, wirken aber nur auf einem echten Gerät.
- [!] EC-6 (Server nicht erreichbar): nur Code geprüft, siehe oben.
- [!] EC-12 (laufende Session wird mitgelöscht): erst mit PROJ-2 prüfbar.
- [!] Browser-Konsole und Netzwerk-Tab: brauchen DevTools.
- [!] Rate Limiting auf `/account/export`: nicht umgesetzt (optional).
- [!] `[user go-live]` T25–T31: werden in `/deploy` gemacht und geprüft.

## Bugs

#### BUG-1: IP-Grenzen lassen sich mit gefälschtem `X-Forwarded-For` umgehen
- **Severity:** High
- **Betrifft:** AC-24, AC-26
- **Schritte:**
  1. 24 Login-Versuche mit einem Passwort gegen 24 verschiedene Adressen schicken, jede Anfrage mit einem anderen `X-Forwarded-For` (10.0.2.101 … 124).
  2. Erwartet: ab dem 21. Versuch „Zu viele Versuche …“ (Grenze pro IP).
  3. Tatsächlich: 24-mal „E-Mail oder Passwort ist falsch.“, nie eine Sperre. Die Registrierung verhält sich genauso: 8 von 8 kamen durch, die Grenze wäre bei 5.
- **Ursache:** `src/lib/auth/client-ip.ts:7-8` übernimmt den ersten Eintrag von `x-forwarded-for` bzw. `x-real-ip` ungeprüft; `auth_throttle_events.ip` speichert genau den gefälschten Wert. Damit sind Credential Stuffing (ein Passwort gegen viele Konten) und Massen-Registrierung über die App unbegrenzt. Die Sperre pro Adresse (AC-23) greift weiterhin. `design.md:305` nennt das Risiko „beim Hosting prüfen“, aber die App ist schon jetzt über jedes Gerät im Netzwerk erreichbar, und die Regel gilt unabhängig vom Hosting.
- **Priorität:** vor Approved beheben (`/build`). Zum Beispiel den Header nur auswerten, wenn ein vertrauenswürdiger Proxy konfiguriert ist.

#### BUG-2: Login-Bremse und Registrierungs-Grenze lassen sich über die Supabase-Schnittstelle direkt umgehen
- **Severity:** High
- **Betrifft:** AC-23, AC-24, AC-26
- **Schritte:**
  1. Eine Adresse über die App sperren (5 Fehlversuche).
  2. `curl -X POST "http://127.0.0.1:55321/auth/v1/token?grant_type=password" -H "apikey: <öffentlicher Schlüssel>" -d '{"email":"<gesperrte Adresse>","password":"x"}'` in einer Schleife ausführen.
  3. Erwartet: keine weiteren Passwortprüfungen für diese Adresse.
  4. Tatsächlich: jedes Mal `400 invalid_credentials`, also eine echte Passwortprüfung. Ebenso legt `POST /auth/v1/signup` Konten ohne die Registrierungs-Grenze an.
- **Ursache:** Die Bremse sitzt nur in der App. Auf dem direkten Weg schützt nur Supabases Grenze pro IP (`sign_in_sign_ups = 100` pro 5 Minuten, lokal bewusst hoch gesetzt). Die gilt nicht pro Konto und nicht gegen verteilte Angriffe.
- **Einordnung:** Die Lücke ist bekannt und in der Spec als offene Frage vermerkt („vor dem ersten Hosting … zusammen mit dem CAPTCHA klären“). Sie ist also kein Versehen, aber offen. Die Behebung (CAPTCHA von Supabase, das auch direkte Aufrufe verlangt, oder ein anderer Mechanismus) liegt außerhalb des heutigen Vertrags und braucht `/refine PROJ-1`.
- **Priorität:** spätestens vor dem ersten `/deploy` (`/refine PROJ-1`, dann `/build`).

#### BUG-3: Passwort lässt sich über `/reset-password` ohne das aktuelle Passwort ändern
- **Severity:** Medium
- **Betrifft:** AC-20, AC-21, EC-11 (Absicht der Produktentscheidung „fremde Hände am entsperrten Handy“)
- **Schritte:**
  1. Normal anmelden (nicht über einen Link aus der Mail).
  2. `/reset-password` öffnen und ein neues Passwort speichern.
  3. Erwartet: Ein Passwortwechsel verlangt das aktuelle Passwort (AC-21).
  4. Tatsächlich: Weiterleitung auf `/?notice=password-changed`, das neue Passwort gilt, alle anderen Geräte sind abgemeldet. Die Prüfung des aktuellen Passworts und die Bremse werden umgangen.
- **Ursache:** `setNewPassword` (`account.ts:37-51`) verlangt nur irgendeine Sitzung; `design.md:227` erlaubt ausdrücklich „regulär angemeldet“. Zusätzlich erlaubt `secure_password_change = false` in `supabase/config.toml`, das Passwort per `PUT /auth/v1/user` ohne das alte zu ändern. Der Besitzer kommt über „Passwort vergessen“ wieder ins Konto, deshalb Medium.
- **Priorität:** vor dem Deployment beheben. Zum Beispiel `/reset-password` nur mit einer Anmeldung aus dem Link in der Mail zulassen.

#### BUG-4: Doppel-Tipp auf „Link senden“ verschickt zwei Mails zum Zurücksetzen, eine davon ist sofort ungültig
- **Severity:** Medium
- **Betrifft:** EC-5
- **Schritte:**
  1. Zwei gleichzeitige `requestPasswordReset`-Anfragen für dieselbe bestätigte Adresse schicken.
  2. Erwartet: höchstens eine Mail.
  3. Tatsächlich: 2 Mails im Abstand von 2 ms mit verschiedenen Tokens. Weil nur der neueste Link gilt (EC-3), führt einer davon auf „abgelaufen“.
- **Ursache:** Supabases Mindestabstand von 10 s greift bei gleichzeitigen Anfragen nicht. Über die Oberfläche selten, weil der Button während der Verarbeitung gesperrt ist.
- **Priorität:** in der nächsten Runde beheben.

#### BUG-5: Die Minutenangabe der Sperre stimmt bei parallelen Anfragen nicht
- **Severity:** Low
- **Betrifft:** AC-23
- **Schritte:**
  1. 10 gleichzeitige Login-Versuche auf eine frische Adresse schicken.
  2. Tatsächlich: Alle 10 erhalten „in 15 Minuten“, der nächste Versuch geht aber sofort durch, weil `blocked` nicht zählt. Bei 30 parallelen Versuchen meldeten 7 „in 16 Minuten“.
- **Ursache:** `throttle.ts:86-94` rechnet die Wartezeit vom jüngsten `pending`-Eintrag, auch von einem mit späterem Zeitstempel. Der Schutz selbst ist nicht geschwächt, nur die Anzeige ist falsch.

#### BUG-6: Zwei gleichzeitige Registrierungen derselben neuen Adresse zeigen „Keine Verbindung“
- **Severity:** Low
- **Betrifft:** EC-5, AC-1
- **Tatsächlich:** Die zweite Antwort ist „Keine Verbindung. Bitte versuche es erneut.“ statt „Prüfe dein Postfach“. Dev-Log: `AuthRetryableFetchError 500 Database error saving new user`. `register.ts:35` fängt nur `user_already_exists` ab. Es entsteht trotzdem nur ein Konto. Über die UI kaum auslösbar, weil der Button gesperrt ist.

#### BUG-7: Passwörter mit mehr als 72 Bytes (Umlaute, Emojis) ergeben „Keine Verbindung“
- **Severity:** Low
- **Betrifft:** AC-5
- **Schritte:**
  1. Mit einem Passwort aus 40 × „ä“ registrieren (40 Zeichen, 80 Bytes).
  2. Erwartet: eine verständliche Fehlermeldung am Feld.
  3. Tatsächlich: Die App-Prüfung zählt Zeichen und lässt es durch. Supabase lehnt ab (`400 validation_failed: Password cannot be longer than 72 characters`, direkt gegen `/auth/v1/signup` geprüft), `register.ts:35,41-43` wirft den Fehler weiter, und der Nutzer sieht „Keine Verbindung“. Dabei wird ein Registrierungs- und Mail-Kontingent verbraucht.
- **Ursache:** `newPasswordSchema` in `schemas.ts` prüft die Länge in Zeichen, bcrypt begrenzt auf 72 Bytes.

#### BUG-8: Englische Texte in Randfällen
- **Severity:** Low
- **Betrifft:** Technische Anforderung „Alle Texte … auf Deutsch“
- **Tatsächlich:**
  - Ein fehlerhafter Aufruf einer Server Action (`register(null)`, `login([])`) liefert die rohe Zod-Meldung „Invalid input: expected object, received null“. Über das Formular nicht erreichbar.
  - Eine unbekannte Adresse zeigt angemeldeten Nutzern die Next.js-Standardseite „404: This page could not be found.“

## Zusammenfassung
- **Acceptance Criteria:** 32/32 bestanden, 4 davon nur über Code bzw. SSR belegt (AC-12, AC-27, AC-1/AC-2 Darstellung). AC-23, AC-24 und AC-26 bestehen über die App, **sind aber umgehbar (BUG-1, BUG-2)**
- **Edge Cases:** 9/12 bestanden, 1 fehlgeschlagen (EC-5), 2 nicht geprüft (EC-6, EC-12)
- **Bugs:** 8 insgesamt (0 Critical, 2 High, 2 Medium, 4 Low)
- **Security:** 12 Prüfpunkte belegt, 2 NOT VERIFIED (Rate Limiting auf gewöhnlichen Endpunkten, go-live), 2 High-Befunde (BUG-1, BUG-2)
- **Produktionsreif:** **NEIN**
- **Empfehlung:** Zuerst BUG-1 beheben (`/build`, im heutigen Vertrag lösbar). Zu BUG-2 entscheiden: `/refine PROJ-1` mit CAPTCHA jetzt, oder als bekannte Lücke festhalten, die vor dem ersten `/deploy` geschlossen sein muss. BUG-3 vor dem Deployment beheben.

> „Produktionsreif: JA“ hieße nur: keine Critical/High-Bugs. Es hieße nicht, dass alles geprüft wurde. Die NOT-VERIFIED-Punkte oben brauchen einen Menschen oder `/e2e-tests`.
