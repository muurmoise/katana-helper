# katana-helper

## Projektziel

Ein schlichter Editor für den BOSS Katana-100 MkII. Er liest und schreibt Parameter per
Roland-SysEx. Umsetzung als Web-App (Vanilla JS + Vite, später PWA), gehostet auf GitHub Pages
unter `/katana-helper/`.

Hinweis: Der Projektpfad enthält ein Leerzeichen (`katana helper`). Pfade in Shell-Befehlen
immer quoten.

## Zielplattform

**Nur Mac + Google Chrome** über **Web MIDI** mit installiertem BOSS-KATANA-Treiber
(Entscheidung 2026-11-01). Getestet und funktioniert: macOS 27, Chrome 156, Treiber 1.0.4,
Ports „KATANA“ (SysEx) und „KATANA DAW CTRL“.

Nicht unterstützt, auch nicht nebenbei:
- ~~Android~~: gestrichen am 2026-11-01. Kein WebUSB-Transport, keine native App.
- ~~iPad~~: gestrichen, herstellerspezifisches USB, kein Treiber, kein WebUSB in Safari.
- Safari und Firefox haben kein Web MIDI. Die App zeigt dort nur einen Hinweis auf Chrome.

Hintergrund: Der Katana MkII meldet sich per USB herstellerspezifisch (Klasse 255). Erst der
BOSS-Treiber macht daraus MIDI-Ports. Details: `docs/protocol.md` Abschnitt 1.

## Phasen

### Phase 1a – USB-Test ✓ erledigt

- Testseite `/katana-helper/probe/` (`probe/index.html`, `src/probe/`) bleibt als
  Diagnose-Werkzeug bestehen.
- `src/lib/sysex.js` ist die Grundlage der App.
- `src/lib/usbmidi.js` (WebUSB-Pakete) wird von der App **nicht** verwendet. Es bleibt nur für
  den WebUSB-Teil der Testseite.
- Ergebnisse: `docs/protocol.md` Abschnitt 10.

### Phase 1 – Verbindung + Debug ✓ erledigt (2026-11-01)

Am echten Amp getestet (Chrome 156, macOS 27): automatisch verbinden, erkennen, Edit-Mode,
Kanal und Namen lesen, trennen, erneut verbinden.

Aufbau (alles unter `src/lib/` ohne DOM und mit Vitest-Tests):

| Datei | Aufgabe |
| --- | --- |
| `sysex.js` | Roland-SysEx bauen und parsen, Checksumme |
| `describe.js` | Deutsche Namen für Adressen und Werte (Tabellen aus `docs/protocol.md` 9) |
| `midi-transport.js` | Web MIDI: Zugriff mit SysEx, Port „KATANA“ wählen, Port-Ereignisse |
| `katana.js` | `KatanaClient`: Anfragen nacheinander, Antworten per Adressbereich zuordnen, Timeouts, Meldungen vom Amp |
| `connection.js` | Ablauf und Zustände (verbunden, nicht gefunden, verloren …), Auto-Reconnect, Log |
| `log.js` | Debug-Log mit Ringpuffer |

Die Oberfläche steckt in `src/main.js` und `src/app/app.css`, die Seite in `index.html`.
Verhalten:
- Verbindet beim Laden selbst, wenn Chrome MIDI schon erlaubt hat. Sonst erst nach Klick, damit
  die Berechtigungsfrage nicht ungefragt kommt.
- Verbindet von selbst neu, wenn der Amp wieder auftaucht.
- Schaltet den Edit-Mode beim Trennen und beim Schließen des Tabs (`pagehide`) aus.

### Phase 2 – Regler live ← umgesetzt, Schreibtest am Amp durch Martin ausstehend

Kanal (Panel, A1–B4), Amp-Typ (Schalter `06 50`) und Modell (`00 21`, alle 30), Gain, Bass,
Middle, Treble, Presence, Volume (`06 5x`), fünf Effekte mit an/aus, Farbe und Typ. Live in
beide Richtungen: Bewegungen am Amp erscheinen sofort im Editor.

| Datei | Aufgabe |
| --- | --- |
| `src/lib/patch.js` | Wo welcher Regler liegt (`AMP`, `KNOBS`, `EFFECTS`), `PatchState` (Bytes nach Adresse), Backup-Format |
| `src/lib/editor.js` | `Editor`: Patch lesen, Werte setzen (gedrosselt), zurücklesen, Rückgängig, Kanalwechsel, Meldungen vom Amp |
| `src/lib/testing/fake-katana.js` | Simulierter Amp mit Speicher für Tests |
| `src/app/editor-ui.js`, `src/app/log-ui.js` | Oberfläche |

Sicherheitsregeln im Code:
- Nach jedem Verbinden und Kanalwechsel liest der Editor den ganzen Patch. Der dient als
  Ausgangspunkt für „Änderungen zurücknehmen“ und als Backup („Backup speichern“, JSON).
- Nach jedem Schreiben liest der Editor den Wert zurück und loggt „Bestätigt“ oder die
  Abweichung, dazu verwandte Adressen (z. B. nach `06 50` auch `00 21`).
- `KatanaClient.write` lehnt den Speicherbefehl `7F 00 01 04` ab.
- Antworten an andere MIDI-Programme (zweiter Tab) lösen keinen Neu-Lesevorgang aus.

Offen: Martins Schreibtest nach `docs/device-test.md` Teil 3, danach Status in
`docs/protocol.md` nachtragen.

### Phase 3 – Patches/Presets ← umgesetzt, Speichertest am Amp durch Martin ausstehend

Bibliothek in IndexedDB (Datenbank `katana-helper`, Store `patches`), JSON-Export und
-Import, Kanäle direkt lesen (`10 0n 00 00`, ohne Kanalwechsel), Patches in den aktuellen
Klang laden, aktuellen Klang in einen Kanal speichern. Vor jedem Überschreiben eines Kanals
automatisch ein Backup.

| Datei | Aufgabe |
| --- | --- |
| `src/lib/library.js` | `PatchLibrary` mit `indexedDbBackend` / `memoryBackend`, Import/Export (`katana-helper-library`, auch `katana-helper-backup`) |
| `src/lib/manager.js` | `PatchManager`: Kanalnamen, Kanal/aktuellen Klang sichern, laden, `saveToChannel` mit Backup und Prüfung |
| `src/lib/patch.js` | dazu: Patch als `Map` offset → Byte, `patchWrites`, `patchDiff`, `nameBytes` |
| `src/app/patches-ui.js` | Bereich „Patches“ und Speichern-Dialog |

Regeln im Code:
- Ganzer Patch = Größe `00 00 0F 48` (1992), Antwort 1932 Byte. Nie wieder 1920.
- Gespeichert wird nur über `PatchManager.saveToChannel` → `KatanaClient.saveToChannel`,
  nur A1–B4. `KatanaClient.write` sperrt `7F 00 01 04` weiterhin.
- Ablauf: Zielkanal sichern (sonst Abbruch) → optional Name → Speicherbefehl → Kanal
  zurücklesen und vergleichen. LED-Bytes `06 5C`–`06 61` werden nicht geschrieben und nicht
  verglichen.
- Patches laden heißt: in den temporären Patch schreiben (10 DT1, 20 ms Pause). Das lässt
  sich mit „Änderungen zurücknehmen“ rückgängig machen.

### Phase 4 – Effekt-Regler ← umgesetzt, Hörtest am Amp durch Martin ausstehend

Eingeschoben am 2026-11-01 auf Martins Wunsch. Detail-Regler jedes Effekttyps (z. B. Tremolo
Rate/Depth), Delay 2 als eigener Effekt, Effektregler am Panel („Regler am Amp“), was der
Reverb-Regler steuert (Delay 2 / beides / Reverb).

| Datei | Aufgabe |
| --- | --- |
| `src/lib/effect-params.js` | Regler pro Effekt und Typ: Adresse, Bereich, Anzeige; `effectParams(key, type)`, `encodeValue`/`decodeValue` (2-Byte-Werte = hi × 128 + lo), `BLOCK_SPANS` |
| `src/lib/patch.js` | dazu: `EFFECTS` mit `delay2` (teilt Farbe, LED und Regler mit dem Reverb), `REVERB_LAYER` |
| `src/app/editor-ui.js` | Knopf „Regler“ je Effekt, Detailbereich wird bei Typ- oder Farbwechsel neu aufgebaut |

Regeln im Code:
- Quellen: Q2 `midi.xml` (Adressen, Bereiche) und `stompbox_*.cpp` (welche Regler zu welchem
  Typ gehören), Gegenprobe Q3. Übersicht in `docs/protocol.md` 7.6.
- FX = MOD + `02 00`, Delay 2 = Delay + `00 20`. Nie eigene Tabellen dafür anlegen.
- Nach „Regler am Amp“ liest der Editor den ganzen Effektblock zurück
  (`related: [{ address, size }]`), weil der Amp den Hauptparameter mitverstellt.
- Harmonist-User-Skalen und Booster-Custom-Parameter sind bewusst nicht im Editor.

Offen: Martins Hörtest nach `docs/device-test.md` Teil 5.

### Phase 5 – PWA

Service Worker mit Versionierung und Update-Hinweis. Vorher **keinen** Service Worker
einbauen, damit beim Testen kein Cache stört. Installierbar als Chrome-App am Mac. Cloudflare Pages als
Alternative zu GitHub Pages im README beschreiben.

## Konventionen

- `docs/protocol.md` ist die verbindliche Referenz für alle SysEx-Adressen. Neue oder geänderte
  Adressen dort mit Quelle und Status eintragen.
- Werte, die nicht am echten Gerät getestet wurden, bleiben als UNVERIFIZIERT bzw. mit dem
  passenden Status markiert. Ergebnisse eigener Tests dort nachtragen.
- **Lizenzen:** Aus ktnacontrol (keine Lizenz), TuxKatana (AGPL-3.0), FxFloorBoard (GPL) und
  katana-midi-bridge (GPL-2.0) wird **kein Code** übernommen, nur Protokollwissen mit
  Quellenangabe (`CREDITS.md`, `docs/protocol.md`). USB-MIDI nach der öffentlichen
  USB-MIDI-1.0-Spezifikation.
- Code-Kommentare auf Englisch, Doku und UI-Texte auf Deutsch.
- `npm test` (Vitest) muss grün sein; der Deploy-Workflow bricht sonst ab.

## Befehle

```sh
npm install
npm run dev      # Entwicklungsserver, http://localhost:5173/katana-helper/
npm test         # Vitest
npm run build    # nach dist/
```

Deploy: Push auf `main` → GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages.
