# PROJ-2: Sessions & Fänge

<!-- Diese Datei (spec.md) ist der stabile VERTRAG: Sie legt fest, WAS gebaut wird, nicht WIE.
     Owner: /write-spec (legt an), /refine (ändert). Während /build ist diese Datei SCHREIBGESCHÜTZT.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status und kein Datum hier: Der Status lebt NUR in features/INDEX.md. -->

## Abhängigkeiten
- **Braucht:** PROJ-1 (Registrierung & Login). Dazu gehören das Konto, die Anmeldeprüfung, das Muster „jeder sieht nur seine eigenen Daten“, der Datenexport und die Kontolöschung. PROJ-2 ergänzt den Export um seine Daten und muss beim Löschen des Kontos mitgelöscht werden (PROJ-1 EC-12).
- **Wird gebraucht von:** PROJ-3 (Automatische Wetterdaten). PROJ-3 ruft das Wetter zu Position und Zeit jeder Session und jedes Fangs ab und zeigt es in den Detailansichten dieses Features.
- **App-Rahmen:** PROJ-2 ist Owner von Kopfzeile, Tab-Leiste und der Leiste der aktiven Session (`docs/app-shell.md`). Die schlichte Startseite aus PROJ-1 wird zur Sessions-Übersicht.

## User Stories
- Als Angler am Wasser möchte ich eine Session mit einem Tipp starten, damit meine Angelzeit und mein Standort ohne Tipparbeit erfasst werden.
- Als Angler mit einer freien Hand möchte ich einen Fang in unter 30 Sekunden eintragen, damit ich schnell wieder angeln kann.
- Als Angler, der seinen Erfolg verbessern will, möchte ich auch Sessions ohne Fang festhalten und die Fänge pro Stunde sehen, damit meine Auswertung ehrlich bleibt.
- Als Angler, der sein Handy vergessen oder keinen Empfang hatte, möchte ich Sessions und Fänge nachtragen, damit mein Fangbuch vollständig ist.
- Als Angler, der sich vertippt hat, möchte ich Sessions und Fänge bearbeiten und löschen, damit mein Fangbuch stimmt.
- Als Angler, der seine Spots geheim hält, möchte ich, dass nur ich meine Sessions, Fänge und Positionen sehen kann.

## Nicht enthalten (Out of Scope)
- **Wetterdaten** abrufen, speichern und anzeigen: PROJ-3.
- **Karte**, Position per Tippen auf eine Karte setzen oder korrigieren, Gewässername-Vorschlag über externe Dienste (Nominatim): nächstes geplantes Feature nach diesem MVP.
- **Position einer Session oder eines Fangs nachträglich neu setzen** (außer beim Nachtragen, siehe AC-14): kommt mit der Karte. Entfernen ist möglich (AC-38).
- **Statistiken und Auswertungen** über mehrere Sessions (Fänge pro Angelstunde nach Uhrzeit, Luftdruck, Köder …). Einzige Kennzahl ist „Fänge pro Stunde“ je Session in der Detailansicht.
- **Offline-Modus** mit späterer Synchronisation. Ohne Verbindung wird nicht gespeichert, aber auch nichts verloren (EC-3).
- **Fotos**, Fangmeldungs-Export, Teilen, Vereinsfunktionen.
- **Eigene Fischarten dauerhaft anlegen.** „Sonstige“ mit Freitext deckt seltene Arten ab.
- **Automatisches Beenden** vergessener Sessions (siehe Produktentscheidungen).
- **Rückgängig nach dem Löschen.**
- **Mondphase, Wassertemperatur, Pegel.**

## Acceptance Criteria

### App-Rahmen & Übersicht
- [ ] **AC-1** — Angenommen ein Nutzer ist angemeldet, wenn er die App öffnet, dann sieht er die Sessions-Übersicht mit der Kopfzeile „Dein Fangbuch“ und der Tab-Leiste „Sessions · Start · Konto“, und alle seine Sessions stehen dort, die neueste zuerst, jeweils mit Datum, Gewässername (falls vorhanden), Dauer bzw. „Läuft“ und Anzahl der Fänge
- [ ] **AC-2** — Angenommen ein Nutzer hat noch keine Session, wenn er die Übersicht öffnet, dann sieht er die Karte „Bereit für den nächsten Wurf?“ mit „Session starten“ und darunter „Session nachtragen“
- [ ] **AC-3** — Angenommen ein Nutzer ist angemeldet, wenn er den Tab „Start“ antippt, dann öffnet sich ohne laufende Session „Session starten“ und mit laufender Session deren Detailansicht
- [ ] **AC-4** — Angenommen eine Session läuft, wenn der Nutzer eine Hauptseite (Übersicht, Konto) sieht, dann schwebt über der Tab-Leiste die Leiste der aktiven Session mit Gewässername (oder „Ohne Gewässer“), Laufzeit, Anzahl der Fänge und „Fang eintragen“. Ein Tipp auf die Leiste öffnet die Detailansicht
- [ ] **AC-5** — Angenommen ein Nutzer ist angemeldet, wenn er den Tab „Konto“ antippt, dann sieht er die Konto-Seite aus PROJ-1 innerhalb dieses Rahmens

### Session starten
- [ ] **AC-6** — Angenommen ein Nutzer hat keine laufende Session, wenn er „Session starten“ öffnet, optional Gewässername und Notiz eingibt und „Starten“ antippt, dann entsteht eine Session mit der aktuellen Uhrzeit als Start und der aktuellen GPS-Position samt Genauigkeit, er landet in ihrer Detailansicht und sieht „Session gestartet“
- [ ] **AC-7** — Angenommen ein Nutzer tippt einen Gewässernamen, wenn er früher schon Gewässernamen verwendet hat, dann schlägt die App passende eigene Namen vor, die zuletzt genutzten zuerst. Der Name hat höchstens 80 Zeichen, die Notiz höchstens 500 Zeichen
- [ ] **AC-8** — Angenommen die Standortfreigabe ist verweigert oder nach 10 Sekunden liegt keine Position vor, wenn der Nutzer eine Session startet, dann wird sie trotzdem gestartet, als „Ohne Position“ gekennzeichnet, und der Nutzer sieht einen Hinweis, dass die Position fehlt
- [ ] **AC-9** — Angenommen ein Nutzer hat bereits eine laufende Session (z. B. auf einem anderen Gerät gestartet), wenn er eine weitere starten will, dann entsteht keine zweite Session, er landet in der Detailansicht der laufenden und sieht „Es läuft bereits eine Session.“

### Session beenden
- [ ] **AC-10** — Angenommen eine Session läuft, wenn der Nutzer „Session beenden“ antippt, dann kann er die Endzeit wählen („Jetzt“ vorausgewählt, alternativ „Zeit des letzten Fangs“ oder eine eigene Uhrzeit), und nach dem Bestätigen ist die Session beendet, die Dauer wird angezeigt, er sieht „Session beendet · 1:42 h“ und die Leiste der aktiven Session verschwindet
- [ ] **AC-11** — Angenommen eine Session läuft seit mindestens 12 Stunden, wenn der Nutzer die Leiste der aktiven Session oder die Detailansicht sieht, dann steht dort der Hinweis „Läuft seit über 12 Stunden. Vergessen zu beenden?“ mit der Aktion „Beenden“
- [ ] **AC-12** — Angenommen der Nutzer wählt beim Beenden eine Endzeit, wenn sie vor dem Start, vor dem letzten Fang, in der Zukunft oder mehr als 48 Stunden nach dem Start liegt, dann wird nichts gespeichert und am Feld erscheint eine verständliche Meldung, die die erlaubte Spanne nennt

### Session nachtragen
- [ ] **AC-13** — Angenommen ein Nutzer ist auf der Übersicht, wenn er „Session nachtragen“ öffnet, Start und Ende (Datum und Uhrzeit, Pflicht) sowie optional Gewässername und Notiz eingibt und speichert, dann entsteht eine beendete Session ohne Position, er landet in ihrer Detailansicht und sieht „Session gespeichert“
- [ ] **AC-14** — Angenommen ein Nutzer trägt eine Session nach, wenn er „Ich bin noch am Gewässer: aktuelle Position verwenden“ einschaltet (standardmäßig aus), dann wird die aktuelle GPS-Position samt Genauigkeit gespeichert (mit denselben Regeln wie AC-8)
- [ ] **AC-15** — Angenommen ein Nutzer trägt eine Session nach oder bearbeitet ihre Zeiten, wenn das Ende nicht nach dem Start liegt, die Dauer kürzer als 1 Minute oder länger als 48 Stunden ist oder eine Zeit in der Zukunft liegt, dann wird nichts gespeichert, die Eingaben bleiben erhalten und am Feld erscheint eine verständliche Meldung. Das gilt auch, wenn die Prüfung im Browser umgangen wird
- [ ] **AC-16** — Angenommen ein Nutzer trägt eine Session nach oder bearbeitet ihre Zeiten, wenn sie sich zeitlich mit einer anderen eigenen Session überschneidet (auch mit der laufenden), dann wird nichts gespeichert und er sieht, mit welcher Session sie sich überschneidet („Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.“)

### Session bearbeiten & löschen
- [ ] **AC-17** — Angenommen ein Nutzer ist in der Detailansicht einer Session, wenn er „Bearbeiten“ antippt, dann kann er Gewässername, Notiz, Startzeit und (bei beendeten Sessions) Endzeit ändern, die Position bleibt unverändert (Entfernen siehe AC-38), und nach dem Speichern sieht er „Session gespeichert“
- [ ] **AC-18** — Angenommen eine Session hat Fänge, wenn der Nutzer ihre Zeiten so ändert, dass ein Fang außerhalb läge, dann wird nichts gespeichert und er sieht, welcher Fang betroffen ist (Uhrzeit und Art)
- [ ] **AC-19** — Angenommen ein Nutzer ist in der Detailansicht einer Session, wenn er „Session löschen“ antippt, dann erscheint ein Bestätigungsdialog, der die Anzahl der mitgelöschten Fänge nennt. Nach dem Bestätigen sind Session und alle ihre Fänge endgültig gelöscht, er landet auf der Übersicht und sieht „Session gelöscht“. Das gilt auch für eine laufende Session, danach verschwindet deren Leiste

### Fang eintragen
- [ ] **AC-20** — Angenommen eine Session läuft, wenn der Nutzer „Fang eintragen“ (in der Leiste oder in der Detailansicht) antippt, Art und Länge wählt und „Fang speichern“ antippt, dann wird der Fang mit der aktuellen Uhrzeit und der aktuellen GPS-Position samt Genauigkeit gespeichert, er landet in der Detailansicht der Session und sieht „Fang gespeichert“
- [ ] **AC-21** — Angenommen der Nutzer wählt eine Fischart, wenn er die Liste öffnet, dann stehen dort Barsch, Hecht, Zander, Aal, Karpfen, Schleie, Brasse, Rotauge, Wels, Bachforelle, Regenbogenforelle, Meerforelle, Dorsch, Hering, Hornhecht, Plattfisch und „Sonstige“, wobei seine zuletzt genutzten Arten oben stehen. Bei „Sonstige“ ist ein Artname Pflicht (höchstens 40 Zeichen)
- [ ] **AC-22** — Angenommen ein Nutzer speichert einen Fang, wenn Art, Länge (ganze Zentimeter, 1 bis 250) oder „entnommen / zurückgesetzt“ fehlen oder ungültig sind, das Gewicht (optional) nicht zwischen 1 und 150.000 ganzen Gramm liegt oder der Köder (optional) länger als 60 Zeichen ist, dann wird nichts gespeichert, die Eingaben bleiben erhalten und am betroffenen Feld erscheint eine verständliche Meldung. Das gilt auch, wenn die Prüfung im Browser umgangen wird
- [ ] **AC-23** — Angenommen ein Nutzer öffnet „Fang eintragen“, wenn die Session schon einen Fang hat, dann sind Köder und „entnommen / zurückgesetzt“ mit den Werten des letzten Fangs dieser Session vorbelegt. Beim ersten Fang ist „zurückgesetzt“ vorbelegt und der Köder leer
- [ ] **AC-24** — Angenommen ein Nutzer trägt einen Fang ein, wenn die Fangzeit (Standard „jetzt“, änderbar) vor dem Start oder nach dem Ende der Session liegt, bei einer laufenden Session in der Zukunft oder mehr als 48 Stunden nach dem Start, dann wird nichts gespeichert und am Feld erscheint die erlaubte Spanne. Start und Ende selbst sind erlaubt
- [ ] **AC-25** — Angenommen die Standortfreigabe ist verweigert oder nach 10 Sekunden liegt keine Position vor, wenn der Nutzer einen Fang in einer laufenden Session speichert, dann wird der Fang mit der Position der Session gespeichert und als „Position von der Session“ gekennzeichnet. Hat auch die Session keine Position, wird er als „Ohne Position“ gespeichert
- [ ] **AC-26** — Angenommen eine Session ist beendet, wenn der Nutzer in ihrer Detailansicht „Fang nachtragen“ antippt und einen Fang mit einer Uhrzeit innerhalb der Session speichert, dann wird die Position der Session übernommen (gekennzeichnet wie in AC-25), ohne dass die App den aktuellen Standort abfragt

### Fang bearbeiten & löschen
- [ ] **AC-27** — Angenommen ein Nutzer tippt in der Detailansicht einer Session auf einen Fang, wenn er die Angaben ändert und speichert, dann gelten dieselben Regeln wie beim Eintragen (AC-21, AC-22, AC-24), die Position bleibt unverändert (Entfernen siehe AC-38) und er sieht „Fang gespeichert“
- [ ] **AC-28** — Angenommen ein Nutzer bearbeitet einen Fang, wenn er „Fang löschen“ antippt und den Bestätigungsdialog bestätigt, dann ist der Fang endgültig gelöscht, er landet in der Detailansicht der Session und sieht „Fang gelöscht“

### Detailansicht
- [ ] **AC-29** — Angenommen ein Nutzer öffnet eine Session, wenn die Detailansicht erscheint, dann sieht er Gewässername, Datum, Start, Ende bzw. „Läuft“, Dauer, Notiz, Position (Koordinaten mit Genauigkeit, z. B. „± 12 m“, oder „Ohne Position“), die Kennzahl „Fänge pro Stunde“ und alle Fänge nach Uhrzeit sortiert mit Art, Länge, Gewicht, Köder, „entnommen“ oder „zurückgesetzt“ und ihrer Position samt Herkunft („GPS“, „von der Session“, „ohne Position“)
- [ ] **AC-30** — Angenommen eine Session wird angezeigt, wenn die Kennzahl „Fänge pro Stunde“ berechnet wird, dann ist sie die Anzahl der Fänge geteilt durch die Dauer in Stunden, mit einer Nachkommastelle im deutschen Format („1,7“), bei einer laufenden Session bis jetzt gerechnet
- [ ] **AC-31** — Angenommen eine Session hat keine Fänge, wenn der Nutzer sie öffnet, dann sieht er „Noch keine Fänge. Petri Heil!“ und „Fänge pro Stunde: 0,0“. Die Session bleibt gespeichert und zählt wie jede andere

### Zugriffsschutz
- [ ] **AC-32** — Angenommen zwei Nutzer A und B haben Sessions, wenn B Sessions oder Fänge von A abfragen, ändern, löschen oder einer Session von A einen Fang hinzufügen will, egal ob über die App (auch mit der Kennung aus einer Adresse) oder direkt über die Datenbank-Schnittstelle mit seinem eigenen Zugang, dann erhält er keine Daten von A und kann nichts davon verändern
- [ ] **AC-33** — Angenommen ein Aufrufer ist nicht angemeldet, wenn er Sessions oder Fänge über die App oder die Datenbank-Schnittstelle abfragt, dann erhält er keine Daten und wird in der App zum Login geleitet
- [ ] **AC-34** — Angenommen ein Nutzer gibt Gewässernamen ein, wenn Vorschläge erscheinen (AC-7), dann stammen sie ausschließlich aus seinen eigenen Sessions

### Datenschutz
- [ ] **AC-35** — Angenommen ein Nutzer hat Sessions und Fänge, wenn er auf der Konto-Seite „Meine Daten exportieren“ antippt, dann enthält die JSON-Datei zusätzlich zu den Daten aus PROJ-1 alle seine Sessions und Fänge mit sämtlichen Angaben, Zeitpunkten und Positionen samt Genauigkeit und Herkunft (Art. 15, 20 DSGVO; Art. 25, 28 DSG)
- [ ] **AC-36** — Angenommen ein Nutzer verwendet die App, wenn er Seiten öffnet oder liest, dann fragt die App seinen Standort nicht ab. Sie fragt ihn nur in dem Moment ab, in dem er eine Session startet, einen Fang in einer laufenden Session speichert oder beim Nachtragen „aktuelle Position verwenden“ einschaltet, nie im Hintergrund und nie fortlaufend (Art. 5 Abs. 1 lit. c, Art. 25 DSGVO; Art. 6 Abs. 2, Art. 7 DSG)
- [ ] **AC-37** — Angenommen ein Nutzer will zum ersten Mal eine Position speichern lassen, wenn die App den Standort abfragen will, dann erklärt sie vorher in einem Satz, wozu die Position gespeichert wird und dass nur er sie sieht, mit Link zur Datenschutzerklärung, und erst danach erscheint die Abfrage des Browsers (Art. 13 DSGVO; Art. 19 DSG)
- [ ] **AC-38** — Angenommen eine Session oder ein Fang hat eine Position, wenn der Nutzer beim Bearbeiten „Position entfernen“ antippt und bestätigt, dann ist die Position endgültig gelöscht und der Eintrag gilt als „Ohne Position“. Fänge, die ihre Position von der Session übernommen haben, behalten ihre eigene Kopie, bis sie selbst entfernt wird (Art. 16, 17 DSGVO; Art. 32 DSG)
- [ ] **AC-39** — Angenommen ein Nutzer öffnet die Datenschutzerklärung, wenn er sie liest, dann nennt sie auch die Fangbuch-Daten aus PROJ-2 (Positionen mit Zeitpunkt, Gewässer, Notizen, Fangangaben), wozu sie gespeichert werden, dass nur er sie sieht und dass sie bis zur Löschung durch ihn bzw. bis zur Kontolöschung gespeichert bleiben (Art. 13 DSGVO; Art. 19 DSG)
- [ ] **AC-40** — Angenommen ein Nutzer löscht einen Fang, eine Session oder sein Konto, wenn die Löschung bestätigt ist, dann sind die Daten samt Positionen sofort aus der Datenbank entfernt und nicht nur ausgeblendet (Art. 5 Abs. 1 lit. e, Art. 17 DSGVO; Art. 6 Abs. 4 DSG)

## Edge Cases
- **EC-1** — Angenommen ein Nutzer startet auf zwei Geräten gleichzeitig eine Session, wenn beide Anfragen ankommen, dann entsteht genau eine laufende Session, und das zweite Gerät verhält sich wie in AC-9
- **EC-2** — Angenommen ein Nutzer tippt „Fang speichern“ (oder „Starten“, „Session speichern“) zweimal schnell hintereinander oder die App wiederholt das Speichern nach einem Verbindungsabbruch, wenn beide Anfragen ankommen, dann entsteht höchstens ein Fang bzw. eine Session, und der Button ist während der Verarbeitung gesperrt
- **EC-3** — Angenommen die Verbindung bricht ab oder der Server ist nicht erreichbar, wenn der Nutzer eine Session startet, beendet, nachträgt oder einen Fang speichert, dann sieht er „Keine Verbindung. Bitte versuche es erneut.“ als Notice im Warnton, alle Eingaben bleiben erhalten, auch die beim ersten Versuch erfasste Fangzeit und Position, und ein erneuter Versuch speichert genau diese Werte
- **EC-4** — Angenommen eine Session wurde auf einem anderen Gerät beendet, wenn der Nutzer auf diesem Gerät einen Fang mit einer Uhrzeit nach dem Ende speichert, dann wird nichts gespeichert und er sieht „Die Session wurde inzwischen beendet (Ende 18:40).“. Liegt die Uhrzeit innerhalb der Session, wird der Fang gespeichert
- **EC-5** — Angenommen eine Session wurde auf einem anderen Gerät gelöscht, wenn der Nutzer auf diesem Gerät einen Fang einträgt, die Session bearbeitet oder beendet, dann wird nichts gespeichert, er sieht „Diese Session gibt es nicht mehr.“ und landet auf der Übersicht
- **EC-6** — Angenommen eine vergessene Session läuft seit mehr als 48 Stunden, wenn der Nutzer sie beendet, dann ist „Jetzt“ nicht wählbar, er muss eine Endzeit innerhalb von 48 Stunden nach dem Start wählen, und die Zeit des letzten Fangs ist vorgeschlagen (ohne Fänge ist nichts vorausgewählt). Weil eine laufende Session keine Fänge nach der 48-Stunden-Marke annimmt (AC-24), gibt es immer eine gültige Endzeit
- **EC-7** — Angenommen die GPS-Position ist sehr ungenau (z. B. ± 800 m), wenn eine Session oder ein Fang gespeichert wird, dann wird die Position trotzdem mit ihrer Genauigkeit gespeichert und in der Detailansicht so angezeigt („± 800 m“)
- **EC-8** — Angenommen eine Session geht über Mitternacht oder über eine Zeitumstellung, wenn Dauer und Fänge pro Stunde angezeigt werden, dann beruhen sie auf der tatsächlich vergangenen Zeit, und die Session steht in der Übersicht unter ihrem Startdatum
- **EC-9** — Angenommen ein Nutzer bearbeitet die Startzeit einer laufenden Session, wenn die neue Startzeit in der Zukunft, nach dem ersten Fang oder in einer anderen Session liegt, dann wird nichts gespeichert und die Meldung nennt den Grund (AC-15, AC-16, AC-18)
- **EC-10** — Angenommen ein Nutzer bearbeitet einen Fang, während die Session auf einem anderen Gerät so geändert wurde, dass die Fangzeit nicht mehr hineinpasst, wenn er speichert, dann wird nichts gespeichert und am Feld erscheint die aktuelle erlaubte Spanne
- **EC-11** — Angenommen ein Nutzer hat eine laufende Session, wenn er sein Konto löscht (PROJ-1), dann werden die laufende Session und alle Sessions und Fänge mitgelöscht und es bleibt nichts zurück (PROJ-1 EC-12)
- **EC-12** — Angenommen ein Nutzer hat sehr viele Sessions (z. B. 500), wenn er die Übersicht öffnet, dann erscheinen die neuesten sofort und ältere lassen sich nachladen, ohne dass die Seite spürbar hängt
- **EC-13** — Angenommen ein Nutzer hat eine Session versehentlich beendet, wenn er sie wieder aufnehmen will, dann ist das nicht möglich: Eine beendete Session läuft nie wieder. Er korrigiert die Endzeit über „Bearbeiten“ (höchstens bis jetzt) und trägt weitere Fänge über „Fang nachtragen“ ein, oder er startet eine neue Session

## Technische Anforderungen
- **Tempo am Wasser:** Vom Tipp auf „Fang eintragen“ in der Leiste bis „Fang gespeichert“ vergehen am Smartphone weniger als 30 Sekunden, wenn nur Art und Länge eingegeben werden (Erfolgskriterium der PRD).
- **Zugriffsschutz doppelt:** in der App und in der Datenbank selbst (Row Level Security, Muster aus PROJ-1), siehe AC-32 bis AC-34. Jeder Fang trägt zusätzlich den Nutzerbezug, damit die Datenbank die Regel direkt prüfen kann (`docs/data-model.md`).
- **Positionen sind privat:** Koordinaten stehen nie in Adressen (URLs), nie in Server-Logs und werden nur dem Besitzer angezeigt.
- **Zeit und Format:** Zeiten gelten in der Ortszeit des Geräts (Europe/Berlin), minutengenau. Zahlen und Einheiten im deutschen Format, metrisch (`31 cm`, `1.250 g`, `1,7`).
- **Kartenbereit:** Sessions und Fänge speichern Breite, Länge und Genauigkeit so, dass die geplante Karte ohne Tabellenänderung dazukommen kann.
- **Wetterbereit:** PROJ-3 muss Wetter zu jeder Session und jedem Fang ergänzen können, ohne dass PROJ-2 dafür Eingaben braucht.
- **Mobile-first:** Hauptbutton groß im Daumenbereich, Zahlenfelder mit Zahlentastatur, Touch-Ziele mindestens 44 px (`docs/design-system.md`, `docs/app-shell.md`).
- **Sprache:** Alle Texte und Meldungen auf Deutsch.

## Offene Fragen
- [ ] Artenliste nach den ersten Wochen Nutzung überprüfen: Welche „Sonstige“-Namen kommen häufig vor und gehören in die Liste?
- [ ] Frage an eine Anwältin vor dem ersten gehosteten Betrieb: Braucht die Speicherung von Positionen mit Zeitpunkt bei vielen Nutzern eine Datenschutz-Folgenabschätzung (DSK-Muss-Liste)? Siehe `docs/privacy.md`

## Entscheidungsprotokoll

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Vergessene Sessions werden nicht automatisch beendet. Ab 12 h erscheint ein Hinweis, beim Beenden ist die Endzeit wählbar (jetzt, letzter Fang, eigene Zeit) | Eine automatische Endzeit wäre geraten und würde die Fänge pro Stunde verfälschen. Der Angler weiß selbst am besten, wann er aufgehört hat. | 2026-09-30 |
| Sessions eines Nutzers dürfen sich zeitlich nicht überschneiden | Sonst zählt dieselbe Angelzeit doppelt, und die Fänge pro Stunde werden falsch | 2026-09-30 |
| An einer Session sind Gewässername, Notiz, Start- und Endzeit änderbar, die Position nicht | Zeiten müssen korrigierbar sein, damit die Angelzeit stimmt. Die Position zu ändern braucht eine Karte, die erst später kommt. | 2026-09-30 |
| Bis zu 10 Sekunden auf GPS warten, dann ohne speichern und kennzeichnen. Fang ohne GPS übernimmt die Position der Session | Am Wasser zählt jede Sekunde, und kein Eintrag darf an fehlendem Empfang scheitern. Die Kennzeichnung hält die Datenqualität ehrlich. | 2026-09-30 |
| 16 gängige Arten für Süßwasser, Küste und Bodden, dazu „Sonstige“ mit Pflicht-Artnamen; zuletzt genutzte Arten oben | Deckt die Zielgruppe ab, ohne die Liste unhandlich zu machen. Der Artname bei „Sonstige“ erhält die Aussagekraft für spätere Auswertungen. | 2026-09-30 |
| Pflicht beim Fang: Art, Länge (1–250 cm), entnommen/zurückgesetzt. Gewicht (1–150.000 g) und Köder (max. 60 Zeichen) optional; Köder und entnommen/zurückgesetzt vom letzten Fang der Session vorbelegt | Länge ist das wichtigste Maß und schnell gemessen. Die Vorbelegung spart Tipparbeit, weil sich Köder und Entnahme innerhalb einer Session selten ändern. | 2026-09-30 |
| Keine Zeiten in der Zukunft; eine Session dauert 1 Minute bis 48 Stunden; Nachtragen beliebig weit zurück | Fängt Tippfehler wie ein falsches Jahr ab, lässt aber Nachtangeln über zwei Tage zu | 2026-09-30 |
| Gewässername optional als Freitext mit Vorschlägen aus den eigenen früheren Namen | Schnell am Wasser, gleiche Schreibweise für dasselbe Gewässer, und kein externer Dienst sieht die Spots | 2026-09-30 |
| Löschen von Fang und Session nur nach Bestätigungsdialog, endgültig | Einfach und eindeutig. Der Dialog nennt bei Sessions die Zahl der mitgelöschten Fänge. | 2026-09-30 |
| Nachgetragene Sessions haben standardmäßig keine Position; optional „Ich bin noch am Gewässer: aktuelle Position verwenden“ | Die aktuelle Position ist beim Nachtragen meist falsch (z. B. zu Hause). Wer direkt am Wasser nachträgt, bekommt trotzdem eine Position und damit später Wetterdaten. | 2026-09-30 |
| Sessions ohne Fang bleiben gespeichert und zählen mit | Ohne „Schneidertage“ wären die Fänge pro Stunde geschönt, und genau das soll Petrilog vermeiden | 2026-09-30 |
| Falsche Positionen lassen sich entfernen, aber nicht neu setzen (aus der Datenschutz-Prüfung) | Berichtigung verlangt, dass falsche Standortdaten nicht stehen bleiben müssen. Eine neue Position ohne Karte wäre geraten, deshalb nur Entfernen bis zur Karte. | 2026-09-30 |
| Fangzeiten einer laufenden Session höchstens 48 Stunden nach dem Start (nach QA, BUG-1) | Eine Session dauert höchstens 48 Stunden. Ein späterer Fang hätte eine vergessene Session unbeendbar gemacht. Wer länger angelt, beendet und startet eine neue Session. | 2026-09-30 |
