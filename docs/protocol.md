# Katana-100 MkII – SysEx-Protokoll

Referenz für alle MIDI-Nachrichten, die katana-helper an den BOSS Katana MkII schickt
oder von ihm empfängt. Stand: 2026-11-01.

> **Erster eigener Test am 2026-11-01** (Mac, nur lesend): Siehe Abschnitt 10. Was dort
> bestätigt wurde, trägt den Status **GETESTET (eigen)**. Alles andere ist weiter nur durch
> fremde Quellen gedeckt.

## Status-Legende

| Status | Bedeutung |
| --- | --- |
| **GETESTET (eigen)** | Von uns am eigenen Katana MkII gemessen (Abschnitt 10). |
| **GETESTET (Q4)** | Ein Drittprojekt (ktnacontrol) berichtet einen Test am echten Katana MkII (Ton ändert sich und/oder das Gerät meldet den Wert zurück). Außerdem in mindestens einer weiteren MkII-Quelle. |
| **QUELLEN** | Mindestens zwei MkII-Quellen stimmen überein, aber kein bekannter Hardwaretest. |
| **UNVERIFIZIERT** | Nur eine Quelle, Quellen widersprechen sich, nur für den MkI belegt oder von uns abgeleitet. |

## Quellen

| Kürzel | Quelle | Version / Stand | Bezug |
| --- | --- | --- | --- |
| **Q1** | Steven Hirsch, `doc/katana_sysex.txt` – <https://github.com/snhirsch/katana-midi-bridge/blob/master/doc/katana_sysex.txt> | v1.7, 2017-03-23 | **MkI** (Katana 100 Combo, 1. Generation). Format, Checksumme und System-Adressen gelten auch für den MkII; die **Patch-Adressen nicht**. |
| **Q2** | Colin Willcocks („Gumtown“), *Katana MK2 FxFloorBoard*, Quellcode `Katana_Mk2_FxFloorBoard_source_code_20240515.zip` – <https://sourceforge.net/projects/fxfloorboard/files/KatanaFxFloorBoard/Katana%20FxFloorboard%20for%20MK2%20Desktop/> | Source 2024-05-15, `midi.xml` „KATANA Midi implementation“ v2.02 | MkII, Firmware 2. Wichtigste Quelle für die Adresstabelle. Zeilenangaben `midi.xml:NNNNN` beziehen sich auf diese Datei. |
| **Q3** | s4mdf0o1, *TuxKatana* – <https://github.com/s4mdf0o1/TuxKatana> | Commit `2c35bc4`, 2025-10-21 | MkII. `params/*.yaml` (Adressen), `params/config.yaml` (Kanalwechsel), `HOW.md` (mitgeschnittene Nachrichten). |
| **Q4** | fpereira3, *ktnacontrol* (Android-App) – <https://github.com/fpereira3/ktnacontrol> | Commit `5d5dd73`, 2026-09-10 | MkII. `app/src/main/java/dev/alonx3/ktnacontrol/protocol/KatanaAddresses.kt` und `BACKLOG.md` dokumentieren Hardwaretests pro Adresse. |
| **Q5** | BOSS/Roland Support – <https://www.boss.info/au/support/by_product/katana-50_mk2/updates_drivers/925b13ac-a4af-4069-b09c-836b956375e7/> | – | Treiberpflicht unter macOS/Windows. |

### Lizenzen der Quellen – was wir übernehmen dürfen

Stand der Prüfung: 2026-11-01.

| Quelle | Lizenz | Code übernehmen? | Erkenntnisse nutzen? |
| --- | --- | --- | --- |
| Q1 snhirsch/katana-midi-bridge | GPL-2.0 (Repo-`LICENSE`) | Nein. Unser Projekt würde sonst GPL. | Ja, mit Quellenangabe |
| Q2 FxFloorBoard (Katana MK2) | GPL-2.0-or-later (Datei-Header, z. B. `SysxIO.cpp`), beigelegte `license.txt` = GPL-3.0 | Nein, auch `midi.xml` nicht kopieren | Ja, mit Quellenangabe |
| Q3 TuxKatana | AGPL-3.0 (`LICENSE`) | Nein. AGPL würde auch für die gehostete Web-App gelten. | Ja, mit Quellenangabe |
| Q4 ktnacontrol | **Keine Lizenz** (GitHub meldet `license: null`, keine Lizenzdatei, keine Lizenz-Header) → alle Rechte beim Autor | **Nein**, auch nicht in Auszügen | Ja, mit Quellenangabe |

**Regel für katana-helper:**

- Wir schreiben allen Code selbst. Aus keiner der Quellen wird Code kopiert, übersetzt oder
  zeilenweise nachgebaut.
- Übernommen werden nur **Fakten über das Gerät**: Adressen, Wertebereiche, Nachrichtenformat,
  Verhalten, Testergebnisse. Die Tabellen in diesem Dokument sind unsere eigene
  Zusammenstellung.
- Das USB-MIDI-Paketformat (4 Byte, Code Index Number) setzen wir nach der öffentlichen
  Spezifikation *USB Device Class Definition for MIDI Devices 1.0* (usb.org, Kap. 4) um,
  nicht nach dem Code von Q4.
- Die Quellenangabe steht in [`CREDITS.md`](../CREDITS.md) und in dieser Datei (Spalte
  „Quelle“). Das ist nicht rechtlich vorgeschrieben, aber fair und hält die Herkunft
  nachvollziehbar.
- Wird später doch einmal Code aus einer GPL/AGPL-Quelle gebraucht, müsste katana-helper
  unter eine kompatible Lizenz gestellt werden. Das wäre eine bewusste Entscheidung, keine
  Nebenwirkung.

(Keine Rechtsberatung, sondern die übliche Lesart dieser Lizenzen.)

### MkI- vs. MkII-Adressen

Der in der Aufgabenstellung genannte snhirsch-Text (Q1) beschreibt den **MkI**. Q4 hat
nachgemessen, dass MkI-Patch-Adressen am MkII ins Leere gehen (z. B. `60 00 06 18` ist
dort kein Reverb-Level, sondern ein FS2-Parameter). Für Patch-Parameter nutzen wir daher
nur Q2–Q4.

---

## 1. Transport (wichtig für Web MIDI)

| Punkt | Inhalt | Quelle | Status |
| --- | --- | --- | --- |
| USB-Klasse | Der MkII meldet sich als **Vendor Specific** (`bDeviceClass 255`), **nicht** als Standard-USB-MIDI-Gerät. MIDI läuft über Interface 3 (Bulk OUT `0x03`, Bulk IN `0x84`), aber im üblichen 4-Byte-USB-MIDI-Paketformat. | Q4 `CLAUDE.md` §4.1 (per `lsusb -v` am Gerät) | GETESTET (Q4) |
| Desktop | macOS und Windows brauchen den BOSS-KATANA-Treiber; erst dann erscheinen MIDI-Ports, die Chrome per Web MIDI sieht. Linux: `snd-usb-audio` bringt Roland-Quirks mit. | Q5, Q4 §4.1, eigener Test | **GETESTET (eigen)** für macOS 27.0.1 + Chrome 156 + Treiber 1.0.4: Ports „KATANA“ und „KATANA DAW CTRL“, SysEx funktioniert über „KATANA“. |
| WebUSB am Mac | Mit installiertem Treiber schlägt `claimInterface(3)` fehl („Unable to claim interface“), weil der Treiber das Interface hält. `open()` klappt. Die Descriptoren entsprechen Q4 (Interface 3: Alt 0 Bulk `0x03`/`0x84`, Alt 1 Interrupt `0x03`/`0x85`). | eigener Test | **GETESTET (eigen)** |
| Android | Android-MIDI (`android.media.midi`), auf dem Chrome Web MIDI aufsetzt, **erkennt den Katana MkII nicht**. Laut Q4 ist das eine Folge der Vendor-USB-Klasse, nicht der Berechtigungen. | Q4 §4.1 | UNVERIFIZIERT (für Chrome Android) |

**Folge für das Projekt:** Web MIDI wird auf Chrome Desktop (mit Treiber) sehr
wahrscheinlich funktionieren, auf **Chrome Android sehr wahrscheinlich nicht**. Möglicher
Ausweg für Android: **WebUSB** (in Chrome Android verfügbar), Interface 3 selbst
beanspruchen und die SysEx-Nachrichten in USB-MIDI-Pakete (CIN `0x4`–`0x7`) zerlegen.
Ob Chrome dieses Interface freigibt, ist offen → erster Test am Gerät.

---

## 2. Nachrichtenaufbau

### 2.1 Header / Model-ID

```
F0  41  dd  00 00 00 33  cc  …  sum  F7
│   │   │   └─ Model-ID ─┘  │
│   │   │                   └─ Befehl: 11 = RQ1 (Daten anfordern), 12 = DT1 (Daten senden)
│   │   └─ Device-ID: 00
│   └─ Hersteller: Roland
└─ SysEx-Start
```

| Feld | Wert | Quelle | Status |
| --- | --- | --- | --- |
| Hersteller | `41` (Roland) | Q1 Z. 9–15, Q2 `midi.xml:13–17` | GETESTET (Q4) |
| Device-ID | `00` (in `midi.xml` als „Dev=00H–1FH“ beschrieben, alle Quellen senden `00`) | Q1, Q2 `midi.xml:19–21`, Q3 `HOW.md` | GETESTET (Q4) |
| Model-ID | `00 00 00 33` (4 Bytes, gleich wie MkI) | Q1, Q2 `midi.xml:22–33`, Q3 `HOW.md` | GETESTET (Q4) |
| Befehl | `11` = RQ1, `12` = DT1 | Q1 Z. 17–28, Q2 `midi.xml:34–37` | GETESTET (Q4) |

Alle Werte sind 7-Bit-Bytes (`00`–`7F`). Adressen und Größen zählen zur Basis 128:
nach `xx 7F` kommt `xx+1 00`.

### 2.2 Geräteerkennung (Identity Request)

Allgemeine MIDI-Nachricht ohne Roland-Header:

```
→ F0 7E 00 06 01 F7
← F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7     (Beispiel aus Q3)
```

Q2 erkennt den MkII am Anfang der Antwort `F0 7E 00 06 02 41 33 03 00`
(`globalVariables.h:42–43`). Die letzten Bytes sind vermutlich die Firmware-Version.
Status: QUELLEN.

Zusätzlich liefert `RQ1 10 00 00 00`, Größe `00 00 00 10`, den Gerätenamen als ASCII
(`KATANA Mk2`, Q3 `HOW.md`). Status: QUELLEN.

**Eigener Test:** Die Identity Reply ist Byte für Byte gleich mit dem Beispiel aus Q3
(GETESTET (eigen)). `RQ1 10 00 00 00` lieferte bei uns aber **nicht** „KATANA Mk2“,
sondern den Namen des aktuellen Panel-Klangs („muur zusamstra?e“, gleich wie
`60 00 00 00`). Da `10 01 00 00` … `10 08 00 00` die Kanäle A1–B4 sind, ist
`10 00 00 00` vermutlich der **gespeicherte Panel-Patch** und „KATANA Mk2“ bei Q3 nur
dessen Werksname. Status der Deutung: UNVERIFIZIERT. Im Code heißt die Adresse deshalb
`ADDR.PANEL_NAME`. (Nicht-ASCII-Zeichen wie „ß“ zeigt der Amp als `3F` = „?“.)

### 2.3 RQ1 – Daten anfordern (`11`)

```
F0 41 00 00 00 00 33 11  a1 a2 a3 a4  s1 s2 s3 s4  sum F7
                         └ Adresse ┘  └ Größe  ┘
```

- Die Größe ist eine **Bereichsgrenze**, keine exakte Byteanzahl. Das Gerät überspringt
  undefinierte Bereiche und kann weniger zurückgeben (Q1 Z. 38–44).
- Die Antwort kommt als eine oder **mehrere** DT1-Nachrichten, jede mit eigener
  Startadresse. Beispiel: `RQ1 60 00 00 00`, Größe `00 00 0F 00` (1920) → 5 × 241 Byte
  + 1 × 139 Byte (Q3 `HOW.md`).
- **Eigener Test:** Dieselbe Anfrage lieferte bei uns 8 Nachrichten mit zusammen
  1860 Byte: `60 00 00 00`–`60 00 07 43` (964 Byte, 4 Nachrichten) und
  `60 00 08 00`–`60 00 0E 7F` (896 Byte, 4 Nachrichten). Den Bereich `07 44`–`07 7F`
  gibt es nicht, er wird übersprungen. Antwortzeit pro Nachricht etwa 35 ms.
  Status: GETESTET (eigen).
- Laut Q1 und Q4 sollte vor RQ1 der Edit-Mode aktiv sein (Abschnitt 3).

Status: GETESTET (Q4).

### 2.4 DT1 – Daten senden (`12`)

```
F0 41 00 00 00 00 33 12  a1 a2 a3 a4  d1 [d2 …]  sum F7
                         └ Adresse ┘  └ Daten ┘
```

Die meisten Parameter sind 1 Byte groß. Ausnahmen: Kanalwechsel und Speichern (2 Byte,
`00 xx`), Delay-Zeit und Pre-Delay (2 Byte, MSB×128+LSB), Namen (16 Byte ASCII).
Das Gerät schickt bei Änderungen am Bedienfeld selbst DT1-Nachrichten, wenn der
Edit-Mode an ist. Status: GETESTET (Q4).

### 2.5 Roland-Checksumme

Summe über **Adresse + Daten** (bei RQ1: Adresse + Größe), dann der Rest auf 128:

```
summe    = (a1 + a2 + a3 + a4 + d1 + … + dn) mod 128
checksum = (128 − summe) mod 128
```

Prüfbeispiel aus Q1 (Z. 72–90): `60 00 12 14 01` → Summe `0x87` mod 128 = 7 →
Checksumme `0x79`. Dieselbe Rechnung steht in Q2 `MidiTable.cpp:556–565`.
Status: GETESTET (Q4).

Auffällig: Q2 sendet für „aktuellen Kanal abfragen“ die Checksumme `FD`
(`SysxIO.cpp:1156`). Richtig wäre `7D`. Wir verwenden die korrekte Rechnung.

---

## 3. Edit-Mode („BTS control mode“)

| Aktion | Nachricht | Quelle | Status |
| --- | --- | --- | --- |
| Edit-Mode an | `F0 41 00 00 00 00 33 12 7F 00 00 01 01 7F F7` | Q1 Z. 139–143, Q2 `SysxIO.cpp:1155`, Q3 `HOW.md` | GETESTET (Q4) |
| Edit-Mode aus | `F0 41 00 00 00 00 33 12 7F 00 00 01 00 00 F7` | Q1 Z. 156–157, Q2 `floorBoard.cpp:228` | GETESTET (Q4) |

- Bei aktivem Edit-Mode meldet der Amp Änderungen an Reglern und Tastern per DT1.
- Nach dem Einschalten 50–100 ms warten (Q1 Z. 142–143). Q2 sendet den Befehl beim
  Verbinden dreimal im Abstand von 50 ms (`SysxIO.cpp:1144–1150`).
- Beim Trennen wieder ausschalten (Q2 `floorBoard.cpp:228`).

---

## 4. Adressbereiche (Überblick)

| Bereich | Inhalt | Quelle |
| --- | --- | --- |
| `00 00 xx xx` | System (USB-Pegel, globale Einstellungen) | Q1, Q2 `<System>` |
| `00 01 00 00` | Aktiver Kanal (2 Byte) | Q1, Q2, Q3 |
| `00 02 00 00` | MIDI-Empfangskanal (`00`–`0F`) | Q1 Z. 116–117 |
| `10 00 00 00` | Laut Q3 Gerätename (16 Byte), bei uns Name des Panel-Patches (siehe 2.2) | Q3, eigener Test |
| `10 01 00 00` … `10 08 00 00` | Namen der Kanäle A1…B4 (je 16 Byte) | Q3, Q4 |
| `60 00 00 00` … `60 00 0F xx` | **Temporärer Patch** = aktueller Klang. Alle Klangparameter unten liegen hier. | Q2 `<Structure>`, Q3, Q4 |
| `7F 00 00 01` | Edit-Mode | Q1, Q2 |
| `7F 00 01 04` | Aktuellen Klang in Kanal speichern | Q2 `patchWriteDialog.cpp:346` |

Innerhalb von `60 00 …` entspricht das dritte Adressbyte dem Block in Q2 `midi.xml`
(`<Structure><LSB value="..">`): `00` Booster/Preamp/EQ, `01`–`02` MOD, `03`–`04` FX,
`05` Delay/Reverb/Pedal/Send-Return/Noise Gate, `06` Panel/Kette/Farbbelegung,
`07` Knob-Zuweisung.

---

## 5. Kanalwechsel

Der Katana-100 MkII hat **Panel** plus **Bank A und Bank B mit je CH1–CH4**
(8 Kanäle). Ein einziger Wert wählt den Kanal:

| Wert (2. Datenbyte) | Kanal | DT1-Nachricht |
| --- | --- | --- |
| `00` | Panel | `F0 41 00 00 00 00 33 12 00 01 00 00 00 00 7F F7` |
| `01` | A: CH1 | `F0 41 00 00 00 00 33 12 00 01 00 00 00 01 7E F7` |
| `02` | A: CH2 | `… 00 02 7D F7` |
| `03` | A: CH3 | `… 00 03 7C F7` |
| `04` | A: CH4 | `… 00 04 7B F7` |
| `05` | B: CH1 | `… 00 05 7A F7` |
| `06` | B: CH2 | `… 00 06 79 F7` |
| `07` | B: CH3 | `… 00 07 78 F7` |
| `08` | B: CH4 | `… 00 08 77 F7` |

- **Adresse** `00 01 00 00`, **Daten** 2 Byte `00 xx`.
  Quellen: Q3 `params/config.yaml:8–17` (alle acht Nachrichten samt Checksumme),
  Q2 `SysxIO.cpp:727–729` (sendet `00 01 00 00 00 <nr>`), Q1 Z. 160–177 (MkI, 0–4).
  Status: **GETESTET (Q4)** – `BACKLOG.md`, Eintrag 2026-09-03: alle 9 Werte schreiben
  und melden zurück.
- **Aktuellen Kanal abfragen:** `F0 41 00 00 00 00 33 11 00 01 00 00 00 00 00 02 7D F7`
  → Antwort `F0 41 00 00 00 00 33 12 00 01 00 00 00 xx sum F7`. Quellen: Q1 Z. 180–198,
  Q2 `SysxIO.cpp:1156, 1300–1308`. Status: QUELLEN.
- **Katana-50 MkII** (nur 4 Kanäle): A1 = `01`, A2 = `02`, B1 = `05`, B2 = `06`
  (Q2 `SysxIO.cpp:1306`, `patchWriteDialog.cpp:336–339`). Status: UNVERIFIZIERT.
- **Program Change** wäre eine Alternative, nutzt aber eine andere Nummerierung
  (laut Q4 liegt Panel dort auf PC 4, nicht 0) und hängt vom MIDI-Kanal ab.
  Status: UNVERIFIZIERT – wir verwenden SysEx.

**Speichern** des aktuellen Klangs in einen Kanal (überschreibt ihn, nicht umkehrbar):
erst den Namen nach `60 00 00 00` (16 Byte ASCII) schreiben, dann
`F0 41 00 00 00 00 33 12 7F 00 01 04 00 xx sum F7` mit `xx` = `01`…`08`
(Q2 `patchWriteDialog.cpp:336–350`, Q1 Z. 137–157). Status: UNVERIFIZIERT
(Q4 hat es eingebaut, aber noch nicht bestätigt).

---

## 6. Amp

### 6.1 Amp-Typ – zwei Adressen

Der MkII hat für den Amp-Typ zwei getrennte Werte:

| Adresse | Bedeutung | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| `60 00 06 50` | **Stellung des AMP-TYPE-Drehschalters** | `00` Acoustic, `01` Clean, `02` Crunch, `03` Lead, `04` Brown | Q2 `midi.xml:44062–44068`, Q3 `amplifier.yaml:3` (`am_num`) | GETESTET (Q4) |
| `60 00 00 21` | **Konkretes Amp-Modell** (inkl. Variation und versteckter Modelle) | 30 Werte mit Lücken, siehe Tabelle 9.1 | Q2 `midi.xml:37310–37341`, Q3 `amplifier.yaml:2` (`am_type`) | GETESTET (Q4) |
| `60 00 06 5C` | LED „VARIATION“ | `00` aus, `01` an – **nur lesen**. Der Amp ignoriert Schreibbefehle. Variation wechselt man über `60 00 00 21` (z. B. `1D` = Var [Clean]). | Q2 `midi.xml:44107–44110`, Q3 `amplifier.yaml:4` | GETESTET (Q4), nur lesend |

### 6.2 Regler (Gain, Volume, EQ)

Es gibt zwei Adressgruppen: die **Bedienfeld-Regler** im Block `06 5x` und die
**Preamp-Parameter** im Block `00 2x`. Q4 hat nur die Bedienfeld-Adressen getestet; sie
ändern den Klang und melden Drehungen am Gerät zurück. **Für katana-helper verwenden wir
die `06 5x`-Adressen.**

| Parameter | Bedienfeld (empfohlen) | Wertebereich | Preamp-Alternative | Quellen | Status |
| --- | --- | --- | --- | --- | --- |
| Gain | `60 00 06 51` | `00`–`64` = 0–100 | `60 00 00 22` (in `midi.xml` 121 Stufen, `00`–`78`) | Q2 `midi.xml:44069`, `:37342`; Q3 `amplifier.yaml:5` | GETESTET (Q4) |
| Volume | `60 00 06 52` | `00`–`64` = 0–100 | `60 00 00 28` | Q2 `midi.xml:44072`, `:37480`; Q3 `amplifier.yaml:6` | GETESTET (Q4) |
| Bass | `60 00 06 53` | `00`–`64` = 0–100 | `60 00 00 24` | Q2 `midi.xml:44075`, `:37468`; Q3 `amplifier.yaml:7` | GETESTET (Q4) |
| Middle | `60 00 06 54` | `00`–`64` = 0–100 | `60 00 00 25` | Q2 `midi.xml:44078`, `:37471`; Q3 `amplifier.yaml:8` | GETESTET (Q4) |
| Treble | `60 00 06 55` | `00`–`64` = 0–100 | `60 00 00 26` | Q2 `midi.xml:44081`, `:37474`; Q3 `amplifier.yaml:9` | GETESTET (Q4) |
| Presence | `60 00 06 56` | `00`–`64` = 0–100 | `60 00 00 27` | Q2 `midi.xml:44084`, `:37477` | GETESTET (Q4) |

**Eigener Test (nur lesend):** Im Patch-Dump sind Volume, Bass, Middle, Treble und
Presence in `00 24`–`00 28` und `06 52`–`06 56` **gleich**. Gain weicht ab:
`00 22` = `2E` (46), `06 51` = `21` (33).

Beim Drehen am GAIN-Regler meldet der Amp **beide** Adressen, immer zuerst `00 22`, dann
`06 51` (etwa alle 22 ms). Im Ruhezustand gilt bei Amp-Typ Clean ungefähr
**`00 22` ≈ 0,8 × `06 51` + 20** (gemessen: 19 → 35, 33 → 46, 51 → 61, 70 → 76). Beim
schnellen Drehen hinkt `00 22` etwas hinterher, als würde es geglättet. Deutung:
`06 51` ist die Reglerstellung, `00 22` der daraus berechnete interne Gain-Wert. Ob die
Formel bei anderen Amp-Typen gleich ist: UNVERIFIZIERT. Für katana-helper bleibt
`06 51` die richtige Adresse (GETESTET (eigen), lesend).

Die Preamp-Alternativen sind **UNVERIFIZIERT** als Schreibadressen. Q3 widerspricht sich
bei Gain/Volume selbst (`doc/Adresses.txt` nennt die `00 2x`-Adressen als Schreibziel,
`amplifier.yaml` die `06 5x`-Adressen). Der Test in Q4 spricht für `06 5x`.

---

## 7. Effekte: an/aus und Typ

### 7.1 An/Aus

`00` = aus, `01` = an.

| Effekt | Adresse | Quelle | Status |
| --- | --- | --- | --- |
| Booster | `60 00 00 10` | Q2 `midi.xml:37109`, Q3 `booster.yaml:2`, `config.yaml` | GETESTET (Q4) |
| MOD | `60 00 01 00` | Q2 `midi.xml:37920`, Q3 `mod.yaml:2` | GETESTET (Q4) |
| FX | `60 00 03 00` | Q2 `midi.xml:40158`, Q3 `fx.yaml:2` | GETESTET (Q4) |
| Delay (Delay 1) | `60 00 05 00` | Q2 `midi.xml:42396`, Q3 `delay.yaml:2` | GETESTET (Q4) |
| Delay 2 | `60 00 05 20` | Q2 `midi.xml:42628`, Q3 `config.yaml` (`DELAY_R`) | QUELLEN |
| Reverb | `60 00 05 40` | Q2 `midi.xml:42860`, Q3 `reverb.yaml:2` | GETESTET (Q4) |

### 7.2 Typ (aktiv)

Schreibt man hier, ändert sich der Effekttyp der gerade gewählten Farbe.

| Effekt | Adresse | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| Booster | `60 00 00 11` | Tabelle 9.2 | Q2 `midi.xml:37113`, Q3 `booster.yaml:3` | GETESTET (Q4) |
| MOD | `60 00 01 01` | Tabelle 9.3 | Q2 `midi.xml:37924`, Q3 `mod.yaml:3` | GETESTET (Q4) |
| FX | `60 00 03 01` | Tabelle 9.3 (gleiche Liste wie MOD) | Q2 `midi.xml:40162`, Q3 `fx.yaml:3` | GETESTET (Q4) |
| Delay 1 | `60 00 05 01` | Tabelle 9.4 | Q2 `midi.xml:42400`, Q3 `delay.yaml:3` | GETESTET (Q4) |
| Delay 2 | `60 00 05 21` | Tabelle 9.4 | Q2 `midi.xml:42632` | UNVERIFIZIERT |
| Reverb | `60 00 05 41` | Tabelle 9.5 | Q2 `midi.xml:42864`, Q3 `reverb.yaml:3` | GETESTET (Q4) |

Q4 hält fest: Der FX-Block ist eine Kopie des MOD-Blocks, um `+ 02 00` verschoben
(z. B. MOD `60 00 01 01` ↔ FX `60 00 03 01`).

### 7.3 Farbwahl (Taster unter dem Effektregler)

Jeder Effekt hat drei Speicherplätze, Grün/Rot/Gelb, jeweils mit eigenem Typ.

| Effekt | Farbwahl | Typ in Grün / Rot / Gelb (nur lesen empfohlen) | Quelle | Status |
| --- | --- | --- | --- | --- |
| Booster | `60 00 06 39` | `06 24` / `06 25` / `06 26` | Q2 `midi.xml:43960`, `:43567`; Q3 `booster.yaml:11–14` | GETESTET (Q4) |
| MOD | `60 00 06 3A` | `06 27` / `06 28` / `06 29` | Q2 `midi.xml:43965`; Q3 `mod.yaml:4–7` | GETESTET (Q4) |
| FX | `60 00 06 3B` | `06 2A` / `06 2B` / `06 2C` | Q2 `midi.xml:43970`; Q3 `fx.yaml:4–7` | GETESTET (Q4) |
| Delay 1 | `60 00 06 3C` | `06 2D` / `06 2E` / `06 2F` | Q2 `midi.xml:43975`; Q3 `delay.yaml:25–28` | GETESTET (Q4) |
| Reverb/Delay 2 | `60 00 06 3D` | `06 30` / `06 31` / `06 32` | Q2 `midi.xml:43980`; Q3 `reverb.yaml:4–7` | GETESTET (Q4) |

**GETESTET (eigen): `00` = Grün, `01` = Rot, `02` = Gelb.** Belegt durch den Patch-Dump vom
2026-11-01 (Abschnitt 10): Bei allen fünf Effekten ist der aktive Typ gleich dem Typ im
Speicherplatz der gewählten Farbe. Booster Farbe `01` → aktiv `0F` = Rot-Platz `06 25`.
MOD, FX und Delay Farbe `00` → aktiv = Grün-Platz. Reverb Farbe `01` → aktiv `03` =
Rot-Platz `06 31` (Grün wäre `04`). `02` = Gelb ist daraus abgeleitet.

Gegenprobe am Gerät: Die LEDs von Booster (Farbe `01`) und Reverb (Farbe `01`) leuchten
rot. Damit ist die Zuordnung bestätigt.

Frühere Quellenlage: Q2 `midi.xml:43960ff.` listet
`00 = RED, 01 = GREEN, 02 = YELLOW`. Q3, Q4 und die Reihenfolge der Farbplätze
(`06 24` = GREEN, `06 25` = RED, `06 26` = YELLOW, ebenfalls aus Q2) sprechen für
**`00` = Grün, `01` = Rot, `02` = Gelb**. Q4 nennt das selbst noch offen, bis jemand die
LED am Gerät vergleicht. Q2 liegt damit falsch.

Der Reverb-Regler kann je Farbe auch Delay 2 steuern: `60 00 06 36`/`37`/`38`
(Grün/Rot/Gelb) mit `00` Delay, `01` Delay+Reverb, `02` Reverb
(Q2 `midi.xml:43945`, Q3 `reverb.yaml:9–11`). Status: QUELLEN.

### 7.4 Effekt-Regler (Bonus, nicht gefordert)

| Regler | Adresse | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| Booster | `60 00 06 57` | `00` = aus, `01`–`65` = 0–100 | Q2 `midi.xml:44087` | GETESTET (Q4) |
| MOD | `60 00 06 58` | wie oben | Q2 `midi.xml:44091` | GETESTET (Q4) |
| FX | `60 00 06 59` | wie oben | Q2 `midi.xml:44095` | GETESTET (Q4) |
| Delay | `60 00 06 5A` | wie oben; laut Q4 Mischung beider Delays | Q2 `midi.xml:44099` | GETESTET (Q4) |
| Reverb | `60 00 06 5B` | wie oben | Q2 `midi.xml:44103`, Q3 `reverb.yaml` | GETESTET (Q4) |

**Eigener Test:** Dreht man den MOD-Regler aus der Stellung `00` (MOD aus), meldet der Amp
nacheinander `01 00` = `01` (MOD an), `06 5E` = `01` (MOD-LED an) und dann laufend
`06 58` (Reglerstellung) zusammen mit `02 14`. Bei MOD-Typ Tremolo ist `02 14` laut Q2
„MOD TR: Rate“: Der Regler steuert also den Hauptparameter des aktiven Typs mit.
Status: GETESTET (eigen), lesend.

### 7.5 LED-Zustände (nur lesen)

| LED | Adresse | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| Variation | `60 00 06 5C` | `00` aus, `01` an | Q2 `midi.xml` (Panel `5C`) | GETESTET (Q4) |
| Booster | `60 00 06 5D` | wie oben | Q2 (Panel `5D`) | QUELLEN |
| MOD | `60 00 06 5E` | wie oben | Q2 (Panel `5E`) | GETESTET (eigen) |
| FX | `60 00 06 5F` | wie oben | Q2 (Panel `5F`) | QUELLEN |
| Delay 1 | `60 00 06 60` | wie oben | Q2 (Panel `60`) | QUELLEN |
| Reverb/Delay 2 | `60 00 06 61` | wie oben | Q2 (Panel `61`) | QUELLEN |

Status QUELLEN heißt hier: nur Q2, aber dieselbe Tabelle wie die bestätigte MOD-LED.

---

## 8. Beispielnachrichten

Mit der Checksummen-Rechnung aus 2.5 berechnet.

| Zweck | Nachricht |
| --- | --- |
| Edit-Mode an | `F0 41 00 00 00 00 33 12 7F 00 00 01 01 7F F7` |
| Kompletten Patch lesen | `F0 41 00 00 00 00 33 11 60 00 00 00 00 00 0F 00 11 F7` |
| Name `10 00 00 00` lesen (siehe 2.2) | `F0 41 00 00 00 00 33 11 10 00 00 00 00 00 00 10 60 F7` |
| Kanal A1 | `F0 41 00 00 00 00 33 12 00 01 00 00 00 01 7E F7` |
| AMP-TYPE-Schalter auf Lead | `F0 41 00 00 00 00 33 12 60 00 06 50 03 47 F7` |
| Amp-Modell Brown | `F0 41 00 00 00 00 33 12 60 00 00 21 17 68 F7` |
| Gain = 50 | `F0 41 00 00 00 00 33 12 60 00 06 51 32 17 F7` |
| Booster an | `F0 41 00 00 00 00 33 12 60 00 00 10 01 0F F7` |
| Reverb-Typ Plate | `F0 41 00 00 00 00 33 12 60 00 05 41 04 56 F7` |

---

## 9. Wertetabellen

Alle Werte aus Q2 `midi.xml`. Lücken in den Listen sind echt; Werte, die fehlen, nicht
senden.

### 9.1 Amp-Modell (`60 00 00 21`)

| Wert | Modell | Wert | Modell |
| --- | --- | --- | --- |
| `01` | Acoustic (Panel) | `1C` | Variation Acoustic |
| `08` | Clean (Panel) | `1D` | Variation Clean |
| `0B` | Crunch (Panel) | `1E` | Variation Crunch |
| `18` | Lead (Panel) | `1F` | Variation Lead |
| `17` | Brown (Panel) | `20` | Variation Brown |
| `00` | Natural Clean | `0E` | VO Lead |
| `09` | Clean Twin | `10` | BG Lead |
| `02` | Combo Crunch | `06` | Extreme Lead |
| `0A` | Pro Crunch | `16` | T-Amp Lead |
| `0C` | Deluxe Crunch | `12` | MS-1959 I |
| `03` | Stack Crunch | `13` | MS-1959 I+II |
| `0D` | VO Drive | `04` | HiGain Stack |
| `11` | BG Drive | `14` | R-Fier Vintage |
| `0F` | Match Drive | `15` | R-Fier Modern |
| `05` | Power Drive | `07` | Core Metal |

Quelle: Q2 `midi.xml:37310–37341`. Werte `19`–`1B` existieren nicht.

### 9.2 Booster-Typ (`60 00 00 11`)

`00` Mid Boost, `01` Clean Boost, `02` Treble Boost, `03` Crunch OD, `04` Natural OD,
`05` Warm OD, `06` Fat DS, `08` Metal DS, `09` OCT Fuzz, `0A` Blues Drive,
`0B` Overdrive, `0C` Tubescreamer, `0D` Turbo OD, `0E` Distortion, `0F` Rat,
`10` GuV DS, `11` DST+, `12` Metal Zone, `13` '60s Fuzz, `14` Muff Fuzz, `15` HM-2,
`16` Metal Core, `17` Centa OD. (`07` fehlt.) Quelle: Q2 `midi.xml:37113–37137`.

### 9.3 MOD-/FX-Typ (`60 00 01 01`, `60 00 03 01`)

`00` T.Wah, `01` Auto Wah, `02` Pedal Wah, `03` Compressor, `04` Limiter,
`06` Graphic EQ, `07` Para EQ, `09` Guitar Sim, `0A` Slow Gear, `0C` Wave Synth,
`0E` Octave, `0F` Pitch Shifter, `10` Harmonist, `12` AC Processor, `13` Phaser,
`14` Flanger, `15` Tremolo, `16` Rotary, `17` Uni-V, `19` Slicer, `1A` Vibrato,
`1B` Ring Mod, `1C` Humanizer, `1D` 2x2 Chorus, `1F` AC Guitar Sim, `23` Phaser 90E,
`24` Flanger 117E, `25` Wah 95E, `26` Delay Chorus 30, `27` Heavy Octave,
`28` Pedal Bend. Quelle: Q2 `midi.xml:37924–37956` (MOD), `:40162ff.` (FX).

### 9.4 Delay-Typ (`60 00 05 01`, `60 00 05 21`)

`00` Digital, `01` Pan, `02` Stereo, `03` Dual Series, `04` Dual Parallel,
`05` Dual L/R, `06` Reverse, `07` Analog, `08` Tape Echo, `09` Modulate,
`0A` SDE-3000. Quelle: Q2 `midi.xml:42400ff.`

### 9.5 Reverb-Typ (`60 00 05 41`)

`00` Ambience, `01` Room, `02` Hall 1, `03` Hall 2, `04` Plate, `05` Spring, `06` Mod.
Quelle: Q2 `midi.xml:42864ff.`

---

## 10. Eigene Messungen

### 10.1 Mac, Web MIDI, 2026-11-01

- macOS 27.0.1, Chrome 156, BOSS-KATANA-Treiber 1.0.4, Katana über USB-Hub
  (CalDigit-Dock).
- `requestMIDIAccess({ sysex: true })` klappt, `sysexEnabled = true`.
- Identity, Edit-Mode an, RQ1 auf `10 00 00 00`, `00 01 00 00`, `60 00 00 00`,
  `60 00 06 51`: alle Antworten mit korrekter Checksumme, je etwa 6–20 ms.
- Aktiver Kanal: Panel (`00 00`).

Werte aus dem Patch-Dump (Panel-Klang, Amp auf Clean), nur gelesen:

| Adresse | Bedeutung | Wert | Passt zu |
| --- | --- | --- | --- |
| `60 00 06 50` | AMP-TYPE-Schalter | `01` Clean | `00 21` = `08` Clean (Panel) |
| `60 00 00 21` | Amp-Modell | `08` Clean (Panel) | – |
| `60 00 06 5C` | Variation-LED | `00` aus | – |
| `60 00 06 51` / `00 22` | Gain | `21` (33) / `2E` (46) | weichen ab, siehe 6.2 |
| `60 00 06 52` / `00 28` | Volume | `1A` / `1A` | gleich |
| `60 00 06 53`–`56` / `00 24`–`27` | Bass, Middle, Treble, Presence | `27 3A 33 00` / gleich | gleich |
| `60 00 00 10` / `00 11` | Booster an / Typ | `01` / `0F` Rat | Farbe `01`, Rot-Platz `06 25` = `0F` |
| `60 00 01 00` / `01 01` | MOD an / Typ | `00` / `15` Tremolo | Farbe `00`, Grün-Platz `06 27` = `15` |
| `60 00 03 00` / `03 01` | FX an / Typ | `00` / `0A` Slow Gear | Farbe `00`, Grün-Platz `06 2A` = `0A` |
| `60 00 05 00` / `05 01` | Delay an / Typ | `00` / `06` Reverse | Farbe `00`, Grün-Platz `06 2D` = `06` |
| `60 00 05 40` / `05 41` | Reverb an / Typ | `01` / `03` Hall 2 | Farbe `01`, Rot-Platz `06 31` = `03` |
| `60 00 06 57`–`5B` | Effekt-Regler | `0C 00 00 00 2F` | Regler `00` genau bei den Effekten, die aus sind |
| `60 00 06 36`–`38` | Reverb-Regler-Belegung | `02 02 02` (Reverb) | – |

### 10.2 Mac, Meldungen vom Amp, 2026-11-01

Mit Edit-Mode an schickt der Amp Änderungen am Bedienfeld von sich aus als DT1, ohne
Anfrage:

| Aktion am Amp | Meldungen | Takt |
| --- | --- | --- |
| GAIN drehen | `60 00 00 22` (Preamp-Gain), dann `60 00 06 51` (Regler) | etwa 22 ms je Paar |
| MOD-Regler aus `00` hochdrehen | `60 00 01 00` = `01`, `60 00 06 58`, `60 00 06 5E` = `01`, dann laufend `06 58` + `02 14` (Tremolo Rate) | etwa 22 ms |
| vermutlich TAP gedrückt | `60 00 05 02` = `01 75`: Delay-1-Zeit, 2 Byte, 128er-Stellen → 245 ms (Q2: „DD1: Time“) | einmalig |

Alle Checksummen korrekt. Der eingefügte Log war nach 11:23:37 abgeschnitten
(Längenlimit beim Einfügen); weitere Aktionen danach sind nicht ausgewertet.

## 11. Offene Punkte

Die Checkliste für den Gerätetest und alle offenen Protokollfragen stehen jetzt in
[`device-test.md`](device-test.md).
