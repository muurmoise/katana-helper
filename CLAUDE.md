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

### Phase 1 – Verbindung + Debug

Web MIDI öffnen (`sysex: true`), Port „KATANA“ automatisch wählen (nicht „DAW CTRL“), Gerät per
Identity Request erkennen, Edit-Mode, Debug-Log, Hinweis bei fehlendem Web MIDI. Baut auf
`sysex.js` auf. Ein Transport-Modul kapselt Web MIDI, damit der Rest testbar bleibt.

### Phase 2 – Regler live

Amp-Typ, Gain, Volume, EQ, Effekte an/aus + Typ, Kanalwechsel, live in beide Richtungen.
Dazu gehören die offenen Prüfpunkte aus `docs/device-test.md` Teil 3 (Amp-Typ, Kanalwechsel,
Delay 2). Farbwerte und Regler-Adressen sind geklärt (`docs/protocol.md` 6.2, 7.3).
Schreibtests nur nach Backup.

### Phase 3 – Patches/Presets

Patches in IndexedDB, JSON-Export/-Import. Vor jedem Überschreiben eines Kanals automatisch ein
Backup.

### Phase 4 – PWA

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
