# katana-helper

## Projektziel

Ein schlichter Web-Editor für den BOSS Katana-100 MkII. Er verbindet sich über USB
per Web MIDI (Chrome Android + Chrome Desktop) und liest/schreibt Parameter per
Roland-SysEx. Umsetzung als PWA mit Vanilla JS oder Svelte + Vite.

Hinweis: Der Projektpfad enthält ein Leerzeichen (`katana helper`) – Pfade in
Shell-Befehlen immer quoten.

## Phasen

1. **Setup** – git, .gitignore, README, CLAUDE.md, GitHub-Repo `katana-helper`, erster Commit.
2. **Protokoll** – Roland-SysEx für Katana MkII recherchieren und in
   `docs/protocol.md` dokumentieren: Header/Model-ID, Edit-Mode-Befehl,
   RQ1/DT1-Format, Roland-Checksumme, Adressen für Amp-Typ, Gain, Volume, Bass,
   Middle, Treble, Presence, Booster/Mod/FX/Delay/Reverb an/aus + Typ,
   Kanalwechsel (Panel, CH1–CH4 bzw. A/B). Quelle pro Adresse angeben,
   Unsicheres als "UNVERIFIZIERT" markieren. Noch kein UI-Code.

Weitere Phasen werden ergänzt, sobald Phase 2 abgeschlossen ist.

## Konventionen

- `docs/protocol.md` ist die verbindliche Referenz für alle SysEx-Adressen.
  Neue oder geänderte Adressen dort mit Quelle eintragen.
- Werte, die nicht am echten Gerät getestet wurden, bleiben als UNVERIFIZIERT markiert.
