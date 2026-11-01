# Credits

katana-helper enthält **keinen Code** aus den folgenden Projekten. Unser Wissen über das
SysEx-Protokoll des BOSS Katana MkII stammt aber zu großen Teilen aus ihrer
Reverse-Engineering-Arbeit. Danke dafür.

| Projekt | Autor | Lizenz | Was wir daraus wissen |
| --- | --- | --- | --- |
| [katana-midi-bridge](https://github.com/snhirsch/katana-midi-bridge), `doc/katana_sysex.txt` | Steven Hirsch | GPL-2.0 | Nachrichtenformat, Roland-Checksumme, Edit-Mode, System-Adressen (Katana MkI) |
| [Katana MK2 FxFloorBoard](https://sourceforge.net/projects/fxfloorboard/) | Colin Willcocks („Gumtown“), Uco Mesdag | GPL-2.0-or-later | Adresstabelle und Wertelisten für den Katana MkII (`midi.xml` v2.02) |
| [TuxKatana](https://github.com/s4mdf0o1/TuxKatana) | s4mdf0o1 | AGPL-3.0 | Mitgeschnittene Nachrichten, Kanalwechsel, Adressen pro Effekt (MkII) |
| [ktnacontrol](https://github.com/fpereira3/ktnacontrol) | fpereira3 | keine Lizenz angegeben (alle Rechte vorbehalten) | USB-Transport des MkII (herstellerspezifisches Interface), Hardwaretests einzelner Adressen |

Details zu jeder Adresse und ihrer Quelle: [docs/protocol.md](docs/protocol.md).

Die Vorbilder der Amp-Modelle und Effekte in [docs/preset-guide.md](docs/preset-guide.md)
stammen aus der Dokumentation von Roland/BOSS zum GT-100 (*GT-100 Training Guide*,
*Owner's Manual*) sowie aus Reviews; die Quellen stehen dort.

BOSS und KATANA sind Marken der Roland Corporation. katana-helper ist ein privates
Projekt und steht in keiner Verbindung zu Roland/BOSS.
