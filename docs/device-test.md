# Gerätetest – Checkliste

Testseite: <https://muurmoise.github.io/katana-helper/probe/>

Die Testseite sendet nur **Lesebefehle** (RQ1), die Geräteabfrage (Identity Request) und den
Edit-Mode an/aus. Sie verändert und speichert nichts am Amp.

Nach jedem Test bitte den **kompletten Log** zurückschicken, mit „Log kopieren“ oder
„Als Datei“. Bitte nichts kürzen, auch die Fehlerzeilen sind wichtig.

---

## Teil 1 – Android (Chrome + WebUSB)

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

## Teil 3 – Prüfpunkte für später (Phase 2)

Diese Punkte brauchen Schreibbefehle und kommen erst, wenn die Verbindung steht.

### Regel: Erst Backup, dann schreiben

- [ ] Vor jedem Schreibtest den aktuellen Patch mit **„Patch auslesen (Backup)“** lesen.
      Die `BACKUP`-Zeilen im Log enthalten den vollständigen Patch und gehören zum Log.
- [ ] Schreibtests nur im **Panel-Modus** oder auf einem Kanal, dessen Klang egal ist.
- [ ] Niemals „Speichern“ (`7F 00 01 04`) im Test. Der Befehl überschreibt einen Kanal
      dauerhaft.

### Offene Protokollfragen

- [x] **Farbwerte:** Geklärt aus dem Patch-Dump und am Gerät bestätigt (Booster- und
      Reverb-LED rot bei Wert `01`): `00` = Grün, `01` = Rot, `02` = Gelb
      (`docs/protocol.md` 7.3). Der Schreibtest unten ist optional.
      Test: `60 00 06 39` (Booster-Farbe) nacheinander auf `00`, `01`, `02` setzen und
      jedes Mal die LED am Amp ablesen. Danach für MOD/FX/Delay/Reverb (`06 3A`–`06 3D`)
      stichprobenartig wiederholen.
- [ ] **Preamp-Adressen `00 2x` vs. Bedienfeld `06 5x`:** Gain `60 00 00 22`, Bass `00 24`,
      Middle `00 25`, Treble `00 26`, Presence `00 27`, Volume `00 28` setzen und mit
      `06 51`–`06 56` vergleichen. Ändert sich der Klang? Folgt der Wert in `06 5x`? Was
      meldet der Amp, wenn man am Regler dreht?
      Beachten: Gain `00 22` hat laut FxFloorBoard eine andere Skala (`00`–`78`).
- [ ] **Amp-Typ:** Drehschalter-Adresse `60 00 06 50` (5 Werte) gegen konkretes Modell
      `60 00 00 21` (30 Werte). Fragen: Ändert `06 50` auch `00 21`? Bleibt beim
      Setzen von `00 21` = „Var [Clean]“ (`1D`) der Schalter auf Clean und geht die
      Variation-LED an? Wird `06 5C` (Variation-LED) passend gemeldet?
- [ ] **Kanalwechsel** `00 01 00 00` mit allen 9 Werten (Panel, A1–A4, B1–B4). Antwortet
      der Amp mit dem neuen Kanal? Kommt danach ein neuer Patch?
- [ ] **Delay 2** an/aus und Typ (`60 00 05 20` / `05 21`), dazu die Reverb-Regler-Belegung
      `60 00 06 36`–`38` (Delay / Delay+Reverb / Reverb).
- [ ] **Effekt-Regler** `06 57`–`06 5B`: Stimmt die Skala „`00` = aus, `01`–`65` = 0–100“?
- [x] **Identity Reply:** `F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7`, gleich wie in
      TuxKatana. Firmware-Version laut Amp-Menü noch gegenprüfen.
- [ ] Erst ganz am Ende und nur mit Backup: **Speichern** (`7F 00 01 04`) auf einem
      unwichtigen Kanal.
