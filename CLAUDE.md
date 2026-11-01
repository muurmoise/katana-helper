# katana-helper

## Projektziel

Ein schlichter Editor für den BOSS Katana-100 MkII. Er liest und schreibt Parameter per
Roland-SysEx. Umsetzung als Web-App (Vanilla JS + Vite, später PWA), gehostet auf GitHub Pages
unter `/katana-helper/`.

Hinweis: Der Projektpfad enthält ein Leerzeichen (`katana helper`). Pfade in Shell-Befehlen
immer quoten.

## Zielplattformen

| Plattform | Weg | Status |
| --- | --- | --- |
| Mac/Desktop | Chrome + **Web MIDI** + BOSS-KATANA-Treiber | erwartet: funktioniert, Test ausstehend |
| Android | Chrome + **WebUSB** (Interface selbst beanspruchen, USB-MIDI-Pakete selbst packen) | offen → Phase 1a |
| ~~iPad~~ | gestrichen: herstellerspezifisches USB, kein Treiber, kein WebUSB in Safari | – |

Hintergrund: Der Katana MkII meldet sich per USB herstellerspezifisch (Klasse 255), nicht als
Standard-USB-MIDI. Android-MIDI und damit Web MIDI in Chrome Android sehen ihn vermutlich
nicht. Details: `docs/protocol.md` Abschnitt 1.

## Phasen

### Phase 1a – USB-Test ← aktuell

- Testseite `/katana-helper/probe/` (`probe/index.html`, `src/probe/`).
- Bibliotheken `src/lib/sysex.js` (Checksumme, RQ1/DT1 bauen, parsen) und
  `src/lib/usbmidi.js` (USB-MIDI-Pakete packen/entpacken), beide mit Vitest-Tests.
- Martin testet nach `docs/device-test.md` auf Android und Mac und schickt die Logs.

### Entscheidung nach dem Test

**WEG A – WebUSB klappt auf Android:**
Ein Transport-Interface `KatanaTransport` mit zwei Implementierungen, `WebMidiTransport` und
`WebUsbTransport`. Die App erkennt automatisch, welcher Weg verfügbar ist. Danach weiter mit den
Phasen 1–4.

**WEG B – WebUSB klappt nicht:**
Die Web-App bleibt für den Mac. Für Android gibt es eine native Kotlin-App
(`android.hardware.usb`, `UsbManager`, Bulk-Transfers) im Unterordner `/android`. Grundlage ist
dieselbe Protokoll-Doku. ktnacontrol dient nur als inhaltliches Vorbild, ohne Code zu übernehmen
(es hat keine Lizenz, siehe unten). Verteilung per APK-Sideload, kein Play Store.

### Phase 1 – Verbindung + Debug

Verbinden, Gerät erkennen, Edit-Mode, Debug-Log. Baut auf `sysex.js`/`usbmidi.js` aus 1a auf.

### Phase 2 – Regler live

Amp-Typ, Gain, Volume, EQ, Effekte an/aus + Typ, Kanalwechsel, live in beide Richtungen.
Dazu gehören die offenen Prüfpunkte aus `docs/device-test.md` Teil 3 (Farbwerte, Preamp- vs.
Bedienfeld-Adressen, Amp-Typ). Schreibtests nur nach Backup.

### Phase 3 – Patches/Presets

Patches in IndexedDB, JSON-Export/-Import. Vor jedem Überschreiben eines Kanals automatisch ein
Backup.

### Phase 4 – PWA + Tablet

Service Worker mit Versionierung und Update-Hinweis. Vorher **keinen** Service Worker
einbauen, damit beim Testen kein Cache stört. Tablet-UI im Querformat. Cloudflare Pages als
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
