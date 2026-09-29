# PROJ-1: Registrierung & Login

<!-- Diese Datei (spec.md) ist der stabile VERTRAG: Sie legt fest, WAS gebaut wird, nicht WIE.
     Owner: /write-spec (legt an), /refine (ändert). Während /build ist diese Datei SCHREIBGESCHÜTZT.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status und kein Datum hier: Der Status lebt NUR in features/INDEX.md. -->

## Abhängigkeiten
- Keine. PROJ-1 ist das erste Feature.
- **Wird gebraucht von:** PROJ-2 (Sessions & Fänge) und PROJ-3 (Automatische Wetterdaten). Beide nutzen das Konto, den Zugriffsschutz und das hier festgelegte Muster „jeder sieht nur seine eigenen Daten“.
- **App-Rahmen:** Kopfzeile, Tab-Leiste und Sessions-Übersicht gehören PROJ-2 (`docs/app-shell.md`). PROJ-1 liefert die Seiten für abgemeldete Nutzer und den Inhalt des Konto-Tabs. Solange PROJ-2 nicht gebaut ist, landet ein angemeldeter Nutzer auf einer schlichten Startseite mit Link zur Konto-Seite. Diese Startseite wird mit PROJ-2 zur Sessions-Übersicht.

## User Stories
- Als neuer Angler möchte ich mit E-Mail-Adresse und Passwort ein Konto anlegen, damit mein Fangbuch mir gehört und nicht an einem Gerät hängt.
- Als Angler am Wasser möchte ich angemeldet bleiben, bis ich mich selbst abmelde, damit ich mit nassen Händen kein Passwort tippen muss, um einen Fang einzutragen.
- Als Angler, der seine Spots geheim hält, möchte ich, dass nur ich meine Daten sehen kann, auch bei einem direkten Aufruf der Datenbank, damit meine Fangplätze privat bleiben.
- Als Angler, der sein Passwort vergessen hat, möchte ich es per E-Mail-Link zurücksetzen, damit ich mein Fangbuch nicht verliere.
- Als angemeldeter Angler möchte ich auf der Konto-Seite mein Passwort ändern und mich abmelden, damit ich mein Konto selbst im Griff habe.
- Als Angler möchte ich meine Daten exportieren und mein Konto samt allen Daten endgültig löschen können, damit ich die Kontrolle über meine Daten behalte.

## Nicht enthalten (Out of Scope)
- **CAPTCHA** bei Registrierung und „Passwort vergessen“: bewusst nicht im MVP (siehe Produktentscheidungen). Muss vor dem ersten gehosteten Betrieb kommen (Offene Fragen, `/deploy`).
- **Abgleich mit bekannten, geleakten Passwörtern:** im Supabase Free Plan nicht verfügbar. Wird mit dem Hosting erneut bewertet.
- **E-Mail-Adresse ändern:** braucht einen eigenen Bestätigungsablauf (alte und neue Adresse). Kommt später über `/refine PROJ-1`.
- **Login mit Google oder Apple, Magic Link, Zwei-Faktor-Anmeldung.**
- **Automatischer Logout nach Inaktivität.**
- **Profilangaben** wie Name, Spitzname, Avatar oder Einstellungen. Das Profil ist vorerst nur die Verknüpfung zum Konto.
- **Rollen, Admin-Ansicht, Vereinsfunktionen.**
- **Sessions und Fänge** selbst (PROJ-2). PROJ-1 legt nur das Zugriffsmuster fest, das PROJ-2 übernimmt, und den Datenexport, den PROJ-2 um seine Daten ergänzt.
- **Kopfzeile, Tab-Leiste, Leiste der aktiven Session:** gehören PROJ-2.
- **Rechtlicher Text der Datenschutzerklärung und Impressum:** kommen von einer Anwältin oder einem Generator vor dem ersten gehosteten Betrieb. Im MVP steht ein Platzhaltertext.
- **Mail-Versand an echte Postfächer:** lokal landen alle Mails im Test-Postfach (Mailpit). Ein Mail-Dienst für den Betrieb wird bei `/deploy` gewählt.

## Acceptance Criteria

### Registrierung
- [ ] **AC-1** — Angenommen ein nicht angemeldeter Besucher ist auf der Registrierungsseite, wenn er eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen eingibt und „Konto anlegen“ antippt, dann wird ein noch unbestätigtes Konto angelegt, eine Bestätigungsmail an diese Adresse geschickt und der Bildschirm „Prüfe dein Postfach“ mit der eingegebenen Adresse angezeigt
- [ ] **AC-2** — Angenommen der Bildschirm „Prüfe dein Postfach“ wird angezeigt, wenn der Nutzer ihn liest, dann enthält er den Hinweis „Du hast schon ein Konto? Dann melde dich an oder setze dein Passwort zurück.“ mit Links zu Login und „Passwort vergessen“ sowie die Aktion „Mail erneut senden“
- [ ] **AC-3** — Angenommen ein Nutzer hat eine Bestätigungsmail erhalten, wenn er den Link darin innerhalb von 24 Stunden öffnet, dann ist sein Konto bestätigt, er ist angemeldet und landet auf der Startseite der App
- [ ] **AC-4** — Angenommen eine Registrierung wurde abgeschickt, wenn das Konto angelegt wird, dann entsteht automatisch genau ein eigenes Profil zu diesem Konto, an das spätere Features die Daten des Nutzers binden
- [ ] **AC-5** — Angenommen ein Besucher ist auf der Registrierungsseite, wenn er eine ungültige E-Mail-Adresse oder ein Passwort mit weniger als 8 Zeichen eingibt, dann wird kein Konto angelegt, am betroffenen Feld erscheint eine verständliche Fehlermeldung und seine Eingaben bleiben erhalten. Das gilt auch, wenn die Prüfung im Browser umgangen wird
- [ ] **AC-6** — Angenommen für eine E-Mail-Adresse existiert bereits ein Konto, wenn sich jemand mit dieser Adresse registriert, dann sieht er denselben Bildschirm „Prüfe dein Postfach“ wie bei einer neuen Adresse, es entsteht kein zweites Konto und das bestehende Konto samt Passwort bleibt unverändert

### Login & Anmeldezustand
- [ ] **AC-7** — Angenommen ein bestätigtes Konto existiert, wenn der Nutzer auf der Login-Seite die richtige E-Mail-Adresse und das richtige Passwort eingibt, dann ist er angemeldet und landet auf der Startseite der App
- [ ] **AC-8** — Angenommen ein Login-Versuch schlägt fehl, wenn die Fehlermeldung erscheint, dann lautet sie für eine unbekannte Adresse und für ein falsches Passwort gleich („E-Mail oder Passwort ist falsch.“) und die eingegebene E-Mail-Adresse bleibt im Feld stehen
- [ ] **AC-9** — Angenommen ein Konto ist noch nicht bestätigt, wenn sich der Nutzer mit dem richtigen Passwort anmelden will, dann wird er nicht angemeldet, sieht den Hinweis, dass er zuerst seine E-Mail-Adresse bestätigen muss, und kann die Bestätigungsmail von dort erneut anfordern
- [ ] **AC-10** — Angenommen ein Nutzer ist angemeldet, wenn er die App schließt und Tage oder Wochen später wieder öffnet, dann ist er weiterhin angemeldet, solange er sich nicht selbst abgemeldet hat und sein Passwort nicht zurückgesetzt oder geändert wurde
- [ ] **AC-11** — Angenommen ein Nutzer ist angemeldet, wenn er die Login- oder die Registrierungsseite aufruft, dann landet er auf der Startseite der App
- [ ] **AC-12** — Angenommen ein beliebiges Passwortfeld (Registrierung, Login, neues Passwort, Passwort ändern), wenn der Nutzer „Passwort anzeigen“ antippt, dann erscheint das Passwort im Klartext, und erneutes Antippen verbirgt es wieder

### Zugriffsschutz (jeder sieht nur seine eigenen Daten)
- [ ] **AC-13** — Angenommen ein Besucher ist nicht angemeldet, wenn er eine Adresse der App aufruft, die nicht zu Login, Registrierung, E-Mail-Bestätigung, „Passwort vergessen“, „Neues Passwort festlegen“ oder Datenschutzerklärung gehört, dann wird er zum Login umgeleitet und sieht keine Inhalte der App
- [ ] **AC-14** — Angenommen zwei Nutzer A und B haben ein Konto, wenn B die Daten von A abfragt, ändern oder löschen will, egal ob über die App oder direkt über die Datenbank-Schnittstelle mit seinem eigenen Zugang, dann erhält er keine Daten von A und kann nichts davon verändern
- [ ] **AC-15** — Angenommen ein Aufrufer ist nicht angemeldet, wenn er die Datenbank-Schnittstelle direkt abfragt, dann erhält er keine Daten irgendeines Nutzers

### Passwort vergessen
- [ ] **AC-16** — Angenommen ein Besucher ist auf der Login-Seite, wenn er „Passwort vergessen?“ antippt und eine E-Mail-Adresse abschickt, dann sieht er immer dieselbe Meldung („Falls es ein Konto zu dieser Adresse gibt, haben wir dir einen Link geschickt.“), und eine Mail mit Link geht nur raus, wenn zu der Adresse ein Konto existiert
- [ ] **AC-17** — Angenommen ein Nutzer hat eine Mail zum Zurücksetzen erhalten, wenn er den Link innerhalb von 1 Stunde öffnet und ein neues Passwort mit mindestens 8 Zeichen festlegt, dann ist das neue Passwort gültig, das alte nicht mehr, er ist angemeldet, landet auf der Startseite der App und sieht die Rückmeldung „Passwort geändert“
- [ ] **AC-18** — Angenommen ein Nutzer ist auf mehreren Geräten angemeldet, wenn er sein Passwort auf einem Gerät zurücksetzt, dann sind alle anderen Geräte abgemeldet und müssen sich mit dem neuen Passwort anmelden

### Konto-Seite
- [ ] **AC-19** — Angenommen ein Nutzer ist angemeldet, wenn er die Konto-Seite öffnet, dann sieht er seine E-Mail-Adresse (nur zum Lesen) sowie „Passwort ändern“, „Meine Daten exportieren“, „Konto löschen“, „Abmelden“ und einen Link zur Datenschutzerklärung
- [ ] **AC-20** — Angenommen ein Nutzer ist auf der Konto-Seite, wenn er unter „Passwort ändern“ sein aktuelles Passwort und ein neues mit mindestens 8 Zeichen eingibt, dann gilt ab sofort das neue Passwort, er bleibt auf diesem Gerät angemeldet, alle anderen Geräte werden abgemeldet und er sieht die Rückmeldung „Passwort geändert“
- [ ] **AC-21** — Angenommen ein Nutzer will sein Passwort ändern, wenn das eingegebene aktuelle Passwort falsch ist, dann bleibt das bisherige Passwort gültig und er sieht die Meldung „Das aktuelle Passwort ist falsch.“
- [ ] **AC-22** — Angenommen ein Nutzer ist angemeldet, wenn er „Abmelden“ antippt, dann ist er auf diesem Gerät abgemeldet, landet auf der Login-Seite und sieht auch über die Zurück-Taste des Browsers keine Inhalte der App mehr

### Missbrauchsschutz
- [ ] **AC-23** — Angenommen für dieselbe E-Mail-Adresse gab es 5 fehlgeschlagene Login-Versuche innerhalb von 15 Minuten, wenn ein weiterer Versuch erfolgt, dann wird er 15 Minuten lang abgelehnt, auch mit richtigem Passwort, und der Nutzer sieht „Zu viele Versuche. Bitte versuche es in X Minuten erneut.“
- [ ] **AC-24** — Angenommen von derselben IP-Adresse gab es 20 fehlgeschlagene Login-Versuche innerhalb von 15 Minuten, egal mit welchen E-Mail-Adressen, wenn ein weiterer Versuch von dort erfolgt, dann wird er 15 Minuten lang abgelehnt, mit derselben Meldung wie in AC-23
- [ ] **AC-25** — Angenommen für eine E-Mail-Adresse wurden in der letzten Stunde schon 3 Mails angefordert (Bestätigung erneut senden oder Passwort vergessen), wenn eine weitere angefordert wird, dann geht keine Mail raus und der Nutzer sieht „Bitte warte etwas, bevor du eine weitere Mail anforderst.“. Diese Meldung erscheint unabhängig davon, ob es zu der Adresse ein Konto gibt
- [ ] **AC-26** — Angenommen von derselben IP-Adresse wurden in der letzten Stunde schon 5 Konten registriert, wenn eine weitere Registrierung erfolgt, dann wird kein Konto angelegt und der Besucher sieht „Zu viele Registrierungen. Bitte versuche es später erneut.“

### Datenschutz
- [ ] **AC-27** — Angenommen ein Nutzer ist auf der Konto-Seite, wenn er „Konto löschen“ antippt, dann erscheint ein Bestätigungsdialog, der sagt, dass das Konto und alle Sessions, Fänge und Positionen endgültig gelöscht werden, und der zur Bestätigung das Passwort verlangt (Art. 17 DSGVO; Art. 32 Abs. 2 / Art. 6 Abs. 4 DSG)
- [ ] **AC-28** — Angenommen ein Nutzer hat die Löschung mit seinem richtigen Passwort bestätigt, wenn die Löschung abgeschlossen ist, dann sind Konto, Profil und alle ihm zugeordneten Daten sofort entfernt, er ist abgemeldet, sieht auf der Login-Seite „Dein Konto wurde gelöscht.“, und ein Login mit den alten Zugangsdaten schlägt fehl wie bei einer unbekannten Adresse (Art. 17 DSGVO; Art. 32 Abs. 2 DSG)
- [ ] **AC-29** — Angenommen ein Nutzer ist auf der Konto-Seite, wenn er „Meine Daten exportieren“ antippt, dann erhält er eine maschinenlesbare JSON-Datei mit allen zu ihm gespeicherten Daten. Das sind bei PROJ-1 E-Mail-Adresse, Registrierungsdatum und Profil, und jedes spätere Feature ergänzt den Export um seine Daten (Art. 15, 20 DSGVO; Art. 25, 28 DSG)
- [ ] **AC-30** — Angenommen ein Besucher ist nicht angemeldet, wenn er auf Login-, Registrierungs- oder Konto-Seite den Link „Datenschutz“ antippt, dann öffnet sich die Datenschutzerklärung ohne Anmeldung. Das Registrierungsformular zeigt über dem Button den Satz „Mit der Registrierung gilt unsere Datenschutzerklärung.“ mit Link, ohne Häkchen zum Ankreuzen (Art. 13 DSGVO; Art. 19 DSG)
- [ ] **AC-31** — Angenommen es wurden fehlgeschlagene Login-Versuche oder Mail-Anforderungen mit E-Mail- und IP-Adresse festgehalten, wenn seit dem Eintrag 24 Stunden vergangen sind, dann ist der Eintrag gelöscht (Art. 5 Abs. 1 lit. e DSGVO; Art. 6 Abs. 4 DSG)
- [ ] **AC-32** — Angenommen ein Konto wurde registriert, aber nicht bestätigt, wenn seit der Registrierung 7 Tage vergangen sind, dann ist das Konto samt Profil gelöscht und die Adresse kann neu registriert werden (Art. 5 Abs. 1 lit. e DSGVO; Art. 6 Abs. 4 DSG)

## Edge Cases
- **EC-1** — Angenommen ein Bestätigungslink ist abgelaufen oder wurde schon benutzt, wenn der Nutzer ihn öffnet, dann sieht er „Dieser Link ist abgelaufen oder wurde schon benutzt.“ und kann eine neue Bestätigungsmail anfordern (Grenze aus AC-25). Ist das Konto schon bestätigt, führt ihn ein Link zum Login
- **EC-2** — Angenommen ein Link zum Zurücksetzen ist abgelaufen oder wurde schon benutzt, wenn der Nutzer ihn öffnet, dann sieht er dieselbe Meldung wie in EC-1 und kann über „Passwort vergessen“ einen neuen Link anfordern
- **EC-3** — Angenommen ein Nutzer hat mehrmals einen Link zum Zurücksetzen angefordert, wenn er einen der Links öffnet, dann funktioniert nur der zuletzt verschickte, die älteren verhalten sich wie in EC-2
- **EC-4** — Angenommen ein Nutzer öffnet den Bestätigungslink in einem anderen Browser oder auf einem anderen Gerät als bei der Registrierung, wenn der Link gültig ist, dann ist das Konto bestätigt. Ist eine automatische Anmeldung dort nicht möglich, sieht er „E-Mail-Adresse bestätigt. Bitte melde dich an.“ und landet auf der Login-Seite
- **EC-5** — Angenommen ein Besucher tippt „Konto anlegen“ (oder „Anmelden“, „Link senden“) zweimal schnell hintereinander, wenn beide Aktionen ankommen, dann entsteht höchstens ein Konto bzw. geht höchstens eine Mail raus, und der Button ist während der Verarbeitung gesperrt
- **EC-6** — Angenommen die Verbindung zum Server bricht ab oder der Server ist nicht erreichbar, wenn ein Formular (Registrierung, Login, Passwort) abgeschickt wird, dann sieht der Nutzer im Inhalt eine Notice im Warnton („Keine Verbindung. Bitte versuche es erneut.“), seine Eingaben bleiben erhalten und es entsteht kein halbes Konto
- **EC-7** — Angenommen eine E-Mail-Adresse wird mit Großbuchstaben oder Leerzeichen am Anfang oder Ende eingegeben („ Angler@Beispiel.de “), wenn registriert oder angemeldet wird, dann gilt sie als dieselbe Adresse wie „angler@beispiel.de“
- **EC-8** — Angenommen jemand registriert eine Adresse, zu der schon ein unbestätigtes Konto existiert, wenn er das Formular abschickt, dann sieht er „Prüfe dein Postfach“, eine neue Bestätigungsmail geht raus (Grenze aus AC-25), es entsteht kein zweites Konto und das bei der ersten Registrierung gewählte Passwort bleibt gültig
- **EC-9** — Angenommen ein Nutzer ist auf Gerät 2 abgemeldet worden (Passwort zurückgesetzt oder geändert, Konto gelöscht), wenn er dort die nächste Aktion ausführt, dann landet er auf der Login-Seite mit dem Hinweis „Bitte melde dich erneut an.“
- **EC-10** — Angenommen eine E-Mail-Adresse ist durch fremde Fehlversuche gesperrt (AC-23), wenn der echte Besitzer über „Passwort vergessen“ einen Link anfordert und sein Passwort zurücksetzt, dann ist er dadurch angemeldet, und die Sperre hält ihn nicht aus seinem Konto
- **EC-11** — Angenommen ein Nutzer gibt im Löschdialog ein falsches Passwort ein, wenn er bestätigt, dann wird nichts gelöscht und er sieht „Das Passwort ist falsch.“. Fehlversuche hier zählen zur Grenze aus AC-23
- **EC-12** — Angenommen ein Nutzer hat eine laufende Session (PROJ-2), wenn er sein Konto löscht, dann wird auch die laufende Session mit allen Fängen gelöscht und es bleibt nichts zurück

## Technische Anforderungen
- **Sicherheit:** Alle Formulare mit Zugangsdaten werden per POST abgeschickt, nie stehen E-Mail, Passwort oder Tokens in der Adresszeile. Passwörter werden nie im Klartext gespeichert oder protokolliert.
- **Zugriffsschutz doppelt:** in der App und in der Datenbank selbst (Row Level Security), siehe AC-14 und AC-15.
- **Cookies:** nur die für die Anmeldung technisch notwendigen, kein Tracking, keine Analyse. Deshalb braucht es kein Cookie-Banner.
- **Mobile-first:** Eingabefelder mit passender Tastatur (E-Mail-Tastatur) und Autofill-Angaben, damit Passwort-Manager funktionieren. Hauptbutton groß im Daumenbereich, Login und Registrierung auf dem dunklen Wald-Hintergrund mit dem Schriftzug „Petrilog“ (`docs/app-shell.md`, `docs/design-system.md`).
- **Mails lokal:** Alle Mails (Bestätigung, Zurücksetzen) landen während der Entwicklung im Test-Postfach der lokalen Supabase (Mailpit).
- **Sprache:** Alle Texte, Mails und Fehlermeldungen auf Deutsch.

## Offene Fragen
- [ ] CAPTCHA bei Registrierung und „Passwort vergessen“ vor dem ersten gehosteten Betrieb nachrüsten (`/refine PROJ-1` vor `/deploy`)
- [ ] Abgleich mit geleakten Passwörtern mit dem Hosting erneut bewerten (Supabase Pro Plan oder eine andere Lösung)
- [ ] Mail-Dienst für den gehosteten Betrieb wählen (Auftragsverarbeiter, AVV), siehe `docs/privacy.md`
- [ ] Verantwortlichen für die Datenschutzerklärung festlegen, siehe `docs/privacy.md`
- [ ] Mindestalter bzw. Zustimmung der Eltern für jugendliche Angler: Frage an eine Anwältin, siehe `docs/privacy.md`
- [ ] Vor dem ersten Hosting: Supabase sieht bei Anmeldungen über den Server dessen IP-Adresse statt der des Nutzers, und wer die Supabase-Schnittstelle direkt aufruft, umgeht die Bremse der App. Beides klären, zusammen mit dem CAPTCHA (siehe `design.md` → Offene Fragen)

## Entscheidungsprotokoll

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| E-Mail-Bestätigung schon im MVP | Beim späteren Hosting ist dieser Teil fertig, und niemand kann fremde Adressen registrieren. Lokal ist sie über das Test-Postfach prüfbar. | 2026-09-29 |
| „Passwort vergessen“ im MVP | Ohne Zurücksetzen verliert ein Angler sein ganzes Fangbuch. Der Mailversand steht durch die Bestätigung ohnehin. | 2026-09-29 |
| Passwort: mindestens 8 Zeichen, keine Pflicht-Sonderzeichen, Knopf „Passwort anzeigen“ statt zweitem Feld | Länge schützt besser als erzwungene Zeichenklassen und lässt sich am Handy leichter tippen. Der Anzeige-Knopf verhindert Tippfehler ohne ein zusätzliches Feld. | 2026-09-29 |
| Kein Abgleich mit geleakten Passwörtern im MVP | Im Supabase Free Plan nicht verfügbar. Wird mit dem Hosting erneut bewertet. | 2026-09-29 |
| Login-Bremse: 5 Fehlversuche pro Adresse bzw. 20 pro IP in 15 Minuten → 15 Minuten Sperre; höchstens 3 Mails pro Adresse und Stunde | Übliche Werte, die echte Nutzer nicht stören und automatisches Raten sowie Mail-Spam bremsen | 2026-09-29 |
| Kein CAPTCHA im MVP, dafür höchstens 5 Registrierungen pro IP und Stunde | Die App läuft nur lokal und ist aus dem Internet nicht erreichbar. Die Registrierungsgrenze bremst einfache Skripte. Vor dem ersten gehosteten Betrieb muss ein CAPTCHA kommen (Offene Fragen). | 2026-09-29 |
| Angemeldet bleiben bis zur eigenen Abmeldung, kein automatischer Logout | Am Wasser soll niemand mit nassen Händen ein Passwort tippen. Das Gerät schützt die Bildschirmsperre. | 2026-09-29 |
| Zurücksetzen oder Ändern des Passworts meldet alle anderen Geräte ab | Wer sein Passwort wegen eines vermuteten fremden Zugriffs ändert, sperrt damit den Eindringling aus | 2026-09-29 |
| Konto-Seite: E-Mail nur lesen, Passwort ändern, Export, Löschen, Abmelden. Keine Änderung der E-Mail im MVP | Die Änderung der E-Mail braucht einen eigenen Bestätigungsablauf, der sich erst später lohnt | 2026-09-29 |
| Registrierung mit bereits registrierter Adresse zeigt denselben „Prüfe dein Postfach“-Bildschirm | Verrät nicht, wer Petrilog nutzt. Der Hinweis auf Login und „Passwort vergessen“ führt echte Besitzer trotzdem zurück. | 2026-09-29 |
| Bei erneuter Registrierung einer unbestätigten Adresse bleibt das erste Passwort gültig | Sonst könnte ein Fremder das Passwort eines noch unbestätigten Kontos vorab festlegen und nach der Bestätigung mitlesen | 2026-09-29 |
| Konto löschen sofort und endgültig, mit Passwort bestätigt | Einfacher und ehrlicher als eine Löschfrist. Die Passwortabfrage schützt vor versehentlichem Löschen und vor fremden Händen am entsperrten Handy. | 2026-09-29 |
| Datenexport als JSON-Datei, den spätere Features ergänzen | Ein Export für alle Daten statt eines Exports pro Feature. Die Datei ist maschinenlesbar, wie es die Datenübertragbarkeit verlangt. | 2026-09-29 |
| Bestätigungslink 24 Stunden, Link zum Zurücksetzen 1 Stunde gültig | Die Bestätigung darf etwas liegen bleiben. Der Link zum Zurücksetzen öffnet das Konto und soll deshalb nur kurz gelten. | 2026-09-29 |
