# katana-helper

Schlichter Editor für den **BOSS Katana-100 MkII** im Browser.

- **Nur Mac + Google Chrome** über Web MIDI. Der BOSS-KATANA-Treiber muss installiert sein.
  Safari, Firefox, Android und iPad werden nicht unterstützt.
- Technik: Vanilla JS + Vite, später als PWA installierbar
- Kommunikation: Roland SysEx (RQ1/DT1)

## Status

Phase 1 (Verbindung + Debug-Log) ist fertig: <https://muurmoise.github.io/katana-helper/>.
Als Nächstes kommt Phase 2 (Regler live). Die Diagnose-Seite liegt unter
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
