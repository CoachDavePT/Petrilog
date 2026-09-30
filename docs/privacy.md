# Datenschutz-Nachweis: Was Petrilog mit personenbezogenen Daten macht

> Der ehrliche Überblick, welche personenbezogenen Daten Petrilog verarbeitet, wozu und wie lange.
>
> - Angelegt und aktuell gehalten von `/dsgvo`, ein Eintrag pro Verarbeitungszweck.
> - Wächst mit dem Produkt: Ändert ein Feature, was gespeichert wird, ändert sich auch sein Eintrag.
> - **Flughöhe:** Zwecke, Rechtsgrundlagen, Speicherdauer und wer die Daten sonst sieht. Details auf Feldebene stehen in `docs/data-model.md` und in den `design.md` der Features.
>
> Das entspricht weitgehend dem Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO; Art. 12 DSG), ist aber ein technisches Dokument und keine rechtliche Einreichung. Ob es für deinen Fall vollständig ist, entscheidet eine Anwältin oder ein Datenschutzbeauftragter.

**Anwendbares Recht:** DSGVO (EU/DE) und DSG (CH). Bei jeder Pflicht gilt die strengere Form (`.ai-eng-kit` → `law`, Regeln in `docs/law/`).
**Datenschutz-Haltung:** standard (`docs/PRD.md` → Rahmenbedingungen)
**Verantwortlicher:** _noch nicht festgelegt (siehe Offene Punkte)_
**Zuletzt geprüft:** 2026-09-30 (PROJ-2)

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Wessen | Warum rechtmäßig | Speicherdauer | Beteiligte Auftragsverarbeiter |
|-------|-------|--------|------------------|---------------|--------------------------------|
| Nutzerkonten betreiben (Registrierung, Login, Passwort zurücksetzen, Konto-Seite) — PROJ-1 | E-Mail-Adresse, Passwort (nur als Hash), Zeitpunkte von Anlage, Bestätigung und letzter Anmeldung, Anmelde-Tokens im Cookie, Profil (ID, Anlagedatum) | Registrierte Nutzer | DSGVO: Art. 6 Abs. 1 lit. b (Vertrag, ohne Konto kein Fangbuch) · DSG: erwartbarer Zweck, keine Rechtfertigung nötig | Bis zur Löschung des Kontos. Unbestätigte Konten werden nach 7 Tagen gelöscht. | Lokal: keiner. Gehostet: Supabase (EU), ein Mail-Dienst (noch offen) |
| Login und Mailversand vor Missbrauch schützen — PROJ-1 | E-Mail-Adresse und IP-Adresse fehlgeschlagener Versuche und angeforderter Mails, mit Zeitpunkt | Nutzer und Besucher, die Formulare abschicken | DSGVO: Art. 6 Abs. 1 lit. f (berechtigtes Interesse an der Sicherheit der Konten) · DSG: erwartbarer Zweck, keine Rechtfertigung nötig | Höchstens 24 Stunden | Lokal: keiner. Gehostet: Supabase (EU) |
| Bestätigungs- und Passwort-Mails verschicken — PROJ-1 | E-Mail-Adresse, Inhalt der Mail (Link) | Registrierte Nutzer | DSGVO: Art. 6 Abs. 1 lit. b · DSG: erwartbarer Zweck | Beim Mail-Dienst nach dessen Log-Aufbewahrung (noch offen) | Lokal: Mailpit (Test-Postfach, verlässt den Rechner nicht). Gehostet: Mail-Dienst (noch offen) |
| Fangbuch führen: Angel-Sessions und Fänge erfassen, anzeigen, bearbeiten — PROJ-2 | Zeitpunkte von Beginn und Ende jeder Session und jedes Fangs, GPS-Position (Breite, Länge, Genauigkeit) von Sessions und Fängen samt Herkunft, Gewässername, Notiz (Freitext), Fischart, Länge, Gewicht, Köder, entnommen/zurückgesetzt | Registrierte Nutzer (in Notizen ggf. auch Dritte, z. B. Angelpartner) | DSGVO: Art. 6 Abs. 1 lit. b (das Fangbuch ist die Leistung, die der Nutzer nutzen will) · DSG: erwartbarer Zweck, die Position wird nur auf Aktion des Nutzers erfasst, keine Rechtfertigung nötig | Bis der Nutzer die Session bzw. den Fang oder sein Konto löscht; Löschung sofort und endgültig | Lokal: keiner. Gehostet: Supabase (EU). Die Position ermittelt das Gerät bzw. der Browser des Nutzers (dessen Ortungsdienste liegen außerhalb der Verantwortung von Petrilog). Ab PROJ-3 gehen Position und Zeit an einen Wetterdienst, zu prüfen bei `/dsgvo PROJ-3` |

## Besonders schützenswerte Daten

- Keine im Sinne von Art. 9 DSGVO / Art. 5 lit. c DSG.
- **Besonders zu schützen, auch ohne Sonderkategorie:** die GPS-Positionen mit Zeitpunkten aus PROJ-2. Zusammen ergeben sie über die Zeit ein Bild, wann sich eine Person wo aufhält, und die Spots sind für Angler ausdrücklich geheim (PRD). Deshalb: nur für den Nutzer sichtbar (Row Level Security), nie in Adressen oder Logs, Abfrage nur auf Aktion des Nutzers, nie im Hintergrund.
- **Freitext-Notizen** (PROJ-2) können Angaben über Dritte oder, ungewollt, sensible Angaben enthalten. Sie werden wie alle Fangbuch-Daten nur dem Nutzer angezeigt und mit Session bzw. Konto gelöscht.

## Auftragsverarbeiter (Auftragsverarbeiter · Auftragsbearbeiter)

Solange die App nur lokal läuft, verarbeitet kein externer Dienst personenbezogene Daten. Die Zeilen unten gelten ab dem ersten gehosteten Betrieb.

| Dienst | Was er verarbeitet | Region | AVV / DPA unterschrieben | Außerhalb der angemessenen Staaten? |
|--------|--------------------|--------|--------------------------|-------------------------------------|
| Supabase | Alle Anwendungsdaten, Konten, Auth-Logs | eu-central-1 (Frankfurt), festgelegt in der PRD | ☐ (vor dem Deploy) | US-Unternehmen, Hosting in der EU. Das EU-US bzw. Swiss-US Data Privacy Framework ist zu prüfen. |
| Mail-Dienst (SMTP) für Bestätigungs- und Passwort-Mails | E-Mail-Adresse, Mail-Inhalt | _nicht festgelegt_ | ☐ | _nicht festgelegt_ |

## Rechte der betroffenen Personen

Frist: **30 Tage** (DSG Art. 25 Abs. 7). Das ist die strengere der beiden Fristen, die DSGVO gibt einen Kalendermonat (Art. 12 Abs. 3).

| Recht | DSGVO | DSG | Wie Petrilog es erfüllt |
|-------|-------|-----|-------------------------|
| Auskunft / Kopie | Art. 15 | Art. 25 | Konto-Seite → „Meine Daten exportieren“ (PROJ-1), ergänzt um alle Sessions und Fänge samt Positionen (PROJ-2) |
| Berichtigung | Art. 16 | Art. 32 | Fang- und Session-Daten direkt in der App bearbeiten (PROJ-2). Eine falsche Position kann entfernt werden; neu setzen geht erst mit der Karte. Eine Änderung der E-Mail-Adresse ist im MVP nicht eingebaut: auf Anfrage manuell. |
| Löschung | Art. 17 | Art. 32 Abs. 2 / Art. 6 Abs. 4 | Konto-Seite → „Konto löschen“ löscht Konto, Profil und alle zugehörigen Daten sofort (PROJ-1). Einzelne Sessions und Fänge lassen sich jederzeit endgültig löschen (PROJ-2). |
| Datenübertragbarkeit | Art. 20 | Art. 28 | Export als maschinenlesbare JSON-Datei (PROJ-1, mit Sessions und Fängen aus PROJ-2) |
| Widerspruch | Art. 21 | Art. 30 Abs. 2 | Betrifft nur den Missbrauchsschutz (berechtigtes Interesse). Die Daten verfallen nach 24 Stunden, ein Widerspruch wird auf Anfrage manuell bearbeitet. |

## Offene Punkte

- [ ] Verantwortlichen festlegen (Name bzw. Firma und Anschrift) — Pflichtangabe der Datenschutzerklärung
- [ ] Mail-Dienst für den gehosteten Betrieb wählen, AVV abschließen, hier eintragen (vor `/deploy`)
- [ ] AVV mit Supabase im Dashboard abschließen (vor `/deploy`)
- [ ] Text der Datenschutzerklärung von einer Anwältin oder aus einem seriösen Generator. Bis dahin enthält die Seite einen Platzhalter auf Basis dieses Dokuments (vor dem ersten gehosteten Betrieb).
- [ ] Impressum (DDG) bzw. Anbieterangaben (UWG CH) vor dem ersten gehosteten Betrieb
- [ ] Platzhalter der Datenschutzerklärung um Standort- und Fangbuch-Daten ergänzen (PROJ-2)

## Für eine Anwältin / einen Datenschutzbeauftragten

- **Mindestalter:** Angeln ist in Deutschland teils schon ab 10 Jahren erlaubt (Jugendfischereischein), Petrilog wird also auch Jugendliche anziehen. Das Konto beruht auf Vertrag (Art. 6 Abs. 1 lit. b DSGVO), nicht auf Einwilligung, Art. 8 DSGVO greift also nicht direkt. Frage: Brauchen wir ein Mindestalter oder eine Zustimmung der Eltern, und wie gehen wir in der Schweiz mit der Urteilsfähigkeit (Art. 16 ZGB) um?
- **Missbrauchsschutz auf Basis des berechtigten Interesses:** Wir speichern E-Mail- und IP-Adressen fehlgeschlagener Login-Versuche und angeforderter Mails höchstens 24 Stunden lang, um Passwort-Raten und Mail-Spam zu bremsen. Ist diese Frist vertretbar, und muss die Datenschutzerklärung das gesondert nennen?
- **Standortdaten und DSFA:** Petrilog speichert zu jeder Session und jedem Fang die GPS-Position mit Zeitpunkt, nur auf Aktion des Nutzers, nur für ihn sichtbar, ohne Auswertung über Personen. Nach unserer Einschätzung ist keine Datenschutz-Folgenabschätzung nötig (keine Profilbildung, keine Überwachung öffentlicher Räume, kein großer Umfang im MVP). Frage: Trifft das auch zu, wenn die App gehostet viele Nutzer hat? Maßstab ist die DSFA-Muss-Liste der DSK bzw. der zuständigen Landesbehörde, die Standort- und Bewegungsdaten teils ausdrücklich nennt.
