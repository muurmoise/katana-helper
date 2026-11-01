# Gerätetest – Checkliste

Testseite: <https://muurmoise.github.io/katana-helper/probe/>

Die Testseite sendet nur **Lesebefehle** (RQ1), die Geräteabfrage (Identity Request) und den
Edit-Mode an/aus. Sie verändert und speichert nichts am Amp.

Nach jedem Test bitte den **kompletten Log** zurückschicken, mit „Log kopieren“ oder
„Als Datei“. Bitte nichts kürzen, auch die Fehlerzeilen sind wichtig.

---

## Teil 1 – Android (Chrome + WebUSB)

> **Entfällt.** Android wird seit 2026-11-01 nicht mehr unterstützt. Der Abschnitt bleibt nur
> zur Dokumentation stehen.

### Vorbereitung

- [ ] **Chrome-Version** notieren: Chrome → ⋮ → Einstellungen → Über Chrome.
      (Die Seite zeigt sie auch unter „Umgebung → Browser“.)
- [ ] **Kabel:** USB-OTG-Kabel bzw. Adapter vom Handy (meist USB-C) auf **USB-B** (Buchse
      am Katana). Ein normales Ladekabel reicht nicht, das Handy muss als USB-Host arbeiten.
- [ ] Katana einschalten, **dann** per USB ans Handy anschließen.
- [ ] Falls Android fragt, wofür USB genutzt werden soll: nichts auswählen bzw. abbrechen.
- [ ] BOSS Tone Studio auf dem Handy (falls installiert) schließen.

### Ablauf

1. [ ] Testseite in Chrome öffnen.
2. [ ] Abschnitt **Umgebung**: Steht bei `navigator.usb` „vorhanden“ (grün)?
3. [ ] **WebUSB → „1. Gerät wählen“** tippen. Chrome zeigt eine Geräteliste.
       - Taucht „KATANA“ (oder ein Roland-/BOSS-Gerät) auf? → auswählen, „Verbinden“.
       - Fragt Android danach „Chrome Zugriff auf … erlauben?“ → **OK**.
       - Leere Liste? → Kabel/OTG prüfen, Amp aus- und wieder einschalten, nochmal.
4. [ ] Im Log stehen jetzt alle USB-Descriptoren und „Gewählt: Interface …“.
5. [ ] **„2. Verbinden“** tippen. Jeder Schritt meldet „erfolgreich“ oder einen Fehler
       (`open()`, `selectConfiguration`, `claimInterface`, ggf. `selectAlternateInterface`).
6. [ ] Wenn alles erfolgreich war: **„3. Test-Sequenz senden“** tippen.
       Am Ende steht eine Zeile „Ergebnis WebUSB: Identity ja/NEIN, Name 10 00 00 00 …“.
7. [ ] Danach **am Amp den GAIN-Regler drehen** und einen Effekt-Taster drücken.
       Im Log sollten neue Zeilen „USB DT1 …“ erscheinen.
8. [ ] **„Edit-Mode aus und Gerät freigeben“** tippen.
9. [ ] Zum Vergleich: **Web MIDI → „1. Web MIDI öffnen“**, Berechtigung erlauben.
       Erwartung: kein Katana-Port. Das bestätigt den Befund aus `docs/protocol.md`.
10. [ ] **„Log kopieren“** (oder „Als Datei“) und den kompletten Log schicken.

### Zurückschicken

- [ ] Kompletter Log
- [ ] Handy-Modell und Android-Version
- [ ] Welches Kabel/Adapter
- [ ] Bei Schritt 3: Wie hieß das Gerät im Chrome-Dialog?

---

## Teil 2 – Mac (Chrome + Web MIDI + BOSS-Treiber)

> **Erledigt am 2026-11-01:** Web MIDI funktioniert (macOS 27.0.1, Chrome 156, Treiber 1.0.4).
> Ergebnisse in `docs/protocol.md` Abschnitt 10, auch die Meldungen beim Drehen am Amp.

### Vorbereitung

- [ ] **macOS-Version** prüfen:  → Über diesen Mac.
- [ ] **BOSS-Treiber** installieren:
      <https://www.boss.info/global/support/by_product/katana-100_mk2/updates_drivers/>
      - macOS 14 Sonoma oder neuer: **KATANA Driver Ver.1.0.4**
      - macOS 11–13: KATANA Driver Ver.1.0.3
      - Ob 1.0.4 auf deiner macOS-Version offiziell unterstützt wird, steht auf der
        Treiberseite. Bitte vor der Installation nachsehen.
      - Nach der Installation die Systemerweiterung erlauben (Systemeinstellungen →
        Datenschutz & Sicherheit) und den Mac neu starten, falls verlangt.
- [ ] Katana einschalten und per USB (USB-B) an den Mac anschließen. Ein USB-Hub oder Dock
      (z. B. CalDigit) ist in Ordnung. Am Mac getestet: Der Katana erscheint am Hub, und
      CoreMIDI legt die Ports „KATANA“ und „KATANA DAW CTRL“ an.
- [ ] Optional: In „Audio-MIDI-Setup“ → Fenster → MIDI-Studio nachsehen, ob „KATANA“
      erscheint.
- [ ] **BOSS Tone Studio schließen.** Es schaltet selbst den Edit-Mode und würde stören.
- [ ] **Google Chrome** (aktuelle Version), **nicht Safari**. Safari kennt weder Web MIDI
      noch WebUSB. Dann bleiben „Web MIDI öffnen“ und die Felder Eingang/Ausgang gesperrt.

### Ablauf

1. [ ] Testseite in Chrome öffnen.
2. [ ] **Web MIDI → „1. Web MIDI öffnen“**. Chrome fragt nach der Berechtigung,
       MIDI-Geräte zu steuern → **Zulassen**.
3. [ ] Im Log: Liste der Ein- und Ausgänge, idealerweise „Katana-Port gefunden“.
       Die Auswahlfelder werden erst nach Schritt 2 wählbar und stehen dann automatisch
       auf „KATANA“ (nicht „KATANA DAW CTRL“). Sonst den Port von Hand wählen.
4. [ ] **„2. Test-Sequenz senden“**. Am Ende steht „Ergebnis Web MIDI: …“.
5. [ ] **Am Amp den GAIN-Regler drehen** → es sollten „MIDI DT1 …“-Zeilen kommen.
6. [ ] **„Patch auslesen (Backup)“** einmal ausprobieren (nur lesend).
7. [ ] **„Edit-Mode aus“**.
8. [ ] Optional: **WebUSB → „1. Gerät wählen“ → „2. Verbinden“**. Erwartung: Mit
       installiertem Treiber schlägt `claimInterface` fehl, weil der Treiber das Gerät
       hält. Das Ergebnis interessiert trotzdem.
9. [ ] **„Als Datei“** speichern (landet in „Downloads“) oder „Log kopieren“. Lange Logs
       werden beim Einfügen in den Chat abgeschnitten, dann besser die Datei nehmen.

### Zurückschicken

- [ ] Kompletter Log
- [ ] macOS-Version, Chrome-Version, installierte Treiberversion

---

## Teil 3 – Schreibtest mit dem Editor (Phase 2)

Editor: <https://muurmoise.github.io/katana-helper/>, Google Chrome, Amp per USB.

### Regeln

- [ ] Nur einen Tab mit katana-helper offen haben, Diagnose-Seite und BOSS Tone Studio
      schließen. (Mehrere Tabs funktionieren, machen den Log aber unübersichtlich.)
- [ ] Zuerst **„Backup speichern“** klicken. Die JSON-Datei enthält den kompletten Klang.
- [ ] Am besten im **Panel**-Kanal testen. Dort holt man den alten Klang auch zurück, indem
      man die Regler am Amp kurz bewegt.
- [ ] Der Editor **speichert nie** in einen Kanal; der Speicherbefehl ist im Code gesperrt.
      Alles, was du änderst, ist nach einem Kanalwechsel oder Aus- und Einschalten weg.
- [ ] Unten „Debug“ aufklappen. Nach jeder Änderung steht im Log „Bestätigt: …“ oder
      „Amp meldet … statt …“. Die Zeilen danach zeigen, was der Amp sonst noch geändert hat.

### Ablauf

1. [ ] **Gain-Regler** im Editor bewegen. Ändert sich der Klang? Bleibt der Regler am Amp
       stehen (er ist ja ein echter Drehregler)?
2. [ ] **Bass, Middle, Treble, Presence, Volume** kurz bewegen.
3. [ ] **Amp-Typ** im Editor durchschalten (Acoustic … Brown). Ändert sich der Klang?
       Zeigt „Modell“ danach das passende Panel-Modell? Was zeigt die AMP-TYPE-LED am Amp?
4. [ ] **Modell** „Variation Clean“ wählen. Erscheint im Editor das Schild „Variation“?
       Geht am Amp die VARIATION-LED an? Was zeigt der Typ-Schalter im Editor?
5. [ ] Ein **verstecktes Modell** wählen, z. B. „Clean Twin“ oder „Core Metal“.
6. [ ] **Effekte an/aus** für alle fünf. Gehen die LEDs am Amp mit?
7. [ ] **Farbe** eines Effekts wechseln (Grün/Rot/Gelb). Wechselt die LED-Farbe am Amp?
       Wechselt der Typ im Editor mit (jede Farbe hat ihren eigenen Typ)?
8. [ ] **Typ** eines Effekts ändern, dann auf eine andere Farbe und zurück wechseln. Ist
       der neue Typ noch da? (Offene Frage: Schreibt der Amp den Typ in den Farbplatz?)
9. [ ] **„Änderungen zurücknehmen“**. Klingt es wieder wie vorher?
10. [ ] **Kanalwechsel**: A1 … B4 und zurück auf Panel. Folgen Kanal-LED und Klang? Liest
        der Editor danach den neuen Klang?
11. [ ] Am Amp selbst den Kanal wechseln. Folgt der Editor?
12. [ ] Debug → **„Als Datei“** und mir die Log-Datei schicken (oder Bescheid geben, dann
        lese ich sie aus „Downloads“).

### Noch offene Protokollfragen

- [x] **Farbwerte:** `00` = Grün, `01` = Rot, `02` = Gelb (Patch-Dump und LED am Gerät,
      `docs/protocol.md` 7.3).
- [x] **Identity Reply:** `F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7`, gleich wie in
      TuxKatana. Firmware-Version laut Amp-Menü noch gegenprüfen.
- [ ] **Amp-Typ beim Schreiben** (Schritt 3–5): Ändert `06 50` auch `00 21`? Geht bei
      `00 21` = „Variation Clean“ (`1D`) die Variation-LED an? Am Drehschalter setzt der
      Amp `00 21` selbst (`docs/protocol.md` 10.3).
- [ ] **Typ je Farbe** (Schritt 8): Wird `00 11` usw. in den Farbplatz `06 24`… übernommen?
- [ ] **Effekt-LED gelb:** Meldet `06 5D`… den Wert `03`, wenn die Farbe Gelb ist?
- [ ] **Preamp-Adressen `00 2x` als Schreibziel:** Der Editor nutzt `06 5x`; `00 2x` wird
      nur gelesen. Schreiben auf `00 2x` bleibt ungetestet.
- [ ] **Delay 2** an/aus und Typ (`60 00 05 20` / `05 21`), dazu die Reverb-Regler-Belegung
      `60 00 06 36`–`38` (Delay / Delay+Reverb / Reverb). Jetzt im Editor, siehe Teil 5.
- [ ] **Effekt-Regler** `06 57`–`06 5B`: Stimmt die Skala „`00` = aus, `01`–`65` = 0–100“?
      Jetzt im Editor („Regler am Amp“), siehe Teil 5.
- [ ] **Speichern** (`7F 00 01 04`): siehe Teil 4.

---

## Teil 4 – Patches und Speichern (Phase 3)

Bereich „Patches“ unten im Editor. Lesen, Sichern und Laden sind am Amp getestet
(`docs/protocol.md` 10.4). Offen ist nur das **Speichern in einen Kanal**.

### Vorbereitung

- [ ] Alle Kanäle sichern: In „Kanäle im Amp“ bei A1 … B4 jeweils **„Sichern“** klicken.
      Danach **„Alle exportieren“**. Die JSON-Datei ist das Komplett-Backup außerhalb des
      Browsers.
- [ ] Einen Kanal aussuchen, dessen Klang verzichtbar ist (für den Test z. B. B3 „banjo“).

### Speichertest

1. [ ] Im Editor einen Klang einstellen, der sich deutlich vom Zielkanal unterscheidet.
2. [ ] Beim Zielkanal **„Speichern …“**, Namen eingeben (z. B. „Test“), bestätigen.
3. [ ] In der Statuszeile steht „gespeichert und geprüft“? In der Bibliothek liegt ein
       **Auto-Backup** des alten Kanals?
4. [ ] Zeigt „Kanäle im Amp“ den neuen Namen?
5. [ ] Am Amp auf den Zielkanal schalten: Klingt er wie gespeichert? Dann auf einen
       anderen Kanal und zurück: Ist der Klang noch da?
6. [ ] **Zurück zum alten Stand:** Beim Auto-Backup **„In Kanal …“** → denselben Kanal
       wählen → speichern. Klingt der Kanal wieder wie vorher?
7. [ ] Amp aus- und einschalten, Kanal prüfen.
8. [ ] Debug → „Als Datei“ und Bescheid geben.

### Import/Export

- [ ] Einen Patch über ⋯ → **„Exportieren“** sichern, ihn löschen, dann über
      **„Importieren“** wieder einlesen und **„Laden“**.
- [ ] Die Datei aus „Backup speichern“ (oben im Editor) lässt sich ebenfalls importieren.

---

## Teil 5 – Effekt-Regler (Phase 4)

Im Editor hat jeder Effekt rechts den Knopf **„Regler“**. Er klappt die Einstellungen des
gewählten Typs auf, z. B. beim Tremolo Wave Shape, Rate, Depth und Level. Lesen ist am Amp
getestet, Schreiben nur mit unveränderten Werten (`docs/protocol.md` 10.5). Offen ist, ob die
Regler **hörbar** das tun, was sie sollen.

Regeln wie in Teil 3: zuerst „Backup speichern“, im Panel-Kanal testen, Debug-Log offen.
Nichts davon wird gespeichert.

### Ablauf

1. [ ] **MOD auf Tremolo**, einschalten, „Regler“ aufklappen. Rate und Depth bewegen: Ändert
       sich der Klang so, wie es die Namen sagen?
2. [ ] **Regler am Amp** im Editor bewegen. Was passiert am Amp? Geht der Effekt bei „aus“
       aus? Bewegt sich dabei auch Rate (wie beim Drehen am Amp, `docs/protocol.md` 7.4)?
3. [ ] **Delay:** Time verstellen (z. B. 100 ms und 800 ms). Hört man den Unterschied?
       Dann einen **Dual**-Typ wählen: Erscheinen D1/D2-Regler, und wirken sie?
4. [ ] **Delay Pan und Stereo:** Wirkt „High Cut“? (Die Quellen sind sich hier nicht
       einig.)
5. [ ] **Reverb:** Time, Pre Delay und Effect Level bewegen. Bei Spring zusätzlich „Spring
       Color“.
6. [ ] **Delay 2** einschalten. „Reverb-Regler steuert“ auf „Delay“ oder „Delay+Reverb“
       stellen und am Amp den Reverb-Regler drehen. Hört man Delay 2?
7. [ ] **FX** auf denselben Typ wie MOD stellen und einen Regler bewegen. Ändert sich nur FX?
8. [ ] Am Amp einen Effektregler drehen. Folgen die Werte im Editor?
9. [ ] Ein paar seltenere Typen ausprobieren: Pitch Shifter (Pitch, Pre Delay), Para EQ,
       2x2 Chorus, DC-30. Stimmt die Anzeige mit BOSS Tone Studio überein, falls zur Hand?
10. [ ] **„Änderungen zurücknehmen“**. Klingt es wieder wie vorher?
11. [ ] Debug → „Als Datei“ und Bescheid geben.
