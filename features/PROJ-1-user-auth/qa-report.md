# QA-Testergebnisse: PROJ-1 Registrierung & Login

**Getestet:** 2026-09-29 (Runde 2)
**App-URL:** http://localhost:3553 (`probe.kind: http`, Dev-Server `npm run dev`). Für die Produktionsprüfungen lief zusätzlich `next start` des aktuellen Builds auf http://localhost:3556. Die lokale Supabase lief in Docker (API `127.0.0.1:55321`, Mailpit `127.0.0.1:55324`).
**Tester:** QA Engineer (AI). Geprüft haben drei unabhängige `qa-engineer`-Läufe (Abnahme, Security-Red-Team, Regression), die den Bau nicht kannten. Der `/qa`-Owner hat die Ergebnisse zusammengeführt.
**Umfang:** `full`. Das ist keine Re-Verifikation: Seit dem letzten Bericht (Commit eb639e6) kam `/refine PROJ-1` (627777d) mit neuen Kriterien AC-33, AC-34 und EC-13 sowie geschärften AC-24 und AC-26. Der Diff `git diff --stat eb639e6..HEAD -- src supabase` berührt 21 Dateien, darunter Auth, Bremse und eine neue Migration.

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)
>
> **Ablauf wegen gemeinsamer IP:** Lokal ist `TRUSTED_CLIENT_IP_HEADER` leer. Deshalb zählen alle Anfragen in denselben IP-Topf (`ip = 'untrusted'`). Parallele Lanes hätten sich gegenseitig gesperrt. Darum liefen Abnahme und Regression zuerst parallel und ohne die IP-Grenzen. Danach lief die Security-Lane allein und prüfte auch AC-24 und AC-26. Vor jeder Phase wurde `auth_throttle_events` geleert (nur lokale Testdaten).
>
> **Testdaten:** Adressen `qa2-acc-*`, `qa2-sec-*` und `qa2-reg-*@example.test`. Die Security-Lane hat ihre Konten gelöscht. Rund 19 `qa2-acc-*`-Konten und das Konto `qa2-reg-journey-…` liegen noch in der lokalen DB. `auth_throttle_events` ist am Ende leer.

### Automatisierte Tests (einmal vor dem Fan-out gelaufen)
- [x] Unit-Suite `npm test`: 7 Dateien, 76 bestanden, 0 fehlgeschlagen, exit 0 (vitest 4.1.11).
- [x] Produktions-Build `npm run build`: exit 0, TypeScript fehlerfrei, 11 Routen plus Proxy.
- [x] Lint `npm run lint`: exit 0.
- [x] Neuer Unit-Test aus diesem Lauf: `npx vitest run src/lib/auth/password-check.test.ts` ergibt 10/10 grün. Siehe „Unit-Tests aus /qa“.
- [x] Migrationen: `npx supabase migration list --local` zeigt alle 4 angewendet. Der Inhalt in `schema_migrations` ist per md5 identisch mit den Dateien. Die drei älteren Migrationen sind seit 23ef865 unverändert.

## Acceptance Criteria

#### Registrierung
- [x] **AC-1**:
  - Die Action `register` antwortet nach 534 ms mit `success`. In der DB steht 1 unbestätigtes Konto, in Mailpit 1 Mail „Bestätige deine E-Mail-Adresse für Petrilog“.
  - Grenzwert: 36 × „ä“ (72 Bytes) wird angenommen.
  - Den Zustand „Prüfe dein Postfach“ rendert der Client (`register-form.tsx:36-40`, `check-email.tsx:36-40`). Wie er aussieht, ist nicht geprüft.
- [x] **AC-2**: Hinweistext und die Links auf `/login` und `/forgot-password` stehen in `check-email.tsx:41-55`. `resendConfirmation` antwortet zur Laufzeit „Mail gesendet“, die Mail kommt an.
- [x] **AC-3**:
  - Der Link in einem frischen Cookie-Jar ergibt 307 auf `/` mit Auth-Cookie, danach `GET /` 200 mit „Petri Heil!“.
  - `confirmation_sent_at` auf −23 h zurückdatiert: `/`. Auf −25 h: `/auth/link-expired?type=signup`.
- [x] **AC-4**:
  - Pro Konto entsteht genau 1 Profil (Join-Abfrage). Trigger: `20260929120000_profiles.sql:25-44`.
  - Regression: Ein Konto über die Admin-API angelegt ergibt 1 Profil, gelöscht 0 Profile.
- [x] **AC-5**:
  - Direkte Action-Aufrufe ohne Browserprüfung ergeben den Feldfehler „Bitte gib eine gültige E-Mail-Adresse ein.“ bzw. „… mindestens 8 Zeichen …“. Es entsteht kein Konto und keine Throttle-Zeile.
  - Die Eingaben bleiben stehen: kein Reset in `use-auth-action.ts:22-41`.
- [x] **AC-6**: Registrierung einer bestätigten Adresse mit anderem Passwort ergibt `success` (519 ms). Danach: 1 Konto, `encrypted_password` unverändert, 0 Mails, Login mit dem alten Passwort gelingt. Nebenkanal über Cookies: siehe **BUG-9**.
- [x] **AC-34**:
  - Registrierung mit 37 × „ä“ (74 B), 19 × 🎣 (76 B) und 73 ASCII-Zeichen ergibt jeweils „Das Passwort ist zu lang. Erlaubt sind 72 Zeichen, …“. Kein Konto, keine Mail, 0 Throttle-Zeilen.
  - Genauso bei `setNewPassword` (76 B) und `changePassword` (74 B), ohne Zeile `login_attempt`.
  - Die Prüfung läuft vor jeder Grenze: `register.ts:17-18`, `account.ts:78-79`.

#### Login & Anmeldezustand
- [x] **AC-7**: Login ergibt `x-action-redirect: /;push` mit Session-Cookie, danach `/` 200 (Abnahme- und Regressions-Lane).
- [x] **AC-8**:
  - Unbekannte Adresse und falsches Passwort ergeben beide „E-Mail oder Passwort ist falsch.“ (≈ 560 ms). Das E-Mail-Feld wird nicht zurückgesetzt (`login-form.tsx:21-25`).
  - Ein bestehendes Passwort über 72 Bytes wird ohne Anfrage an Supabase als falsch gewertet und zählt mit (`password-check.ts:27-31`, Unit-Test).
- [x] **AC-9**: Unbestätigtes Konto mit richtigem Passwort ergibt „Bitte bestätige zuerst …“ (`unconfirmed:true`) ohne Cookie. Mit falschem Passwort kommt die neutrale Meldung. „Mail erneut senden“ (`login-form.tsx:50-54`) liefert eine Mail.
- [x] **AC-10**:
  - Das Cookie hat `Max-Age=34560000`. `supabase/config.toml:282-286` setzt keine Timebox und kein Inaktivitäts-Timeout.
  - Ablauf im Cookie −10 Tage: `GET /account` 200, der Proxy stellt ein neues Token aus (`src/proxy.ts:35`).
  - Wochen realer Zeit wurden nicht abgewartet.
- [x] **AC-11**: Angemeldet ergeben `/login`, `/register` und `/forgot-password` 307 auf `/`.
- [!] **AC-12**: NOT VERIFIED. „Passwort anzeigen“ antippen ist eine reine Client-Interaktion, und es gibt keinen Browser. Der Code stimmt: `password-input.tsx:13-33`, eingesetzt in allen 5 Passwortfeldern.

#### Zugriffsschutz
- [x] **AC-13**:
  - Abgemeldet ergeben `/`, `/account`, `/ACCOUNT`, `/%61ccount`, `/account;x`, `/login/../account` (`--path-as-is`), `/account/export`, `/reset-password`, `?_rsc=1`, `/irgendwas` und `/api/x` jeweils 307 auf `/login`.
  - Ebenso mit `x-middleware-subrequest`, `RSC: 1`, einem kaputten Cookie, einem JWT mit `alg:none` und einem JWT mit falschem Schlüssel.
  - Die öffentlichen Seiten antworten mit 200.
- [x] **AC-14**:
  - Mit dem Token von B liefert `profiles` nur die eigene Zeile, `id=eq.<A>` liefert `[]`. PATCH, DELETE und POST ergeben 403 (42501).
  - `auth_throttle_events`, `rpc/auth_account_state`, `rpc/claim_mail_request` und `/auth/v1/admin/users` ergeben 403.
  - In der DB: Policy `profiles_select_own` (`auth.uid() = id`), RLS auf beiden Tabellen, `authenticated` hat nur SELECT.
- [x] **AC-15**: Anonym ergeben `profiles`, `auth_throttle_events` und beide RPCs 401 bzw. `permission denied`. `pg_graphql` ist nicht aktiviert.

#### Passwort vergessen
- [x] **AC-16**: Bestehende und unbekannte Adresse erhalten denselben Text (553 / 537 ms). Mailpit: 1 Mail für die bestehende, 0 für die unbekannte.
- [x] **AC-17**:
  - Der neueste Link ergibt `/reset-password` (200), die Freigabe gilt 15 min und hängt an der Sitzung.
  - `setNewPassword` führt auf `/?notice=password-changed`. Danach wird das alte Passwort abgelehnt, das neue gilt, die Freigabe ist entfernt.
  - Das gleiche Passwort wie bisher ergibt eine Meldung und lässt die Freigabe bestehen.
  - `recovery_sent_at` −61 min: `/auth/link-expired?type=recovery`, ohne Cookie und ohne Freigabe.
- [x] **AC-18**: Nach dem Zurücksetzen auf Gerät B ergibt `GET /account` auf Gerät A 307 auf `/login?notice=session-ended`.
- [x] **AC-33**:
  - Regulär angemeldet, während für ein anderes Gerät eine Freigabe existiert: `GET /reset-password` führt auf `/account`, `POST setNewPassword` ebenfalls. Das Passwort bleibt unverändert.
  - Die Freigabe ist nicht fälschbar (`PUT /auth/v1/user {app_metadata}` ergibt 403 `not_admin`), an die Sitzung gebunden und nur einmal nutzbar.
  - Abgemeldet: 307 auf `/login`.
  - Code: `reset-password/page.tsx:15-21`, `account.ts:44-56`, `reset-grant.ts:36-45`.
  - Direkter Weg an der App vorbei: siehe **BUG-10**.

#### Konto-Seite
- [x] **AC-19**: Das HTML von `/account` enthält die E-Mail als reinen Text sowie „Passwort ändern“, „Meine Daten exportieren“, „Konto löschen“, „Abmelden“ und „Datenschutz“.
- [x] **AC-20**: Mit einer Sitzung, die 25 h zurückdatiert ist, ergibt `changePassword` „Passwort geändert“. Gerät A bleibt angemeldet (200), Gerät B landet auf `/login?notice=session-ended`. Das alte Passwort wird abgelehnt, das neue gilt.
- [x] **AC-21**: Ein falsches aktuelles Passwort ergibt den Feldfehler „Das aktuelle Passwort ist falsch.“ und eine Zeile `failed`. Das alte Passwort bleibt gültig.
- [x] **AC-22** (Serverseite):
  - Logout ergibt 303 auf `/login`, die Cookies sind gelöscht. Ein altes Cookie führt auf `/login?notice=session-ended`, der Refresh-Token ist widerrufen.
  - Der Produktionsserver (`:3556`) liefert `Cache-Control: private, no-store` für `/`, `/account`, `/account/export` und `/reset-password`. `no-cache, must-revalidate` kam nur vom Dev-Server.
  - Die Zurück-Taste selbst: siehe NOT VERIFIED.

#### Missbrauchsschutz
- [x] **AC-23**:
  - Nach 5 Fehlversuchen wird der 6. Versuch mit richtigem Passwort abgelehnt: „… in 15 Minuten erneut.“
  - 22 Versuche nacheinander: ab Versuch 6 gesperrt. 30 parallele: 1 Passwortprüfung, 29 `blocked`.
  - Zurückdatiert: nach 10 min „5 Minuten“, nach 14,5 min „1 Minute“, nach 15,1 min ist der Login wieder möglich.
  - Die Minutenangabe bei parallelen Anfragen stimmt nicht immer, siehe **BUG-13**.
- [x] **AC-24**:
  - 25 Fehlversuche mit 25 Adressen, jede Anfrage mit einem anderen gefälschten IP-Header (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP`, `Forwarded`, `X-Vercel-Forwarded-For` u. a.). Versuche 1–20 ergeben „falsch“, ab 21 „Zu viele Versuche …“, auch mit richtigem Passwort.
  - In der DB stehen nur `ip=untrusted`-Zeilen, kein gefälschter Wert (`client-ip.ts:13-14`).
  - Mit gesetztem `TRUSTED_CLIENT_IP_HEADER`: siehe NOT VERIFIED.
- [x] **AC-25**:
  - Unbekannte Adresse über „Passwort vergessen“, „Mail erneut senden“ und „Neue Mail anfordern“: 3 × Erfolg, danach „Bitte warte etwas, …“.
  - Bestehende Adresse mit echten 11-s-Pausen: 3 Mails, die 4. Anfrage ergibt die Wartemeldung.
  - Die Meldung ist unabhängig davon, ob es ein Konto gibt, auch bei der Registrierung.
- [x] **AC-26**:
  - 8 Registrierungen mit abwechselnd gefälschtem `X-Forwarded-For` und `X-Real-IP`: 1–5 `success`, 6–8 „Zu viele Registrierungen. …“. In `auth.users` stehen genau 5 Konten.
  - Die Zeilen `signup` liegen unter `untrusted` und enthalten keine E-Mail.

#### Datenschutz
- [x] **AC-27** (Code): `delete-account-dialog.tsx:55-69` enthält den Warntext „Dein Konto und alle Sessions, Fänge und Positionen werden sofort und endgültig gelöscht …“ und ein Passwortfeld. Das Öffnen per Tipp: siehe NOT VERIFIED.
- [x] **AC-28**:
  - Löschen führt auf `/login?notice=account-deleted`, die Cookies sind leer.
  - `auth.users`, `profiles`, `auth.sessions` und `auth.identities` enthalten 0 Zeilen.
  - Die Login-Seite zeigt „Dein Konto wurde gelöscht.“. Der Login mit den alten Daten ergibt „E-Mail oder Passwort ist falsch.“
- [x] **AC-29**:
  - `/account/export` antwortet 200 mit `application/json`, `attachment; filename="petrilog-export-2026-09-29.json"` und `private, no-store`.
  - Inhalt: `format`, `version`, `exported_at`, `account` (email, created_at, email_confirmed_at, last_sign_in_at) und `profile` (id, created_at).
  - Abgemeldet: 307 auf `/login`.
- [x] **AC-30**: Die Links auf `/privacy` stehen auf `/login`, `/register` und `/account`. `/privacy` ist abgemeldet mit 200 erreichbar. `/register` enthält den Satz mit Link und keine Checkbox.
- [x] **AC-31**:
  - Der Job `petrilog-auth-throttle-cleanup` (`5 * * * *`) lief um 21:05 UTC mit `succeeded`.
  - Sein Befehl in einer Transaktion mit ROLLBACK: Die Zeile von −25 h wird gelöscht, die von −23 h bleibt.
  - Laut Design können Einträge bis zu 1 h länger leben.
- [x] **AC-32**: Der planmäßige Lauf von `petrilog-unconfirmed-accounts-cleanup` um 21:15 UTC löschte das 8 Tage alte unbestätigte Konto samt Profil, das 6 Tage alte blieb. Die Adresse ließ sich danach neu registrieren.

## Edge Cases

- [x] **EC-1**: Ein benutzter Link und ein Link für ein bereits bestätigtes Konto ergeben `/auth/link-expired?type=signup` mit Meldung, dem Formular „Neue Mail anfordern“ und „Zum Login“.
- [x] **EC-2**: Ein wiederverwendeter Link zum Zurücksetzen ergibt `?type=recovery` mit derselben Meldung und einem Formular.
- [x] **EC-3**: Zwei Anforderungen im Abstand von 11 s: Der ältere Link ergibt `link-expired`, der neueste `/reset-password`.
- [x] **EC-4**: Der Link in einem frischen Cookie-Jar bestätigt das Konto und meldet an. Der Rückfall ohne Anmeldung (`route.ts:52` auf `/login?notice=email-confirmed`) ließ sich über HTTP nicht auslösen. Er ist über den Unit-Test `route.test.ts` belegt. Nebenwirkung: siehe **BUG-12**.
- [x] **EC-5**: Das ist ein Timing-EC, deshalb wurde die Garantie im Code bestätigt:
  - Sperre pro Adresse: `20260929130000_mail_release.sql:27`.
  - 10-s-Fenster für Doppelanfragen: Zeilen 29-35.
  - Eindeutiger Index `users_email_partial_key`.
  - Erneute Statusabfrage bei einem Fehler: `register.ts:36-39`.
  - Zur Laufzeit:
    - 2 bzw. 3 parallele Registrierungen einer neuen Adresse: alle `success`, 1 Konto, 1 Mail.
    - 2 parallele „Link senden“: 1 Mail.
    - 3 parallele „Mail erneut senden“: 1 Mail.
  - Die Buttons sind während der Verarbeitung gesperrt (`register-form.tsx:94`, `forgot-password-form.tsx:71`, `login-form.tsx:106`).
- [!] **EC-6**: NOT VERIFIED zur Laufzeit. Supabase durfte nicht gestoppt werden, und ein Verbindungsabbruch im Browser lässt sich hier nicht darstellen.
  - Code: `use-auth-action.ts:26-31` (Warn-Notice, kein Reset). Die Actions liefern `MESSAGES.network` (`register.ts:45-48`, `mail.ts:41-44`, `session.ts:19-25`).
  - Technische Fehler zählen nicht zur Sperre: `password-check.ts:36-40,55`, dazu der Unit-Test.
- [x] **EC-7**: „  QA2-ACC-Case@Example.TEST “ wird kleingeschrieben gespeichert. Der Login mit Großbuchstaben und Leerzeichen gelingt, und eine Mischschreibweise legt kein zweites Konto an.
- [x] **EC-8**: Eine zweite Registrierung einer unbestätigten Adresse mit anderem Passwort ergibt `success` und eine 2. Mail. Es bleibt 1 Konto, `encrypted_password` ist unverändert, und nach der Bestätigung gilt das erste Passwort.
- [x] **EC-9**: Nach einem Passwortwechsel bzw. dem Löschen auf Gerät A führen auf Gerät B sowohl `GET /account` als auch eine Server Action auf `/login?notice=session-ended`. Dort steht „Bitte melde dich erneut an.“
- [x] **EC-10**: Adresse durch 5 Fehlversuche gesperrt. Ein neuer Link führt auf `/reset-password`, `setNewPassword` auf `/?notice=password-changed`, danach `/` 200. Auch wenn ein Fremder die Mail ausgelöst hat, funktioniert der Link im Postfach des Besitzers (Security-Lane).
- [x] **EC-11**:
  - Ein falsches Passwort im Löschdialog ergibt „Das Passwort ist falsch.“. Das Konto bleibt, eine Zeile `failed` wird geschrieben.
  - 3 falsche Versuche bei „Passwort ändern“ plus 2 im Löschdialog sperren das Konto: Ändern, Löschen und Login werden abgelehnt.
- [!] **EC-12**: NOT VERIFIED. Die Tabellen für Sessions und Fänge kommen erst mit PROJ-2. Das Muster ist bestätigt: `profiles.id … on delete cascade` (`20260929120000_profiles.sql:5`), nach dem Löschen bleiben 0 Zeilen. Muss mit PROJ-2 erneut geprüft werden.
- [x] **EC-13**:
  - Freigabe per SQL auf abgelaufen gesetzt: Das Abschicken führt auf `/account?notice=reset-expired`. Die Freigabe ist entfernt, das Passwort unverändert, der Nutzer bleibt angemeldet.
  - Der vollständige Text erscheint als Warn-Notice (`account/page.tsx:25`). GET mit abgelaufener Freigabe verhält sich gleich.
  - Mit noch 30 s Restzeit antwortet die Seite mit 200. Unbekannte `?notice=` werden ignoriert.

#### Zusätzliche, undokumentierte Edge Cases
- [x] **UE-1**: `/auth/confirm` mit `type=signup`, `type=magiclink` oder ohne `token_hash` ergibt `link-expired`. Ein angehängtes `next=https://evil.example` wird ignoriert, es gibt keinen offenen Redirect.
- [x] **UE-2**: `?notice=` mit `<script>`, als Array oder als `__proto__` erscheint nicht als Roh-HTML. In den Flight-Daten ist es als `<` escaped.
- [x] **UE-3**: Eine unbekannte Adresse zeigt angemeldet die deutsche 404-Seite „Diese Seite gibt es nicht.“ mit „Zur Startseite“. Abgemeldet ergibt sie 307 auf `/login`.
- [x] **UE-4**: Server Actions mit fremdem `Origin` werden abgebrochen („Invalid Server Actions request“ im Log des Produktionsservers), die Sitzung bleibt gültig.
- [x] **UE-5**: Ein 900-KB-Passwort ergibt nach 517 ms „falsch“. Ein gefälschter `Host`- oder `X-Forwarded-Host`-Header ändert kein Weiterleitungsziel.
- [ ] **UE-6**: Eine kaputte Anfrage an `requestNewLink` ergibt HTTP 500, siehe **BUG-14**.

## Security-Audit

- [x] **Authentifizierung:** kein Zugriff ohne Anmeldung auf beiden Servern, siehe AC-13 (11 Pfadvarianten, Umgehungs-Header, gefälschte und unsignierte JWTs, auch die Action `deleteAccount`). Zweite Prüfung in den Seiten: `require-user.ts:10-17`.
- [x] **CSRF auf Server Actions:** `logout`, `changePassword` und `login` mit `Origin: http://evil.example` werden abgebrochen, die Sitzung bleibt bestehen.
- [x] **Autorisierung:** kein Zugriff auf fremde Daten, siehe AC-14 und AC-15.
  - RLS ist an, `authenticated` hat nur SELECT auf `profiles`.
  - Alle drei `SECURITY DEFINER`-Funktionen haben `search_path=""`, EXECUTE haben nur `postgres` und `service_role`. Das gilt auch für das neue `claim_mail_request`: anonym ergibt es 401, es entsteht keine Zeile.
- [x] **Eingabeprüfung / Injection:** 7 XSS-, SQL-, CRLF-Bcc- und Nullbyte-Adressen gegen `register`, `login` und `requestPasswordReset` ergeben Feldfehler, 0 Treffer in `auth.users`.
  - Typverwirrung (`null`, `[]`, `{"$ne":null}`) ergibt „Bitte prüfe deine Eingaben.“ (`schemas.ts:16-69`).
  - Einzige Ausnahme: siehe BUG-14.
- [x] **Brute Force über die App:** siehe AC-23 (22 Versuche nacheinander, 30 parallel), AC-24 (25 Adressen mit wechselnden gefälschten IP-Headern) und EC-11 (Passwort ändern und Löschdialog zählen mit).
- [x] **Massen-Registrierung über die App:** 5 pro Stunde, nicht mit gefälschter IP umgehbar (AC-26).
- [!] **Brute Force und Massen-Registrierung direkt über Supabase:** NOT VERIFIED, go-live. Die Lücke ist laut Vertrag bewusst offen und eine **Deploy-Sperre** (spec.md „Technische Anforderungen“, `[user go-live]` T47).
  - Gemessen: Ein in der App gesperrtes Konto erhielt direkt über `/auth/v1/token` 25 echte Passwortprüfungen, danach lieferte das richtige Passwort ein Token. `/auth/v1/signup` legt Konten ohne Grenze an.
  - Die Annahme in Spec und Design, Supabase bremse den direkten Weg lokal pro IP, stimmt nicht, siehe **BUG-15**.
  - Einzustellen beim Hosting: Supabase → Authentication → Attack Protection (CAPTCHA) und Supabase → Authentication → Rate Limits.
- [!] **CAPTCHA:** NOT VERIFIED. Laut Spec bewusst nicht im MVP, gehört zur Deploy-Sperre T47.
- [x] **Keine Account-Enumeration über Meldungen und Antwortzeit:**

  | Fall | Meldung | Antwortzeit |
  |---|---|---|
  | Login, unbekannte Adresse | gleich | 511–564 ms |
  | Login, bestehendes Konto, falsches Passwort | gleich | 510–525 ms |
  | Login, unbestätigtes Konto | gleich | 510–513 ms |
  | „Passwort vergessen“, unbekannt / bestehend | gleich | 524–530 / 511–519 ms |

  Die Untergrenze von 500 ms setzt `min-duration.ts`.
- [ ] **BUG, Account-Enumeration über Cookies:** siehe **BUG-9**.
- [x] **Keine Zugangsdaten in der URL:** Alle Formulare rendern `method="post"` und schicken per `handleSubmit` bzw. Server Action ab (`use-auth-action.ts:22`, `change-password-sheet.tsx:60`, `delete-account-dialog.tsx:53`, `new-password-form.tsx:31`). Ein natives urlencoded POST auf `/login` schreibt nichts in die URL.
- [x] **Keine Geheimnisse im Client-Bundle:**
  - Durchsucht: `.next/static` (51 Dateien) und die ausgelieferten Chunks beider Server.
  - Kein Treffer für die Werte von `SERVICE_ROLE_KEY`, `SECRET_KEY` und `JWT_SECRET`.
  - Kein Treffer für die Literale `sb_secret_`, `SUPABASE_SERVICE_ROLE_KEY`, `"role":"service_role"`, `TRUSTED_CLIENT_IP_HEADER` und `createAdminClient`.
  - `admin.ts:5` nutzt `server-only`.
- [x] **Keine sensiblen Daten in Antworten:** Die Actions liefern nur `status`, `message`, `fieldErrors` bzw. `unconfirmed`. `/account` enthält kein `app_metadata`, `session_id` und keine Tokens. Der Export enthält nur die eigenen Daten.
- [x] **Passwörter nie im Klartext:** `encrypted_password` ist bcrypt (`$2a$`, 60 Zeichen). Das Dev-Log und die Docker-Logs von auth, kong, db und rest enthalten die Test-Passwörter 0-mal.
- [x] **Sicherheits-Header:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin` und `Strict-Transport-Security: max-age=31536000; includeSubDomains` stehen auf 200, 307, 404 und dem JSON-Export, auf beiden Servern.
- [x] **Cache-Control in Produktion:** `private, no-store` auf allen geschützten Seiten (`:3556`, `src/proxy.ts:60`).
- [!] **Rate Limiting auf gewöhnlichen Endpunkten:** NOT VERIFIED, nicht umgesetzt (optional im MVP). 40 × `/account/export` ergaben 40 × 200. 30 „Passwort vergessen“-Anfragen für 30 Adressen von einer IP wurden alle angenommen. Eine Mail-Grenze pro IP verlangt die Spec nicht.
- [!] **AC-24 und AC-26 mit gesetztem `TRUSTED_CLIENT_IP_HEADER`:** NOT VERIFIED zur Laufzeit, weil ein Neustart der Server nötig wäre. Belegt über `client-ip.test.ts` (5/5): Nur der genannte Header zählt, bei `x-forwarded-for` der letzte Eintrag.
- [x] **`[user]`-Aufgabe T8:** `tasks.md` ist abgehakt, zur Laufzeit wirksam (die Bremse schreibt, `deleteUser` löscht).
- [!] **`[user go-live]` T25–T31 und T45–T47:** NOT VERIFIED, go-live. Werden in `/deploy` gemacht und geprüft. Die zugehörigen AC wurden gegen die lokale Supabase geprüft (T45: `secure_password_change` ist lokal aktiv, `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true`).

#### Hinweise ohne Bug-Status
- Nach dem Abmelden gilt ein bereits ausgestelltes Access-Token an der Datenbank-Schnittstelle bis zu seinem Ablauf weiter (höchstens 1 h, `GOTRUE_JWT_EXP=3600`). Der Refresh-Token ist widerrufen, und die App selbst meldet sofort ab. Das ist das Standardverhalten von Supabase.
- `user_metadata` kann jeder Nutzer selbst schreiben (`PUT /auth/v1/user {data}` ergibt 200). Heute folgenlos. **PROJ-2 darf `user_metadata` nie für Berechtigungen nutzen.**
- Bestätigungslinks werden per GET eingelöst. Link-Vorschauen von Mail-Scannern könnten Tokens verbrauchen, der Nutzer landet dann bei EC-1.
- Ein Fremder kann für eine fremde Adresse das Mail-Kontingent (AC-25) aufbrauchen. Das entspricht dem Vertrag: Die Mail des Fremden liegt im Postfach des Besitzers und funktioniert (EC-10). Die Wartemeldung könnte darauf hinweisen, im Postfach nachzusehen.

## Unit-Tests aus /qa

Neu, neben dem Quellcode:
- `src/lib/auth/password-check.test.ts` (10 Tests), die gemeinsame Passwortprüfung für Login, „Passwort ändern“ und „Konto löschen“:
  - Ergebnis `ok`, `wrong` und `unconfirmed` mit dem richtigen Eintrag im Protokoll.
  - Passwörter über 72 Bytes werden ohne Supabase-Anfrage abgelehnt und zählen mit. Genau 72 Bytes gehen noch an Supabase.
  - Sperre nach 5 Fehlversuchen, auch für das richtige Passwort.
  - Technische Fehler (nicht erreichbar, Supabase-429, unbekannter Fehler) zählen nicht zur Sperre.
  - Die Bremse läuft echt, nur die Tabelle ist durch einen Speicher im Arbeitsspeicher ersetzt.

**Fehlschlag-Probe (Red-Check):**
- Weil die Lanes gleichzeitig gegen den laufenden Server prüften, wurde nicht der echte Code verändert. Geprüft wurde gegen zwei kaputte Kopien (`password-check.mutantA/B.ts`), die die App nicht lädt.
- Mutante A (vertauschte Ergebnisse, Zeichen- statt Byte-Zählung, fehlendes Verwerfen, 429 → 15 Minuten, verschluckte Fehler) ließ 9 von 10 Tests scheitern.
- Mutante B (`>=` statt `>` an der 72-Byte-Grenze) ließ den zehnten scheitern.
- Jeder Test war also mindestens einmal rot. Die Mutanten sind gelöscht, das Original ist grün.

## E2E-Tests
- Status: **nicht gelaufen** (für kritische Abläufe `/e2e-tests` ausführen). Es gibt noch kein `tests/`-Verzeichnis.

## Regression
- [!] **Deployte Features:** NOT VERIFIED. Kein Feature hat den Status Deployed. Die Zeile unter „Deployments“ in `features/INDEX.md` ist das Vorlagen-Beispiel.
- [x] **Migrationen und Schema:**
  - 4/4 angewendet, der Inhalt ist identisch mit den Dateien.
  - Die neue Migration erweitert nur den Check von `outcome` um `duplicate`. Alle übrigen Constraints sind unverändert (Gegenprobe in einer Transaktion mit Rollback).
  - Indizes, Trigger und beide cron-Jobs sind aktiv.
  - Logik von `claim_mail_request` per psql: `send`, dann `duplicate` innerhalb von 10 s, `send`, `send`, dann `limit`.
- [x] **Laufende Auth-Konfiguration entspricht `config.toml`:** Reauthentication `true`, OTP_EXP 86 400, Mindestlänge 8, Mindestabstand 10 s, Site-URL `http://localhost:3553`.
- [x] **Alle Routen, abgemeldet und angemeldet:** keine 5xx, Weiterleitungen wie im Design. Die Ausnahme ist die gebastelte Anfrage aus BUG-14.
- [x] **Gemeinsame Teile:**
  - `<html lang="de">`, die Schriften Barlow, Zilla Slab und IBM Plex Mono.
  - Deutsche Titel „… · Petrilog“ auf allen Seiten, einschließlich „Seite nicht gefunden“.
  - Die Design-Tokens in der ausgelieferten CSS entsprechen `docs/design-system.md`.
  - Das Layout für Abgemeldete hat den Wald-Hintergrund mit Papier-Textur.
- [x] **Kernablauf Ende-zu-Ende per HTTP:** registrieren (Großbuchstaben und Leerzeichen), Mail, bestätigen, Konto-Seite, Export, abmelden (303), anmelden, falsches Passwort. Es entsteht genau 1 Profil.
- [x] **Dev-Log:** In `.next/dev/logs/next-development.log` gibt es keine neuen Fehlerzeilen, und die Test-Passwörter kommen 0-mal vor.

## Nicht geprüft in diesem Lauf

- [!] **Browser-übergreifende Darstellung** (Chrome / Firefox / Safari): `/qa` läuft ohne Browser, das deckt nur `/e2e-tests` ab.
- [!] **Responsives Layout** (375 / 768 / 1440 px), Dunkelmodus, Daumenbereich: braucht einen echten Viewport.
- [!] **Reine Client-Interaktionen:** „Passwort anzeigen“ (AC-12), Löschdialog öffnen (AC-27), sichtbarer Zustand „Prüfe dein Postfach“ (AC-1, AC-2), Toast „Passwort geändert“ (AC-17). Belegt sind sie nur über Code und SSR.
- [!] **Zurück-Taste nach dem Abmelden (AC-22):** braucht einen Browser. Der Header `private, no-store` in Produktion ist belegt.
- [!] **Mobile Tastatur und Autofill am Gerät:** `inputMode`, `autoComplete` und `autoCapitalize` stehen im HTML, wirken aber nur auf einem echten Gerät.
- [!] **EC-6** (Server nicht erreichbar): nur Code und Unit-Test.
- [!] **EC-12** (laufende Session wird mitgelöscht): erst mit PROJ-2 prüfbar.
- [!] **AC-24 und AC-26 mit gesetztem vertrauenswürdigem IP-Header:** nur Unit-Test.
- [!] **Direkter Weg zu Supabase und CAPTCHA:** Deploy-Sperre, go-live (T47).
- [!] **Erreichbarkeit von anderen Geräten im Netzwerk (Windows-Firewall):** von diesem Rechner aus nicht prüfbar, siehe BUG-11.
- [!] **Browser-Konsole und Netzwerk-Tab:** brauchen DevTools.
- [!] **Rate Limiting auf `/account/export`:** nicht umgesetzt (optional).
- [!] **`[user go-live]` T25–T31 und T45–T47:** werden in `/deploy` gemacht und geprüft.

## Bugs

### Stand der Bugs aus Runde 1
- **BUG-1** (gefälschte IP): **behoben.** Belegt unter AC-24 und AC-26.
- **BUG-2** (direkter Weg zu Supabase): **offen nach Vertrag.** Die Spec nimmt ihn für den lokalen Betrieb aus und macht ihn zur Deploy-Sperre (T47). Nicht als Bug gezählt. Siehe aber BUG-15.
- **BUG-3** (Passwortwechsel ohne aktuelles Passwort): **über die App behoben** (AC-33). Die Restlücke über den direkten Weg steht in BUG-10.
- **BUG-4** (zwei Mails bei Doppel-Tipp): **behoben.** Belegt unter EC-5.
- **BUG-5** (Minutenangabe bei Parallelität): **teilweise behoben.** Der Rest steht in BUG-13.
- **BUG-6** (parallele Registrierung zeigt „Keine Verbindung“): **behoben.** Belegt unter EC-5.
- **BUG-7** (Passwörter über 72 Bytes): **behoben.** Belegt unter AC-34.
- **BUG-8** (englische Texte): **behoben** für die 404-Seite und die Zod-Meldungen von 6 Actions. Der Rest steht in BUG-14.

#### BUG-9: Kontostatus einer Adresse lässt sich an den Cookies der Antwort ablesen
- **Severity:** Medium
- **Betrifft:** AC-6, AC-2, EC-1 und die Sicherheitsregel „Never reveal whether an account exists“
- **Schritte:**
  1. Die Action `register` mit einer **bestätigten** Adresse und beliebigem Passwort aufrufen. Ergebnis: 0 `Set-Cookie`.
  2. Dasselbe mit einer **neuen oder unbestätigten** Adresse. Ergebnis: 3 `Set-Cookie` (`sb-127-auth-token-code-verifier`, `…-flows-code-verifier`, `…-flow-<id>-code-verifier`).
  3. `resendConfirmation` und `requestNewLink(type:signup)` verhalten sich genauso: 3 Cookies nur bei einem unbestätigten Konto, sonst 0.
- **Erwartet:** gleiche Antwort, egal ob es das Konto gibt.
- **Tatsächlich:** Der Antworttext ist gleich, die Cookies verraten den Status. Das ist auf dem Dev- und dem Produktionsserver gleich reproduzierbar.
- **Ursache:**
  - `@supabase/ssr` nutzt standardmäßig das PKCE-Verfahren und schreibt bei `signUp` (`register.ts:36`) und `resend` (`confirmation-mail.ts:20`) einen Code-Verifier als Cookie (`src/lib/supabase/server.ts:17-19`). Diese Aufrufe passieren nur bei bestimmten Kontozuständen.
  - Die Mail-Links nutzen `token_hash`, der Verifier wird also nie gebraucht.
  - Nebenwirkungen: Die Cookies leben 400 Tage, haben kein `HttpOnly`, und in `auth.flow_state` sammeln sich nie abgeschlossene Abläufe (137 Zeilen).
- **Priorität:** vor dem Deployment beheben (`/build`). Zum Beispiel für diese Aufrufe keine Verifier-Cookies schreiben lassen, oder in allen Zweigen dieselben Cookies setzen.

#### BUG-10: Passwortwechsel ohne aktuelles Passwort direkt über Supabase, innerhalb von 24 h nach dem Login
- **Severity:** Medium
- **Betrifft:** AC-21, AC-33 (Absicht der Produktentscheidung „fremde Hände am entsperrten Handy“)
- **Schritte:**
  1. Über die App anmelden.
  2. Das `access_token` aus dem Cookie `sb-127-auth-token` lesen. Es ist nicht `HttpOnly`, also z. B. über die Browser-Konsole erreichbar.
  3. `PUT http://127.0.0.1:55321/auth/v1/user` mit `{"password":"…"}` schicken.
- **Erwartet:** Ein Passwortwechsel verlangt das aktuelle Passwort.
- **Tatsächlich:** 200, das neue Passwort gilt.
  - Gegenprobe: Mit einer Sitzung, die älter als 24 h ist, ergibt derselbe Aufruf 400 `reauthentication_needed`.
  - `secure_password_change` wirkt also, schützt aber nur ältere Sitzungen.
- **Ursache:** Das ist Supabase-Verhalten. `design.md:263` kennt die Restlücke und ordnet sie der Deploy-Sperre zu. Die Deploy-Sperre in `spec.md` deckt aber nur „Durchprobieren von Passwörtern und Massen-Registrierung“ ab. Die Lücke ist also nirgends im Vertrag erfasst.
- **Priorität:** vor dem Deployment klären. Entweder `/refine PROJ-1` nimmt sie ausdrücklich in die Deploy-Sperre auf, oder `/build` schließt sie.

#### BUG-11: Lokale Dienste sind im ganzen Netzwerk erreichbar, auch Mailpit und die Datenbank
- **Severity:** Medium (Umgebung, nicht Feature-Code). **High**, falls die Windows-Firewall Zugriffe anderer Geräte durchlässt.
- **Betrifft:** PRD „kein Deployment, die App läuft lokal“ und die Begründung für den Verzicht auf CAPTCHA („aus dem Internet nicht erreichbar“)
- **Tatsächlich:** `netstat` zeigt `0.0.0.0` für 3553, 55321 (API), 55322 (Datenbank) und 55324 (Mailpit). Über die LAN-IP 192.168.0.22 waren von diesem Rechner aus erreichbar:
  - die App
  - `:55324/api/v1/messages` mit allen Links zum Zurücksetzen. Wer das lesen kann, kann jedes Konto übernehmen.
  - `psql` auf `:55322` mit den Standard-Zugangsdaten als `postgres`
- **Nicht prüfbar von hier:** ob andere Geräte im Netzwerk tatsächlich durchkommen.
- **Priorität:** vor der nächsten Nutzung in einem fremden oder öffentlichen Netzwerk klären. Zum Beispiel die Firewall für diese Ports prüfen, oder Dev-Server und Supabase nur an `127.0.0.1` binden.

#### BUG-12: Ein fremder Bestätigungslink ersetzt die bestehende Anmeldung ohne Rückfrage
- **Severity:** Low (wird mit PROJ-2 relevanter)
- **Betrifft:** EC-4, Privatsphäre-Zusage der PRD
- **Schritte:**
  1. Das Opfer ist als B angemeldet.
  2. Ein Angreifer schickt ihm den Bestätigungslink seines eigenen unbestätigten Kontos.
  3. Das Opfer öffnet den Link. Ergebnis: 307 auf `/`, und `/account` zeigt das **Konto des Angreifers**.
- **Folge:** Ab PROJ-2 würde das Opfer seine Fänge samt GPS-Position im Konto des Angreifers eintragen.
- **Ursache:** `src/app/auth/confirm/route.ts:28-52` meldet ohne Rückfrage über eine bestehende Anmeldung hinweg an. Das folgt aus EC-4 („Bestätigung in jedem Browser“).
- **Priorität:** vor oder mit PROJ-2 entscheiden (`/refine PROJ-1`). Zum Beispiel bei einer bestehenden Anmeldung eines anderen Kontos nur bestätigen und auf den Login verweisen.

#### BUG-13: Sperrmeldung nennt „15 Minuten“, obwohl die Sperre nur durch gleichzeitige Anfragen entstand
- **Severity:** Low
- **Betrifft:** AC-23
- **Schritte:**
  1. 3 falsche Logins nacheinander für eine frische Adresse.
  2. Sofort 4 falsche Logins parallel. Ergebnis: alle 4 „… in 15 Minuten erneut.“
  3. Ein einzelner Versuch kurz danach wird normal geprüft.
- **Erwartet:** Die Minutenangabe stimmt.
- **Tatsächlich:** Es liegen nur 3 echte Fehlversuche vor, eine Sperre besteht nicht.
- **Ursache:** `src/lib/auth/throttle.ts:94-105` rechnet die Wartezeit vom jüngsten `failed`, sobald es einen gibt. Den Fall „gesperrt nur durch laufende Prüfungen“ erkennt der Code nur, wenn es noch **keinen** Fehlversuch gibt (Zeile 101).
- **Einordnung:** Über die Oberfläche nicht erreichbar, weil der Button gesperrt ist. Es braucht mehrere Tabs oder ein Skript.

#### BUG-14: Kaputte Anfrage an „Neue Mail anfordern“ ergibt HTTP 500 mit englischem Fehlertext
- **Severity:** Low
- **Betrifft:** Technische Anforderung „Sprache“, `design.md:100` („Bitte prüfe deine Eingaben.“)
- **Schritte:** `POST /auth/link-expired` mit dem `Next-Action` von `requestNewLink` und dem Body `[]` oder `[null]`.
- **Tatsächlich:** 500, `TypeError: Cannot read properties of undefined …`. Die übrigen 6 Actions antworten korrekt mit „Bitte prüfe deine Eingaben.“
- **Ursache:** `src/lib/auth/actions/mail.ts:59-61` liest `input.type` und `input.email`, bevor Zod prüft.
- **Einordnung:** Nur mit gebastelten Anfragen erreichbar.

#### BUG-15: Spec und Design nehmen eine Supabase-Grenze pro IP an, die lokal nicht greift
- **Severity:** Low (Dokumentation und Annahme; wirkt auf die Bewertung von BUG-2)
- **Betrifft:** `spec.md` → Out of Scope („wird im MVP nur durch die eingebauten Grenzen von Supabase pro IP gebremst“), `design.md:349`
- **Tatsächlich:** 1220 falsche Passwörter gegen eine Adresse direkt über `/auth/v1/token` in etwa 12 s, dabei 0-mal 429. Im Auth-Container gibt es keine wirksame Variable für `sign_in_sign_ups`, vorhanden ist nur `GOTRUE_RATE_LIMIT_OTP=100`.
- **Folge:** Lokal gibt es auf dem direkten Weg **keine** Untergrenze. Zusammen mit BUG-11 ist das nicht nur theoretisch.
- **Priorität:** mit BUG-11 entscheiden. Entweder `/refine PROJ-1` korrigiert die Annahme, oder die lokale Supabase-Grenze wird wirksam gesetzt.

#### BUG-16: Header `X-Powered-By: Next.js` wird ausgeliefert
- **Severity:** Low
- **Betrifft:** Härtung (Fingerprinting), `docs/production/security-headers.md`
- **Ursache:** `poweredByHeader: false` fehlt in `next.config.ts`.

## Zusammenfassung
- **Acceptance Criteria:** 33 von 34 bestanden, 1 NOT VERIFIED (AC-12, reine Client-Interaktion). AC-1, AC-2, AC-17, AC-22 und AC-27 sind in ihrem sichtbaren bzw. Browser-Teil nur über Code und SSR belegt.
- **Edge Cases:** 11 von 13 bestanden, 2 NOT VERIFIED (EC-6, EC-12).
- **Bugs aus Runde 1:** 5 behoben (BUG-1, 4, 6, 7, dazu BUG-3 über die App), 2 teilweise mit Rest in neuen Bugs (BUG-5, BUG-8), 1 offen nach Vertrag als Deploy-Sperre (BUG-2).
- **Neue Bugs:** 8 insgesamt: 0 Critical, 0 High, 3 Medium (BUG-9, BUG-10, BUG-11) und 5 Low (BUG-12 bis BUG-16).
- **Security:** 15 Prüfpunkte belegt, 6 NOT VERIFIED (direkter Weg zu Supabase und CAPTCHA per Deploy-Sperre, gewöhnliche Endpunkte, vertrauenswürdiger IP-Header, LAN-Firewall, go-live). 1 Befund: Enumeration über Cookies (BUG-9, Medium).
- **Produktionsreif:** **JA** im Sinne von „keine Critical- oder High-Bugs“, und alle Laufzeit-Kriterien wurden tatsächlich ausgeführt.
  - Das Hosting bleibt trotzdem gesperrt, bis die Deploy-Sperre T47 erfüllt ist.
  - BUG-9 und BUG-10 sollten vor dem ersten `/deploy` behoben bzw. im Vertrag geklärt sein.
  - BUG-11 betrifft schon den lokalen Betrieb und sollte zeitnah geklärt werden.

> „Produktionsreif: JA“ heißt nur: keine Critical- oder High-Bugs gefunden. Es heißt nicht, dass alles geprüft wurde. Die NOT-VERIFIED-Punkte oben brauchen einen Menschen oder `/e2e-tests`.
