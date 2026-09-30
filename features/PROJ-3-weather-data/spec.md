# PROJ-3: Automatische Wetterdaten

<!-- Diese Datei (spec.md) ist der stabile VERTRAG: Sie legt fest, WAS gebaut wird, nicht WIE.
     Owner: /write-spec (legt an), /refine (ändert). Während /build ist diese Datei SCHREIBGESCHÜTZT.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status und kein Datum hier: Der Status lebt NUR in features/INDEX.md. -->

## Abhängigkeiten
- **Braucht:** PROJ-2 (Sessions & Fänge). Dazu gehören Sessions und Fänge mit Zeit und Position, die Detailansicht der Session, die Fang-Seite, „Position entfernen“, der Datenexport und die Datenschutzerklärung. PROJ-3 füllt den Platz, den PROJ-2 in der Detailansicht für das Wetter frei gelassen hat.
- **Braucht:** PROJ-1 (Registrierung & Login), also das Muster „jeder sieht nur seine eigenen Daten“, den Datenexport und die Kontolöschung.
- **Externer Dienst:** Open-Meteo (kostenlos, ohne API-Key), liefert aktuelle und vergangene stündliche Wetterdaten.

## User Stories
- Als Angler am Wasser möchte ich, dass das Wetter zu meiner Session und zu jedem Fang von selbst gespeichert wird, damit ich dafür keine Sekunde verliere.
- Als Angler, der seinen Erfolg verbessern will, möchte ich zu jedem Fang Luftdruck, Wind, Temperatur und Bewölkung sehen, damit ich später erkenne, bei welchem Wetter ich wirklich fange.
- Als Angler, der Sessions nachträgt, möchte ich auch dafür das Wetter von damals bekommen, damit nachgetragene Einträge genauso vollständig sind wie live erfasste.
- Als Angler mit schlechtem Empfang am Wasser möchte ich, dass mein Fang auch ohne Wetter sofort gespeichert wird und das Wetter später nachkommt, damit nie ein Eintrag verloren geht.
- Als Angler, der seine Spots geheim hält, möchte ich, dass der Wetterdienst meinen genauen Spot nicht erfährt und nur ich meine Wetterdaten sehe.

## Nicht enthalten (Out of Scope)
- **Wetter am Ende der Session** oder ein Wetterverlauf über die Session. Die Session speichert das Wetter beim Start, jeder Fang sein eigenes.
- **Luftdruck-Tendenz** (steigend, fallend): möglicher späterer Ausbau.
- **Wetter von Hand eintragen oder ändern.** Die Werte kommen immer vom Wetterdienst.
- **Wetter für Einträge ohne Position**, z. B. anhand des Gewässernamens. Ohne Position wird kein Wetter abgerufen.
- **Statistiken nach Wetter** (Fänge pro Angelstunde nach Luftdruck, Wind …): eigenes späteres Feature.
- **Mondphase, Wassertemperatur, Pegelstände, Wettervorhersage.**
- **Wetterwerte in der Session-Übersicht oder in der Fangzeile.** Dort steht höchstens die Kennzeichnung „ohne Wetter“ (AC-17).
- **Karte** und Positionen per Karte setzen: späteres Feature.

## Acceptance Criteria

### Wetter abrufen
- [ ] **AC-1** — Angenommen ein Nutzer startet eine Session mit Position, wenn die Session gespeichert ist, dann ruft die App das Wetter zum Startzeitpunkt an der Position der Session ab und speichert es mit der Session: Lufttemperatur, Luftdruck auf Meereshöhe, Windgeschwindigkeit, Windrichtung, Bewölkung, Niederschlag und Wetterlage
- [ ] **AC-2** — Angenommen ein Nutzer speichert einen Fang mit Position (per GPS oder von der Session übernommen), wenn der Fang gespeichert ist, dann ruft die App das Wetter zur Fangzeit an der Position des Fangs ab und speichert es mit dem Fang (dieselben Werte wie in AC-1)
- [ ] **AC-3** — Angenommen ein Nutzer trägt eine Session mit Position oder einen Fang nach, wenn der Eintrag gespeichert ist, dann ruft die App das Wetter für den vergangenen Zeitpunkt ab, soweit Open-Meteo Daten dafür liefert
- [ ] **AC-4** — Angenommen für einen Eintrag wird Wetter abgerufen, wenn die Werte gespeichert werden, dann stammen sie aus der vollen Stunde, die der Uhrzeit des Eintrags am nächsten liegt (14:29 → 14:00, 14:30 → 15:00)
- [ ] **AC-5** — Angenommen ein Nutzer speichert eine Session oder einen Fang, wenn er „Starten“, „Fang speichern“ oder „Session speichern“ antippt, dann wartet das Speichern nie auf das Wetter: Die Bestätigung erscheint so schnell wie ohne Wetterabruf, und das Wetter kommt danach dazu
- [ ] **AC-6** — Angenommen ein Eintrag hat eine Position, aber das Wetter ist noch nicht da, wenn der Nutzer die Detailansicht der Session oder die Fang-Seite sieht, dann steht an der Stelle des Wetters „Wetter wird abgerufen …“, und sobald es gespeichert ist, erscheinen die Werte, ohne dass er die Seite neu laden muss
- [ ] **AC-7** — Angenommen eine Session oder ein Fang hat keine Position, wenn der Eintrag gespeichert wird, dann wird kein Wetter abgerufen, und der Eintrag ist als „Ohne Wetterdaten“ gekennzeichnet mit dem Hinweis „Ohne Position wird kein Wetter abgerufen.“

### Fehlschlag & Nachholen
- [ ] **AC-8** — Angenommen der Wetterabruf schlägt fehl (Open-Meteo nicht erreichbar, keine Antwort, Fehlerantwort, keine Daten für diesen Zeitpunkt), wenn das passiert, dann bleibt der Eintrag unverändert gespeichert und ist als „Ohne Wetterdaten“ gekennzeichnet mit dem Hinweis „Wetter konnte nicht abgerufen werden.“
- [ ] **AC-9** — Angenommen eine Session oder einer ihrer Fänge hat eine Position, aber kein Wetter, wenn der Nutzer die Detailansicht der Session oder die Fang-Seite öffnet, dann versucht die App den Abruf von selbst erneut, und bei Erfolg erscheinen die Werte (AC-6). Das gilt auch für Einträge, die vor PROJ-3 gespeichert wurden
- [ ] **AC-10** — Angenommen ein Eintrag mit Position ist als „Ohne Wetterdaten“ gekennzeichnet, wenn der Nutzer „Wetter erneut abrufen“ antippt, dann startet ein neuer Versuch, der Button ist währenddessen gesperrt, und schlägt der Versuch fehl, sieht er „Wetter gerade nicht verfügbar. Versuche es später erneut.“

### Änderungen am Eintrag
- [ ] **AC-11** — Angenommen ein Nutzer ändert die Startzeit einer Session mit Position, wenn er speichert, dann wird das bisherige Wetter verworfen und das Wetter zur neuen Startzeit abgerufen, mit denselben Regeln wie beim ersten Speichern (AC-5, AC-8, AC-9). Ändert er nur Endzeit, Gewässername oder Notiz, bleibt das Wetter unverändert
- [ ] **AC-12** — Angenommen ein Nutzer ändert die Uhrzeit eines Fangs mit Position, wenn er speichert, dann wird das bisherige Wetter verworfen und das Wetter zur neuen Fangzeit abgerufen, wie in AC-11. Ändert er nur andere Angaben des Fangs, bleibt das Wetter unverändert
- [ ] **AC-13** — Angenommen ein Nutzer entfernt die Position einer Session oder eines Fangs (PROJ-2 AC-38), wenn er das bestätigt, dann wird auch das Wetter dieses Eintrags endgültig gelöscht, und der Eintrag zeigt „Ohne Wetterdaten“ wie in AC-7. Fänge, die ihre eigene Kopie der Position behalten, behalten auch ihr Wetter

### Anzeige
- [ ] **AC-14** — Angenommen eine Session hat Wetterdaten, wenn der Nutzer ihre Detailansicht öffnet, dann sieht er den Abschnitt „Wetter beim Start“ mit den Kacheln Luft (°C, eine Nachkommastelle), Luftdruck (hPa, ganze Zahl), Wind (km/h, ganze Zahl, mit Richtung als N, NO, O, SO, S, SW, W oder NW), Bewölkung (%), Niederschlag (mm, eine Nachkommastelle) und Wetter (Wetterlage auf Deutsch, z. B. „Klar“, „Bewölkt“, „Regen“, „Gewitter“), alle Zahlen im deutschen Format („11,4 °C“)
- [ ] **AC-15** — Angenommen ein Fang hat Wetterdaten, wenn der Nutzer den Fang antippt, dann sieht er auf der Fang-Seite den Abschnitt „Wetter beim Fang“ mit denselben Kacheln wie in AC-14
- [ ] **AC-16** — Angenommen eine Session oder ein Fang hat keine Wetterdaten, wenn der Nutzer die Detailansicht bzw. die Fang-Seite öffnet, dann sieht er statt der Kacheln eine vertiefte Fläche mit Wolken-Symbol, „Ohne Wetterdaten“ und dem Grund (AC-7 oder AC-8), und nur wenn der Eintrag eine Position hat, dazu „Wetter erneut abrufen“
- [ ] **AC-17** — Angenommen eine Session oder ein Fang hat keine Wetterdaten, wenn der Nutzer die Session-Übersicht bzw. die Fangliste in der Detailansicht sieht, dann trägt die Session-Karte die Kennzeichnung „ohne Wetter“ mit Wolken-Symbol und die Fangzeile ein kleines Wolken-Symbol. Solange der Abruf noch läuft, fehlt diese Kennzeichnung
- [ ] **AC-18** — Angenommen ein Nutzer trägt eine Session nach, wenn er „Ich bin noch am Gewässer: aktuelle Position verwenden“ einschaltet, dann erscheint der Hinweis „Wetter von damals: Wir rufen die stündlichen Wetterdaten für diesen Zeitraum ab, soweit verfügbar.“

### Zugriffsschutz & Datenschutz
- [ ] **AC-19** — Angenommen zwei Nutzer A und B haben Sessions und Fänge mit Wetter, wenn B das Wetter von A abfragen, ändern oder für einen Eintrag von A einen Abruf auslösen will, egal ob über die App oder direkt über die Datenbank-Schnittstelle mit seinem eigenen Zugang, dann erhält er keine Daten von A und kann nichts davon verändern oder auslösen
- [ ] **AC-20** — Angenommen die App ruft Wetter ab, wenn die Anfrage an Open-Meteo geht, dann enthält sie nur die auf zwei Nachkommastellen gerundete Position (etwa 1 km) und den Zeitraum, nie die genaue Position, den Gewässernamen, die Notiz, Fangangaben oder etwas, das den Nutzer erkennbar macht. In Petrilog selbst bleibt die genaue Position gespeichert
- [ ] **AC-21** — Angenommen ein Nutzer hat Sessions und Fänge mit oder ohne Wetter, wenn er „Meine Daten exportieren“ antippt, dann enthält die Datei zu jeder Session und jedem Fang die gespeicherten Wetterwerte bzw. die Angabe, dass keine vorliegen (Art. 15, 20 DSGVO; Art. 25, 28 DSG)
- [ ] **AC-22** — Angenommen ein Nutzer löscht einen Fang, eine Session oder sein Konto, wenn die Löschung bestätigt ist, dann ist auch das zugehörige Wetter sofort aus der Datenbank entfernt (Art. 17 DSGVO; Art. 32 DSG)
- [ ] **AC-23** — Angenommen die App ruft Wetter ab, wenn die Anfrage an Open-Meteo geht, dann kommt sie vom Petrilog-Server und nicht vom Gerät des Nutzers, sodass Open-Meteo weder seine IP-Adresse noch sonst eine Kennung von ihm erfährt (Art. 5 Abs. 1 lit. c, Art. 25 DSGVO; Art. 6 Abs. 2, Art. 7 DSG)
- [ ] **AC-24** — Angenommen ein Nutzer öffnet die Datenschutzerklärung, wenn er sie liest, dann nennt sie auch den Wetterabruf: Open-Meteo als Empfänger, dass nur die auf etwa 1 km gerundete Position und der Zeitpunkt übermittelt werden, ohne IP-Adresse oder Konto, wozu das Wetter gespeichert wird und dass es zusammen mit dem Eintrag gelöscht wird (Art. 13 DSGVO; Art. 19 DSG)

## Edge Cases
- **EC-1** — Angenommen ein Nutzer ändert die Zeit eines Eintrags, während der Abruf für die alte Zeit noch läuft, wenn beide Antworten ankommen (auch in umgekehrter Reihenfolge), dann ist am Ende das Wetter zur neuen Zeit gespeichert, nie das zur alten
- **EC-2** — Angenommen ein Eintrag wird gelöscht oder seine Position entfernt, während der Wetterabruf läuft, wenn die Antwort danach ankommt, dann wird kein Wetter gespeichert, kein Eintrag neu angelegt und dem Nutzer kein Fehler angezeigt
- **EC-3** — Angenommen dieselbe Session ist auf zwei Geräten geöffnet und beide holen fehlendes Wetter nach, wenn beide Abrufe ankommen, dann hat die Session genau eine Wetter-Momentaufnahme, und es entsteht kein Fehler
- **EC-4** — Angenommen der Nutzer schließt die App direkt nach „Fang gespeichert“, wenn der Wetterabruf dadurch nicht fertig wird, dann bleibt der Fang gespeichert, und das Wetter wird beim nächsten Öffnen der Session nachgeholt (AC-9)
- **EC-5** — Angenommen eine Session hat viele Fänge ohne Wetter (z. B. 40 nach einem Tag ohne Empfang), wenn der Nutzer die Detailansicht öffnet, dann erscheint sie sofort, und das Wetter wird im Hintergrund nachgeholt, ohne dass die Seite hängt
- **EC-6** — Angenommen Open-Meteo liefert nur einen Teil der Werte (z. B. keine Bewölkung), wenn das Wetter angezeigt wird, dann stehen die vorhandenen Werte in ihren Kacheln und die fehlenden als „–“
- **EC-7** — Angenommen Open-Meteo lehnt Anfragen vorübergehend ab (z. B. weil das Tageskontingent erschöpft ist), wenn Einträge gespeichert oder geöffnet werden, dann gelten sie als fehlgeschlagen (AC-8) und werden später nachgeholt (AC-9), ohne dass der Nutzer eine Flut von Fehlermeldungen sieht
- **EC-8** — Angenommen ein Eintrag liegt über Mitternacht oder an einer Zeitumstellung, wenn das Wetter abgerufen wird, dann gehört es zur tatsächlichen Stunde des Eintrags (AC-4), nicht zu einer um eine Stunde verschobenen
- **EC-9** — Angenommen ein Fang wird wenige Minuten nach seiner Fangzeit nachgetragen oder eine Session liegt Jahre zurück, wenn das Wetter abgerufen wird, dann bekommt der Eintrag Wetter, soweit Open-Meteo für diesen Zeitpunkt Daten hat, und sonst „Ohne Wetterdaten“ (AC-8)
- **EC-10** — Angenommen die gerundete Position liegt auf dem Wasser, z. B. auf dem Bodden oder der Ostsee, wenn das Wetter abgerufen wird, dann erhält der Eintrag trotzdem Wetter

## Technische Anforderungen
- **Tempo am Wasser:** Der Wetterabruf verlängert das Speichern nicht. Die 30-Sekunden-Regel für einen Fang aus PROJ-2 gilt unverändert (AC-5).
- **Kein Eintrag geht verloren:** Fällt Open-Meteo aus, wird trotzdem gespeichert (Erfolgskriterium der PRD, AC-8).
- **Zugriffsschutz doppelt:** in der App und in der Datenbank selbst (Row Level Security, Muster aus PROJ-1), siehe AC-19.
- **Positionen sind privat:** An Open-Meteo gehen nur gerundete Positionen (AC-20). Positionen, auch gerundete, stehen nie in Adressen (URLs) von Petrilog und nie in Server-Logs.
- **Kostenlos:** Open-Meteo ohne API-Key, innerhalb seiner kostenlosen Nutzungsgrenzen.
- **Einheiten und Format:** metrisch, deutsches Zahlenformat (`11,4 °C`, `1018 hPa`, `14 km/h SW`, `60 %`, `0,0 mm`). Zeiten in der Ortszeit des Geräts (Europe/Berlin).
- **Design:** Wetterkacheln im Ton `data` (Lake), „Ohne Wetterdaten“ auf `surface-sunken` mit Icon `cloud-off` (`docs/design-system.md`).
- **Sprache:** Alle Texte und Meldungen auf Deutsch.

## Offene Fragen
- [ ] Die kostenlose Nutzung von Open-Meteo ist nur für nicht-kommerzielle Zwecke erlaubt. Vor einem kommerziellen Betrieb klären: kostenpflichtiger Plan oder anderer Dienst.
- [ ] Frage an eine Anwältin vor dem ersten gehosteten Betrieb: Ist Open-Meteo mit gerundeter Position ohne Nutzerkennung bloßer Empfänger oder Auftragsverarbeiter (AVV nötig)? Betreiber und Serverstandort von Open-Meteo sind noch nicht festgestellt. Siehe `docs/privacy.md`

## Entscheidungsprotokoll

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Das Speichern wartet nie auf das Wetter; es kommt danach dazu, bis dahin „Wetter wird abgerufen …“ | Am Wasser zählt jede Sekunde, und die 30-Sekunden-Regel muss auch bei schlechtem Empfang halten | 2026-09-30 |
| Fehlendes Wetter wird beim Öffnen der Session bzw. des Fangs automatisch nachgeholt; dazu „Wetter erneut abrufen“ | Kein Wetter soll dauerhaft fehlen, nur weil am Wasser kein Netz war. Das gilt auch für Einträge aus der Zeit vor PROJ-3. | 2026-09-30 |
| Fang-Wetter steht auf der Fang-Seite („Wetter beim Fang“), nicht in der Fangzeile | Die Fangliste bleibt schlank und am Wasser gut lesbar. Ein kleines Symbol zeigt fehlendes Wetter an. | 2026-09-30 |
| Wird die Zeit eines Eintrags geändert, wird das Wetter neu abgerufen | Wetter zur falschen Zeit würde spätere Auswertungen verfälschen | 2026-09-30 |
| Wird die Position entfernt, wird auch das Wetter gelöscht | Wetter von einer falschen Stelle ist genauso falsch wie die Position selbst | 2026-09-30 |
| An Open-Meteo geht die Position nur auf etwa 1 km gerundet | Das Wetterraster ist ohnehin gröber, das Wetter wird also nicht schlechter. Der Dienst erfährt aber nie den genauen Spot. | 2026-09-30 |
| Luftdruck auf Meereshöhe, wie im Wetterbericht | Vergleichbar zwischen allen Gewässern, egal in welcher Höhe, und damit auswertbar | 2026-09-30 |
| Session-Wetter gehört zum Start, Fang-Wetter zur Fangzeit; es gilt der Wert der nächstgelegenen vollen Stunde | Entspricht dem Prototyp („Wetter beim Start“). Open-Meteo liefert stündliche Werte, die nächste volle Stunde ist die ehrlichste Zuordnung. | 2026-09-30 |
| Wetter ist nicht von Hand änderbar | Die Werte sollen vergleichbar aus einer Quelle stammen, sonst verlieren spätere Auswertungen ihren Wert | 2026-09-30 |
