# katana-helper

Schlichter Editor für den **BOSS Katana-100 MkII** im Browser.

- **Nur Mac + Google Chrome** über Web MIDI. Der BOSS-KATANA-Treiber muss installiert sein.
  Safari, Firefox, Android und iPad werden nicht unterstützt.
- Technik: Vanilla JS + Vite, später als PWA installierbar
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

Roadmap: [CLAUDE.md](CLAUDE.md) · MIDI-Protokoll: [docs/protocol.md](docs/protocol.md) ·
Quellen: [CREDITS.md](CREDITS.md)

## Entwicklung

```sh
npm install
npm run dev      # http://localhost:5173/katana-helper/
npm test
npm run build
```

Web MIDI und WebUSB laufen nur in einem sicheren Kontext (HTTPS oder `localhost`).

## Deploy

Jeder Push auf `main` baut die Seite und veröffentlicht sie per GitHub Actions auf GitHub
Pages. Einmalig nötig: Repo → **Settings → Pages → Build and deployment → Source:
„GitHub Actions“**.

## Lizenz

Noch offen. Der Code ist selbst geschrieben; Protokollwissen stammt aus den in
[CREDITS.md](CREDITS.md) genannten Projekten.
