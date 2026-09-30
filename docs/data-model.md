# Datenmodell

> Die app-weite Übersicht, **welche Daten Petrilog speichert und wie sie zusammenhängen** — der gemeinsame Bauplan, an den sich die Tabellen jedes Features halten.
>
> - Erstellt von `/init` (erster Gesamtentwurf: Entitäten + Beziehungen).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Entitäten, Beziehungen und Eigentum stehen hier (Produktebene). Spaltentypen, Indizes und exakte Fremdschlüssel werden pro Feature in dessen `design.md` entschieden — nicht hier.

## Entitäten

| Entität | Was sie darstellt | Gehört / sichtbar für |
|---------|-------------------|------------------------|
| profiles | Das Konto eines Anglers, eins zu eins verknüpft mit dem Supabase-Auth-Nutzer. Wird bei der Registrierung automatisch angelegt. Enthält nur die Verknüpfung und das Anlagedatum; die E-Mail-Adresse liegt allein beim Auth-Nutzer. Platz für spätere Einstellungen. Verschwindet automatisch mit dem Konto, unbestätigte Konten nach 7 Tagen (PROJ-1). | nur der Nutzer selbst (lesen) |
| auth_throttle_events | Internes Protokoll der Login-Bremse: Passwortversuche, Mail-Anforderungen und Registrierungen mit E-Mail-Adresse (bei Registrierungen ohne), IP-Adresse, Ergebnis und Zeitpunkt. Wird nach 24 Stunden gelöscht (PROJ-1). | niemand außer dem Server |
| sessions | Ein Angelausflug: Start, Ende (leer, solange die Session läuft), Position mit Genauigkeit (optional), Gewässername und Notiz (optional) sowie eine Wetter-Momentaufnahme zum Start (PROJ-3). Dauer 1 Minute bis 48 Stunden. Bleibt bis zur Löschung durch den Nutzer bzw. des Kontos (PROJ-2). | nur der Besitzer |
| catches | Ein einzelner Fang innerhalb einer Session: Uhrzeit, Fischart (bei „Sonstige“ mit Artname), Länge, optional Gewicht, Köder, entnommen oder zurückgesetzt, eine eigene Kopie der Position mit Genauigkeit und Herkunft (GPS, von der Session, ohne) und eine Wetter-Momentaufnahme zur Fangzeit (PROJ-3). Bleibt bis zur Löschung durch den Nutzer, der Session bzw. des Kontos (PROJ-2). | nur der Besitzer |

**Bewusst keine eigenen Entitäten:**
- **Wetter** ist eine Momentaufnahme, die zur Session (zum Start) bzw. zum Fang (zur Fangzeit) gehört: Temperatur, Luftdruck auf Meereshöhe, Windgeschwindigkeit, Windrichtung, Bewölkung, Niederschlag, Wettercode, die volle Stunde, zu der die Werte gehören, und ein Status (ausstehend, vorhanden, fehlgeschlagen, ohne Position). Gespeichert wird es in eigenen Spalten derselben Zeile, genau einmal pro Eintrag, und mit dem Eintrag gelöscht. Ändert sich die Zeit eines Eintrags oder wird seine Position entfernt, verwirft die Datenbank das Wetter (PROJ-3).
- **Fischarten** sind eine feste Auswahlliste in der App (Barsch, Hecht, Zander … Sonstige), keine Tabelle. Eine eigene Tabelle käme erst infrage, wenn Nutzer eigene Arten anlegen sollen.

## Beziehungen

- Ein Profil hat viele Sessions.
- Eine Session gehört genau einem Profil und hat viele Fänge.
- Ein Fang gehört genau einer Session und damit demselben Nutzer. Den Nutzerbezug speichert der Fang zusätzlich selbst, damit die Datenbank die Zugriffsregel (Row Level Security: nur `user_id = auth.uid()`) direkt prüfen kann.
- Pro Nutzer kann höchstens **eine** Session gleichzeitig laufen, also ohne Ende sein. Die Sessions eines Nutzers überschneiden sich zeitlich nie, und jeder Fang liegt zeitlich innerhalb seiner Session. Beides garantiert die Datenbank (PROJ-2).
- Wird eine Session gelöscht, verschwinden auch ihre Fänge.
- **Wird ein Konto gelöscht, verschwindet alles:** Profil, Sessions und Fänge hängen am Konto und werden von der Datenbank automatisch mitgelöscht. Jede künftige Tabelle mit Nutzerdaten muss genauso gebunden sein und ergänzt den Datenexport um ihre Daten (festgelegt in PROJ-1).
- Das Protokoll der Login-Bremse hängt bewusst an keinem Konto. Es zählt auch Versuche für Adressen, zu denen es kein Konto gibt.
- **Bereit für die Karte:** Weil Sessions und Fänge Koordinaten und Genauigkeit schon mitbringen, kann die geplante Kartendarstellung später ohne Tabellenänderung dazukommen.

## Diagramm

```
profiles (1:1 Auth-Nutzer)
  └─ hat viele sessions   [max. 1 aktive]  + Wetter-Momentaufnahme
        └─ hat viele catches              + Wetter-Momentaufnahme
```

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Entität einführt oder ändert, wird diese Übersicht zuerst aktualisiert, damit spätere Features gegen ein genaues Bild bauen._
