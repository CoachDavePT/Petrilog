# App-Rahmen & Navigation

> Die app-weite Übersicht über **den Rahmen, in dem jedes Feature angezeigt wird**: Navigation, Layout-Bereiche und die Muster, die jede Seite wiederholt.
>
> - Erstellt von `/init` (erster Gesamtentwurf: Hauptbereiche + Layout).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Struktur, nicht Gestaltung. Welche Bereiche es gibt, wo sie liegen, wer sie sieht, was jede Seite gemeinsam hat. Farben, Schriften und Komponenten-Styling stehen in `docs/design-system.md`; das Innenleben einer einzelnen Seite im `design.md` des jeweiligen Features.

## Verantwortliches Feature

Owner: PROJ-2 (Sessions & Fänge). Die Sessions-Übersicht trägt Kopfzeile, Tab-Leiste und die Leiste der aktiven Session. Änderungen am Rahmen laufen über `/refine PROJ-2`, nicht über das `design.md` eines anderen Features.

## Hauptbereiche

| Bereich | Was der Nutzer dort tut | Sichtbar für | Feature |
|---------|-------------------------|--------------|---------|
| Sessions | Übersicht aller Sessions (neueste zuerst), Einstieg in die Detailansicht, „Session nachtragen“ | angemeldet | PROJ-2 |
| Start | Keine eigene Seite, sondern eine Aktion: Ohne aktive Session öffnet sie „Session starten“, mit aktiver Session deren Detailansicht. | angemeldet | PROJ-2 |
| Konto | Eigene E-Mail-Adresse und „Abmelden“ | angemeldet | PROJ-1 |

## Layout-Bereiche

- **Kopfzeile (AppBar):** Auf Hauptseiten groß mit Überschrift und Titel (z. B. „Dein Fangbuch“ / „Sessions“). Auf Unterseiten kompakt mit Zurück- bzw. Schließen-Button links und optional einer Aktion rechts (z. B. Löschen).
- **Inhalt:** Eine Spalte mit höchstens 440 px Breite und 20 px Seitenrand. Auf Tablet und Desktop wird dieselbe Spalte mittig angezeigt, ein eigenes Desktop-Layout gibt es nicht.
- **Unten auf Hauptseiten:** Die Tab-Leiste (Sessions · Start · Konto). Läuft eine Session, schwebt darüber die **Leiste der aktiven Session** mit Gewässer, Laufzeit, Anzahl der Fänge und dem Schnellzugriff „Fang eintragen“.
- **Unten auf Unterseiten** (Detailansicht, Formulare): Keine Tab-Leiste, dafür ein großer Hauptbutton über die volle Breite im Daumenbereich (z. B. „Fang speichern“).
- **Mobil:** Das ist das primäre Layout. Es gibt kein Burger-Menü und keine Seitenleiste; die Navigation läuft über die Tab-Leiste unten.

## Seitenmuster

- **Kopf:** Titel in der AppBar. Die Hauptaktion sitzt als großer Button unten im Daumenbereich, nicht oben rechts.
- **Laden:** Platzhalter in Kartenform (Skeleton) an der Stelle der späteren Inhalte, kein ganzseitiger Spinner.
- **Leer:** Ein kurzer, freundlicher Satz mit passender Aktion, z. B. „Noch keine Fänge. Petri Heil!“ oder die Karte „Bereit für den nächsten Wurf?“ mit „Session starten“.
- **Fehler:** Eine Notice im Warnton direkt im Inhalt mit verständlichem Text. Eingaben gehen dabei nicht verloren.
- **Rückmeldung:** Eine Erfolgs-Notice oben am Bildschirm, die nach etwa 2 Sekunden verschwindet (z. B. „Fang gespeichert“, „Session beendet · 1:42 h“).

## Anmeldezustand

- **Abgemeldet:** Nur Login, Registrierung und „Passwort vergessen“, ohne Tab-Leiste, auf dunklem Wald-Hintergrund mit dem Schriftzug „Petrilog“. Ohne Anmeldung erreichbar sind außerdem die Datenschutzerklärung sowie die Ziele der Mail-Links (Bestätigung, abgelaufener Link). Diese Seiten sind hell, ohne Rahmen und mit kompakter Kopfzeile. Jede andere Adresse leitet zum Login um (PROJ-1).
- **Seiten ohne Rahmen für Angemeldete:** „Neues Passwort festlegen“ (Ziel des Links zum Zurücksetzen) hat keine Tab-Leiste, nur eine kompakte Kopfzeile (PROJ-1).
- **Angemeldet:** Alle drei Tabs. Wer angemeldet die Login-Seite aufruft, landet in der Sessions-Übersicht.
- **Rollen:** In dieser Version keine.

## Rahmen-Bausteine

Wo die Dateien liegen, legt `/architecture` für PROJ-2 fest. Kein Feature baut eine eigene Navigation.

| Baustein | Datei | Zweck |
|----------|-------|-------|
| AppBar | _festgelegt in PROJ-2 `design.md`_ | Kopfzeile, groß (Hauptseiten) und kompakt (Unterseiten) |
| TabBar | _festgelegt in PROJ-2 `design.md`_ | Navigation Sessions · Start · Konto |
| ActiveSessionBar | _festgelegt in PROJ-2 `design.md`_ | Schwebende Leiste der laufenden Session mit „Fang eintragen“ |
| Layout der angemeldeten App | `src/app/(app)/layout.tsx`: angelegt von PROJ-1 mit der Anmeldeprüfung; PROJ-2 ergänzt Kopfzeile, Tab-Leiste und die Leiste der aktiven Session | Umschließt alle angemeldeten Seiten, prüft die Anmeldung |
| Layout für Abgemeldete | `src/app/(auth)/layout.tsx` (PROJ-1) | Wald-Hintergrund mit Schriftzug für Login, Registrierung und „Passwort vergessen“ |
| Anmeldegrenze | `src/proxy.ts` (PROJ-1) | Erneuert die Anmeldung, leitet Abgemeldete zum Login und Angemeldete von den Login-Seiten weg |

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das einen Navigationseintrag, einen Layout-Bereich oder ein neues Seitenmuster hinzufügt, wird diese Übersicht zuerst aktualisiert. Verhaltensänderungen am Rahmen laufen über `/refine` auf dem verantwortlichen Feature, nie direkt über das `design.md` eines Features._
