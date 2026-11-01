# katana-helper

Schlichter Editor für den **BOSS Katana-100 MkII** im Browser.

- **Nur Mac + Google Chrome** über Web MIDI. Der BOSS-KATANA-Treiber muss installiert sein.
  Safari, Firefox, Android und iPad werden nicht unterstützt.
- Technik: Vanilla JS + Vite, als App installierbar (PWA), läuft auch offline
- Kommunikation: Roland SysEx (RQ1/DT1)

## Status

Editor: <https://muurmoise.github.io/katana-helper/>. Phase 2 (Regler live) ist umgesetzt:
Kanal, Amp-Typ und Modell, Gain/EQ/Volume, sechs Effekte (mit Delay 2) mit an/aus, Farbe und
Typ. Phase 4 (Effekt-Regler): Unter „Regler“ stehen die Einstellungen jedes Effekttyps,
z. B. Rate und Depth beim Tremolo oder Time beim Delay.
Phase 3 (Patches) ist umgesetzt: Bibliothek im Browser, JSON-Export und -Import, Kanäle
sichern und Patches in einen Kanal speichern. Vor jedem Speichern sichert der Editor den
Zielkanal automatisch. Die Diagnose-Seite liegt unter
<https://muurmoise.github.io/katana-helper/probe/>.

Phase 5 (PWA): katana-helper lässt sich in Chrome als App installieren und startet auch ohne
Internet. Neue Versionen kommen nur nach Klick auf „Aktualisieren“.

Presets mit Claude oder ChatGPT: [docs/preset-guide.md](docs/preset-guide.md) dem Modell
geben, Wunsch-Sound beschreiben, die JSON-Antwort unter Patches → „Preset einfügen …“
übernehmen und mit „Laden“ anhören.

System (global): Schalter „Line Out: REC | LIVE | BLEND“ (Air Feel). Gilt für alle Kanäle
und nur für Line Out, Kopfhörer und USB, nicht für den Lautsprecher.

Roadmap: [CLAUDE.md](CLAUDE.md) · MIDI-Protokoll: [docs/protocol.md](docs/protocol.md) ·
Quellen: [CREDITS.md](CREDITS.md)

## Als App installieren

In Chrome am Mac <https://muurmoise.github.io/katana-helper/> öffnen. Dann unten auf der Seite
**„Als App installieren“** klicken, oder in der Adressleiste rechts auf das Installieren-Symbol.
Danach liegt „katana-helper“ im Programme-Ordner, im Launchpad und im Dock wie jede andere
App. Sie öffnet sich in einem eigenen Fenster.

- **Offline:** Nach dem ersten Besuch liegt die ganze App im Browser-Speicher. Sie startet
  auch ohne Internet. Für den Amp braucht es nur USB.
- **MIDI-Erlaubnis:** Die App teilt sich die Erlaubnis mit der Webseite. Wer sie in Chrome
  schon erteilt hat, muss nichts mehr tun.
- **Updates:** Gibt es eine neue Version, erscheint oben „Neue Version von katana-helper
  verfügbar“. Erst „Aktualisieren“ lädt sie. Das passiert nie von selbst, damit sich mitten
  im Spielen nichts ändert. Die Versionsnummer steht unten auf der Seite.
- **Deinstallieren:** In der App oben rechts ⋮ → „katana-helper deinstallieren“, oder
  `chrome://apps` → Rechtsklick. Bibliothek und Patches bleiben im Browser erhalten, solange
  die Website-Daten nicht gelöscht werden.

## Entwicklung

```sh
npm install
npm run dev      # http://localhost:5173/katana-helper/
npm test
npm run build
```

Web MIDI und WebUSB laufen nur in einem sicheren Kontext (HTTPS oder `localhost`).

Der Service Worker existiert nur im fertigen Build. `npm run dev` cacht nichts. Zum Testen
der PWA: `npm run build && npm run preview` (http://localhost:4173/katana-helper/).
Aufbau: `build/pwa-plugin.js` schreibt nach dem Build `manifest.webmanifest` und `sw.js`
(Quelle `src/pwa/sw.js`) mit der Version und der Liste aller Dateien.

## Deploy

Jeder Push auf `main` baut die Seite und veröffentlicht sie per GitHub Actions auf GitHub
Pages. Einmalig nötig: Repo → **Settings → Pages → Build and deployment → Source:
„GitHub Actions“**.

### Alternative: Cloudflare Pages

Die Seite ist rein statisch und läuft auf jedem Host mit HTTPS. Beispiel Cloudflare Pages:

1. Cloudflare-Dashboard → **Workers & Pages → Create → Pages → Connect to Git**, Repo
   `katana-helper` wählen.
2. Build-Einstellungen:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Umgebungsvariablen: `BASE_PATH` = `/` (die Seite liegt dort an der Wurzel, nicht unter
     `/katana-helper/`) und `NODE_VERSION` = `24`
3. Speichern. Jeder Push auf `main` baut die Seite neu, dazu gibt es Vorschau-URLs für
   andere Branches.

Hinweise:

- **Tests:** Cloudflare führt nur `npm run build` aus, nicht `npm test`. Wer die Tests als
  Sperre will, nimmt als Build command `npm test && npm run build`.
- **Version:** Die Versionsnummer nimmt den Commit aus `CF_PAGES_COMMIT_SHA`, wie bei
  GitHub aus `GITHUB_SHA`.
- **Daten:** Die Bibliothek (IndexedDB) hängt an der Adresse. Unter einer neuen Domain ist
  sie leer. Vorher in der alten Version „Alle exportieren“, dann in der neuen importieren.
- **Service Worker:** GitHub Pages und Cloudflare liefern `sw.js` mit kurzer Cache-Zeit aus.
  Chrome prüft ihn ohnehin bei jedem Start und spätestens stündlich.

## Lizenz

Noch offen. Der Code ist selbst geschrieben; Protokollwissen stammt aus den in
[CREDITS.md](CREDITS.md) genannten Projekten.
