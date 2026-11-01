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
| **Q1** | Steven Hirsch, `doc/katana_sysex.txt` – <https://github.com/snhirsch/katana-midi-bridge/blob/master/doc/katana_sysex.txt> | v1.7, 2017-03-23 | **MkI** (Katana 100 Combo, 1. Generation). Format, Checksumme, Edit-Mode und Kanal-Adresse gelten auch für den MkII; die **Patch-Adressen und die Offsets im System-Bereich nicht** (10.6). |
| **Q2** | Colin Willcocks („Gumtown“), *Katana MK2 FxFloorBoard*, Quellcode `Katana_Mk2_FxFloorBoard_source_code_20240515.zip` – <https://sourceforge.net/projects/fxfloorboard/files/KatanaFxFloorBoard/Katana%20FxFloorboard%20for%20MK2%20Desktop/> | Source 2024-05-15, `midi.xml` „KATANA Midi implementation“ v2.02 | MkII, Firmware 2. Wichtigste Quelle für die Adresstabelle. Zeilenangaben `midi.xml:NNNNN` beziehen sich auf diese Datei. |
| **Q3** | s4mdf0o1, *TuxKatana* – <https://github.com/s4mdf0o1/TuxKatana> | Commit `2c35bc4`, 2025-10-21 | MkII. `params/*.yaml` (Adressen), `params/config.yaml` (Kanalwechsel), `HOW.md` (mitgeschnittene Nachrichten). |
| **Q4** | fpereira3, *ktnacontrol* (Android-App) – <https://github.com/fpereira3/ktnacontrol> | Commit `5d5dd73`, 2026-09-10 | MkII. `app/src/main/java/dev/alonx3/ktnacontrol/protocol/KatanaAddresses.kt` und `BACKLOG.md` dokumentieren Hardwaretests pro Adresse. |
| **Q5** | BOSS/Roland Support – <https://www.boss.info/au/support/by_product/katana-50_mk2/updates_drivers/925b13ac-a4af-4069-b09c-836b956375e7/> | – | Treiberpflicht unter macOS/Windows. |
| **Q6** | BOSS: Produktseite Katana-Artist MkII – <https://www.boss.info/US/products/katana-artist_mk2>, Pressemitteilung „Version 2 Update for Katana MkII“ (2022-07-14) – <https://www.roland.com/us/company/press_releases/2022/BOSS-Announces-Version-2-Update-for-Katana-MkII-Gu/> | – | Was Air Feel und Line Out Custom bewirken (keine Adressen). |

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

**Entscheidung 2026-11-01:** katana-helper unterstützt nur Mac + Chrome über Web MIDI. Der
folgende Absatz ist der ursprüngliche Plan und bleibt zur Dokumentation stehen.

**Ursprünglicher Plan:** Web MIDI wird auf Chrome Desktop (mit Treiber) sehr
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
- **Korrektur (2026-11-01): Ein ganzer Patch ist 1932 Byte groß.** Die Größe 1920
  (`00 00 0F 00`, aus Q3) schneidet ab. FxFloorBoard fragt `00 00 0F 48` = 1992 an
  (Q2 `globalVariables.h:65`, `patchRequestDataSize`). Damit antwortet der Amp mit
  9 Nachrichten: wie oben, dazu `60 00 0D 53` mit vollen 241 Byte und `60 00 0F 44` mit
  4 Byte, zusammen 1932 Byte (`00 00`–`07 43` und `08 00`–`0F 47`). katana-helper fragt
  seitdem 1992 an. Status: GETESTET (eigen).
- Laut Q1 und Q4 sollte vor RQ1 der Edit-Mode aktiv sein (Abschnitt 3).
- **Mehrere MIDI-Programme gleichzeitig** (zwei Browser-Tabs, App und Diagnose-Seite):
  Die Antworten des Amps tragen keinen Empfänger. Unter macOS sieht jedes Programm am Port
  „KATANA“ auch die Antworten auf die Anfragen der anderen. Eine Antwort auf `00 01 00 00`
  sieht deshalb aus wie ein Kanalwechsel am Amp. katana-helper reagiert nur, wenn sich der
  Kanal wirklich geändert hat. Sonst schaukeln sich zwei Tabs endlos hoch (am 2026-11-01
  beobachtet und behoben). Status: GETESTET (eigen).

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
| `00 00 xx xx` | **System**: globale Einstellungen (USB, Global EQ, Line Out Air Feel, Line Out Custom …). Gilt für alle Kanäle, liegt in keinem Patch. Details: Abschnitt 12. | Q2 `<System>`, eigener Test |
| `00 01 00 00` | Aktiver Kanal (2 Byte) | Q1, Q2, Q3 |
| `00 02 00 00` | MIDI-Empfangskanal (`00`–`0F`) | Q1 Z. 116–117 |
| `10 00 00 00` | Laut Q3 Gerätename (16 Byte), bei uns Name des Panel-Patches (siehe 2.2) | Q3, eigener Test |
| `10 01 00 00` … `10 08 00 00` | Namen der Kanäle A1…B4 (je 16 Byte) | Q3, Q4 |
| `10 0n 00 00`, Größe `00 00 0F 48` | **Ganzer gespeicherter Kanal** n (0 = Panel, 1–8 = A1–B4), gleicher Aufbau wie `60 00 …`, 1932 Byte. Lesen geht ohne Kanalwechsel. | Q2 `MidiTable.cpp:696–740` (`patchRequest`: `10 + n`), eigener Test: GETESTET (eigen) für alle 9 |
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
`F0 41 00 00 00 00 33 12 7F 00 01 04 00 xx sum F7` mit `xx` = `01`…`08` (A1–B4).
Der Befehl speichert den temporären Patch `60 00 …` so, wie er gerade ist, einschließlich
Name (`60 00 00 00`, 16 Byte ASCII). Wer umbenennen will, schreibt vorher den Namen.
Q2 (`patchWriteDialog.cpp:320–350`) sendet nur diesen einen Befehl; `xx` = `00` wäre dort
Panel. Q1 Z. 137–157. Status: UNVERIFIZIERT (Q4 hat es eingebaut, aber noch nicht
bestätigt).

So nutzt katana-helper den Befehl (Phase 3, `src/lib/manager.js`):
1. Zielkanal über `10 0n 00 00` komplett lesen und als Auto-Backup in der Bibliothek
   ablegen. Schlägt das fehl, wird nicht gespeichert.
2. Falls ein neuer Name gewünscht ist: Name nach `60 00 00 00` schreiben.
3. Speicherbefehl senden, nur für A1–B4. Panel (`00`) ist gesperrt.
4. Nach 600 ms `10 0n 00 00` zurücklesen und mit dem temporären Patch vergleichen (ohne
   die LED-Bytes `06 5C`–`06 61`).

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
Formel bei anderen Amp-Typen gleich ist: UNVERIFIZIERT. Ein zweiter Log mit Amp-Typ
Crunch passt zur selben Formel (46 → 57, 42 → 54, 39 → 51). Bass und Middle melden dagegen
in `00 24`/`06 53` und `00 25`/`06 54` **denselben** Wert. Für katana-helper bleibt
`06 51` die richtige Adresse (GETESTET (eigen), lesend).

**Schreiben (eigener Test 2026-11-01):** `06 51` mit dem gerade eingestellten Wert
geschrieben und zurückgelesen: übernommen. Danach meldet `00 22` den passenden internen
Wert. Ob ein **geänderter** Wert den Klang hörbar ändert, prüft Martin mit dem Editor
(`docs/device-test.md` Teil 3).

Die Preamp-Alternativen sind **UNVERIFIZIERT** als Schreibadressen. Q3 widerspricht sich
bei Gain/Volume selbst (`doc/Adresses.txt` nennt die `00 2x`-Adressen als Schreibziel,
`amplifier.yaml` die `06 5x`-Adressen). Der Test in Q4 spricht für `06 5x`.

---

## 7. Effekte

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

### 7.4 Effekt-Regler am Panel

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
| Booster | `60 00 06 5D` | `00` aus, `01` grün, `02` rot, `03` gelb | eigener Test, Q2 (Panel `5D`) | GETESTET (eigen) für `00`/`02` |
| MOD | `60 00 06 5E` | wie Booster | eigener Test, Q2 | GETESTET (eigen) für `01` |
| FX | `60 00 06 5F` | wie Booster | Q2 | QUELLEN |
| Delay 1 | `60 00 06 60` | wie Booster | eigener Test, Q2 | GETESTET (eigen) für `01` |
| Reverb/Delay 2 | `60 00 06 61` | wie Booster | eigener Test, Q2 | GETESTET (eigen) für `00`/`02` |

**Abweichung von Q2:** Q2 kennt nur `00` aus / `01` an. Am eigenen Amp melden die
Effekt-LEDs auch die Farbe: Booster und Reverb in Rot (Farbe `01`) melden `02`, das grüne
Delay und das grüne MOD melden `01`. Also LED = aus oder Farbe + 1. `03` = gelb ist daraus
abgeleitet: UNVERIFIZIERT. Die Variation-LED hat keine Farbe.

### 7.6 Effekt-Parameter pro Typ

Die Regler hinter jedem Effekttyp (z. B. Rate und Depth beim Tremolo). Die vollständige
Tabelle mit Wertebereichen steht im Code: [`src/lib/effect-params.js`](../src/lib/effect-params.js).
Hier die Übersicht.

**Quellen:**

- Adressen, Wertebereiche und Wertelisten: Q2 `midi.xml`, Abschnitt `<Structure>`
  Blöcke `00`, `01`/`02`, `05`.
- Welche Regler zu welchem Typ gehören: Q2 `stompbox_od.cpp`, `stompbox_fx1.cpp`,
  `stompbox_dd.cpp`, `stompbox_ce.cpp`, `stompbox_rv.cpp`.
- Gegenprobe: Q3 `params/booster.yaml`, `delay.yaml`, `reverb.yaml`, `params/modfx/*.yaml`.
  Alle Adressen, die Q3 nennt, stimmen mit Q2 überein.

**Status:**

- Alle Adressen in diesem Abschnitt haben den Status **QUELLEN**, sofern nicht anders
  angegeben.
- Am eigenen Amp gelesen und mit unverändertem Wert zurückgeschrieben (Abschnitt 10.5):
  MOD-Tremolo-Rate `02 14`, Delay-Zeit `05 02` (2 Byte) und Reverb-Zeit `05 42`. Diese drei
  sind **GETESTET (eigen)** für Lesen, Schreiben und Rücklesen.
- Ob die übrigen Werte am Amp hörbar wirken, ist noch offen (`device-test.md` Teil 5).

**Werteformate:**

| Format | Rohwert | Anzeige |
| --- | --- | --- |
| Prozent | `00`–`64` | 0–100 |
| ±50 | `00`–`64` | −50…+50 (`32` = 0) |
| dB | `00`–`28` | −20…+20 dB (EQ) |
| Halbtöne | `00`–`30` | −24…+24 (Pitch) |
| Level 120 | `00`–`78` | 0–120 (Booster Drive, Delay Effect Level) |
| 2 Byte | `hi lo`, Wert = hi × 128 + lo | Delay-Zeit 1–2000 ms, Dual-Zeiten 1–1000 ms, Reverb Pre Delay 0–500 ms, PS/HR Pre Delay 0–300 ms, DC-30 Repeat Rate 40–600 |
| Reverb-Zeit | `00`–`63` | 0.1–10.0 s (Rohwert + 1) / 10 |
| Liste | ab `00` fortlaufend | z. B. Low Cut: Flat, 20 Hz … 800 Hz (18 Werte); High Cut: 630 Hz … 12.5 kHz, Flat (15 Werte) |

**Booster** (`60 00 00 1x`, alle Typen gleich): Drive `12` (0–120), Bottom `13` (±50),
Tone `14` (±50), Solo `15`, Solo Level `16`, Effect Level `17`, Direct Mix `18`.
Die Custom-Parameter `19`–`1E` sind nicht im Editor, weil die Typliste keinen Custom-Typ
enthält.

**MOD** (`60 00 01 xx`/`02 xx`). **FX** ist derselbe Aufbau um `02 00` verschoben (`03 xx`/`04 xx`).

| Typ | Adressen | Regler |
| --- | --- | --- |
| `00` T.Wah | `01 02`–`08` | Mode, Polarity, Sens, Frequency, Peak, Direct Mix, Effect Level |
| `01` Auto Wah | `01 09`–`0F` | Mode, Frequency, Peak, Rate, Depth, Direct Mix, Effect Level |
| `02` Pedal Wah | `01 10`–`15` | Wah Type, Pedal Position/Min/Max, Effect Level, Direct Mix |
| `03` Compressor | `01 16`–`1A` | Comp Type, Sustain, Attack, Tone (±50), Effect Level |
| `04` Limiter | `01 1B`–`20` | Limiter Type, Attack, Threshold, Ratio (18 Werte), Release, Effect Level |
| `06` Graphic EQ | `01 21`–`2B` | 31 Hz … 16 kHz, Level (je ±20 dB) |
| `07` Para EQ | `01 2C`–`36` | Low Cut, Low Gain, Low-Mid Freq/Q/Gain, High-Mid Freq/Q/Gain, High Gain, High Cut, Level |
| `09` Guitar Sim | `01 37`–`3B` | Sim Type, Low, High, Level, Body |
| `0A` Slow Gear | `01 3C`–`3E` | Sens, Rise Time, Level |
| `0C` Wave Synth | `01 3F`–`46` | Wave, Cutoff, Resonance, Filter Sens/Decay/Depth, Synth Level, Direct Mix |
| `0E` Octave | `01 47`–`49` | Range, Octave Level, Direct Mix |
| `0F` Pitch Shifter | `01 4A`–`58` | Voice, PS1/PS2 Mode, Pitch, Fine, Pre Delay (2 Byte), Level, Feedback, Direct Mix |
| `10` Harmonist | `01 59`–`63` | Voice, HR1/HR2 Harmony, Pre Delay (2 Byte), Level, Feedback, Direct Mix. User-Skalen `01 64`–`7B` nicht im Editor |
| `12` AC Processor | `01 7C`–`02 02` | AC Type, Bass, Middle, Middle Freq, Treble, Presence, Level |
| `13` Phaser | `02 03`–`0A` | Type, Rate, Depth, Manual, Resonance, Step Rate (`00` Off, sonst Wert − 1), Effect Level, Direct Mix |
| `14` Flanger | `02 0B`–`12` | Rate, Depth, Manual, Resonance, Low Cut (`10`), Effect Level, Direct Mix (`0F` Separation laut Q2 nicht auf der Seite) |
| `15` Tremolo | `02 13`–`16` | Wave Shape, Rate, Depth, Level |
| `16` Rotary | `02 19`–`1D` | Rate, Rise Time, Fall Time, Depth, Level (`17` Speed und `18` Rate Slow zeigt Q2 nicht) |
| `17` Uni-V | `02 1E`–`20` | Rate, Depth, Level |
| `19` Slicer | `02 21`–`25` | Pattern P1–P20, Rate, Trigger Sens, Effect Level, Direct Mix |
| `1A` Vibrato | `02 26`, `27`, `2A` | Rate, Depth, Level |
| `1B` Ring Mod | `02 2B`–`2E` | Mode, Frequency, Effect Level, Direct Mix |
| `1C` Humanizer | `02 2F`–`36` | Mode, Vowel 1/2, Sens, Rate, Depth, Manual, Level |
| `1D` 2x2 Chorus | `02 37`–`40` | Xover Freq, Low/High Rate, Depth, Pre Delay (0–40 ms in 0.5er-Schritten), Level, Direct Mix |
| `1F` AC Guitar Sim | `02 41`–`45` | Top, Body, Low, High, Level |
| `23` Phaser 90E | `02 46`–`47` | Script, Speed |
| `24` Flanger 117E | `02 48`–`4B` | Manual, Width, Speed, Regen |
| `25` Wah 95E | `02 4C`–`50` | Pedal Position/Min/Max, Effect Level, Direct Mix |
| `26` Delay Chorus 30 | `02 51`–`59` | Selector, Input Volume, Chorus Intensity, Echo Repeat Rate (2 Byte), Echo Intensity, Echo Volume, Tone, Output |
| `27` Heavy Octave | `02 5A`–`5C` | −1 Oct, −2 Oct, Direct Mix |
| `28` Pedal Bend | `02 5D`–`60` | Pitch (±24), Pedal Position, Effect Level, Direct Mix |

**Delay 1** (`60 00 05 0x`/`1x`). **Delay 2** ist derselbe Aufbau um `20` verschoben (`05 2x`/`3x`).

| Adresse | Regler | Typen |
| --- | --- | --- |
| `05 02`–`03` | Time (2 Byte, 1–2000 ms) | alle außer Dual |
| `05 04` | Feedback | alle außer Dual |
| `05 05` | High Cut | Digital, Pan, Reverse, Analog, Tape Echo, Modulate |
| `05 06` | Effect Level (0–120) | alle außer Dual |
| `05 07` | Direct Mix | alle |
| `05 08` | Tap Time (%) | Pan |
| `05 09`–`0D` | D1 Time (2 Byte, 1–1000 ms), Feedback, High Cut, Effect Level | Dual Series/Parallel/L/R; D1 High Cut `05 0C` auch bei Stereo |
| `05 0E`–`12` | D2 Time, Feedback, High Cut, Effect Level | Dual |
| `05 13`–`14` | Mod Rate, Mod Depth | Modulate, SDE-3000 |
| `05 15`–`19` | Vintage LPF, Filter 8/17 kHz, Feedback Phase, Effect Phase, Modulation | SDE-3000 |

UNVERIFIZIERT: Bei Stereo nimmt Q2 für Delay 1 und Delay 2 den D1-High-Cut (`05 0C`/`05 2C`).
Bei Pan nimmt Q2 für Delay 1 `05 0C`, für Delay 2 aber `05 25`. Der Editor nutzt bei Pan
den normalen High Cut `05 05`/`05 25`. Das bleibt am Amp zu prüfen.

Delay 2 hat eigene Typ-Plätze pro Farbe (`06 33`/`34`/`35`, Q2 `midi.xml`, Panel-Block). Farbe,
LED und Regler teilt es mit dem Reverb (`06 3D`, `06 61`, `06 5B`). Was der Reverb-Regler
steuert, steht pro Farbe in `06 36`–`38` (7.3).

**Reverb** (`60 00 05 4x`, alle Typen gleich):

| Adresse | Regler |
| --- | --- |
| `05 42` | Time (0.1–10.0 s) |
| `05 43`–`44` | Pre Delay (2 Byte, 0–500 ms) |
| `05 45` | Low Cut |
| `05 46` | High Cut |
| `05 47` | Density (0–10) |
| `05 48` | Effect Level |
| `05 49` | Direct Mix |
| `05 4B` | Spring Color (nur Typ Spring) |

Der Editor zeigt außerdem den **Effekt-Regler am Panel** (7.4). Nach dem Schreiben liest er
den ganzen Effektblock zurück, weil der Amp den Hauptparameter des Typs mitverstellt.

### 7.7 Weitere Patch-Parameter (für Presets)

Diese Werte gehören zum Patch und hängen nicht an einem Effekt. katana-helper nutzt sie für
das Preset-Format (`docs/preset-guide.md`, `src/lib/preset.js`). Im Editor gibt es dafür
noch keine Regler.

| Adresse | Parameter | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| `60 00 05 66` | Noise Suppressor an/aus | `00`/`01` | Q2 `midi.xml:43022`, Q4 `KatanaAddresses.kt:1152` (aus Q2 übernommen) | gelesen (10.7), UNVERIFIZIERT |
| `60 00 05 67`, `68` | Noise Suppressor Threshold, Release | 0–100 | Q2 `midi.xml:43026`, `:43029` | gelesen, UNVERIFIZIERT |
| `60 00 05 70` | Patch Level | 0–100 | Q2 `midi.xml:43039` („Master: Patch Level“) | gelesen (`64` = 100), UNVERIFIZIERT |
| `60 00 00 40` | EQ 1 an/aus | `00`/`01` | Q2 `midi.xml:37562` | gelesen, UNVERIFIZIERT |
| `60 00 00 41` | EQ 1 Art | `00` Parametric, `01` Graphic | Q2 `midi.xml:37562ff.` | gelesen, UNVERIFIZIERT |
| `60 00 00 42`–`4C` | EQ 1 parametrisch: Low Cut, Low Gain, Low-Mid Freq/Q/Gain, High-Mid Freq/Q/Gain, High Gain, High Cut, Level | Listen wie MOD Para EQ (7.6), Gains ±20 dB | Q2 `midi.xml:37570ff.` | gelesen, UNVERIFIZIERT |
| `60 00 00 4D`–`57` | EQ 1 grafisch: 31 Hz … 16 kHz, Level | `00`–`30` = −12 … +12 dB in **0,5-dB-Schritten** (anders als der Graphic EQ in MOD/FX) | Q2 `midi.xml:37698–37728` | gelesen, UNVERIFIZIERT |
| `60 00 00 60`–`77` | EQ 2, gleicher Aufbau wie EQ 1 | wie EQ 1 | Q2 `midi.xml:37739–37905`, Q3 `presets_addrs.yaml` (`UserPatch%Eq(2)`, Größe 24) | gelesen, UNVERIFIZIERT |
| `60 00 06 22` | Position EQ 1 | `00` Amp In, `01` Amp Out | Q2 `midi.xml:43559`, Q4 | gelesen, UNVERIFIZIERT |
| `60 00 06 19` | Position EQ 2 | `00` Amp In, `01` Amp Out (Q2: „PreAmp In/Pre Amp Out“) | Q2 `midi.xml:43540`, Q4 | gelesen, UNVERIFIZIERT |
| `60 00 06 16` | Contour an/aus | `00`/`01` | Q2 `midi.xml:43521`, Q4 `KatanaAddresses.kt:1161` | gelesen, UNVERIFIZIERT |
| `60 00 06 17` | Contour-Auswahl | `00`–`02` = Contour 1–3 | Q2 `midi.xml:43525` | gelesen, UNVERIFIZIERT |
| `60 00 06 43` | Cab Resonance | `00` Vintage, `01` Modern, `02` Deep | Q2 `midi.xml:44045`, `stompbox_cab.cpp:87` | gelesen (`00`), UNVERIFIZIERT |

**Gegenprobe über Standardwerte:** Q2 nennt für einige Parameter im Attribut `abbr` einen
Startwert. Für EQ 1 und EQ 2 sind das Lo-Mid Freq `0E` (500 Hz), Hi-Mid Freq `17` (4 kHz),
Q `01` (1) und Gains `14` (0 dB). Genau diese Werte stehen am eigenen Amp an diesen
Adressen (10.7). Die Adressen sind damit sehr wahrscheinlich richtig. Ob die Werte so
klingen wie benannt, ist offen (`device-test.md` Teil 8).

**Nicht im Preset-Format, weil unklar oder zu riskant:**

- Kette `60 00 06 00`–`13` (Reihenfolge der 20 Blöcke) und `06 20` (vordefinierte Ketten),
  Q2 `midi.xml:43074`, `:43552`.
- Pedal FX `60 00 05 50`–`61`, Send/Return `05 62`–`65` (Q2 `midi.xml:42946`, `:43008`).
- Solo des Amps: zwei Kandidaten, `60 00 00 2B`/`2C` (Preamp) und `60 00 06 14`/`15` (Panel).
  Q4 hat `00 2B` am Amp getestet, ohne hörbare Wirkung. Der Booster hat ein eigenes Solo
  (`00 15`/`16`, 7.6).
- Contour-Feinwerte `60 00 0F 30`ff. und Freq Shift `06 1A`. Sie liegen außerhalb des
  Patch-Dumps bzw. gelten nur für die aktive Kontur (Q4 `BACKLOG.md`).
- Preamp-Parameter `00 29`–`3F` (Bright, Gain SW, Custom-Amp). Q2 nennt sie, am MkII-Panel
  gibt es sie nicht.

**Schreibreihenfolge beim Laden eines Patches oder Presets:** zuerst der Panel-Block
`60 00 06 xx`, danach alles andere in aufsteigender Reihenfolge (`patchWrites` in
`src/lib/patch.js`). Der Amp leitet aus Panel-Werten andere Werte ab: Der AMP-TYPE-Schalter
setzt `00 21`, ein Effektregler verstellt den Hauptparameter (7.4). So gelten am Ende die
Detailwerte des Patches. Mit unveränderten Werten am Amp geprüft (10.7).

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

### 10.3 Mac, zweiter Log und erste Schreibbefehle, 2026-11-01

Zweiter Log (Diagnose-Seite, 12:19–12:21):

| Aktion am Amp | Meldungen |
| --- | --- |
| BASS drehen | `00 24` und `06 53` abwechselnd, gleiche Werte |
| MIDDLE drehen | `00 25` und `06 54`, gleiche Werte |
| GAIN drehen (Crunch) | `00 22` und `06 51`, `00 22` ≈ 0,8 × `06 51` + 20 |
| AMP TYPE Crunch → Clean → Acoustic | erst `06 50` (Schalter), dann `00 21` (Modell): Clean → `08`, Acoustic → `01` |

**Antwort auf eine offene Frage:** Am Drehschalter setzt der Amp das Amp-Modell `00 21`
selbst auf das passende Panel-Modell. Ob das auch beim **Schreiben** von `06 50` passiert,
liest der Editor nach jedem Schreiben zurück; Ergebnis folgt mit Martins Test.

Erste Schreibbefehle aus dem Editor (unsichtbare Chrome-Instanz, unveränderte Werte, damit
sich am Klang nichts ändert): `60 00 06 51` (Gain), `60 00 00 21` (Amp-Modell) und
`60 00 00 11` (Booster-Typ) mit dem jeweils eingestellten Wert geschrieben. Das Rücklesen
bestätigte alle drei. Der Amp antwortet auf DT1 nicht von sich aus.

### 10.4 Phase 3: gespeicherte Kanäle und ganze Patches, 2026-11-01

Unsichtbare Chrome-Instanz, Mac, Amp im Panel-Kanal:

- `RQ1 10 0n 00 00` mit Größe 1992 für n = 0…8: jeweils 9 Nachrichten, 1932 Byte, Name am
  Anfang. Martins Kanäle: Panel „muur zusamstra?e“, A1 „MUUR Main“, A2 „MUUR Main FXLoop“,
  A3 „Mono“, A4 „Blackout“, B1 „Lifer“, B2 „ethereal“, B3 „banjo“, B4 „Princeton“.
- Temporärer Patch gegen gespeicherten Panel-Patch (`10 00 …`): nur 1 Byte verschieden,
  `06 5E` (MOD-LED, Live-Zustand).
- **Ganzen Patch schreiben:** Den eben gelesenen Klang (unverändert) als 10 DT1-Nachrichten
  zurückgeschrieben: höchstens 241 Byte je Nachricht, 20 ms Pause, LED-Bytes ausgelassen.
  Danach den ganzen Patch zurückgelesen: keine Abweichung. Status: GETESTET (eigen).
- Speichern in einen Kanal wurde nicht getestet (`docs/device-test.md` Teil 4).

### 10.5 Effekt-Parameter, 2026-11-01

Unsichtbare Chrome-Instanz, Mac, Amp im Panel-Kanal, alle Effekte aus:

- Ganzer Patch gelesen, alle Detail-Regler angezeigt. Die Werte sind plausibel, z. B.
  Booster Blues Drive: Drive 11, Bottom +33, Effect Level 75. MOD Tremolo: Wave Shape 50,
  Rate 30, Depth 65, Level 50. Delay Reverse: 245 ms. Reverb Hall 2: 10.0 s. Delay 2
  Tape Echo: 400 ms.
- Die Panel-Regler `06 57`–`06 5B` stehen bei ausgeschalteten Effekten auf `00`. Das passt zu
  7.4 (`00` = aus).
- Mit unverändertem Wert geschrieben und zurückgelesen: MOD Tremolo Rate `02 14` = 30,
  Delay Time `05 02 01 75` = 245 ms (2 Byte), Reverb Time `05 42` = `63` (10.0 s). Alle drei
  hat der Amp bestätigt. Danach meldete der Editor „Keine Änderungen“.
- Hörbare Änderungen sind noch nicht getestet (`device-test.md` Teil 5).

### 10.6 System-Bereich und Air Feel, 2026-11-01

Unsichtbare Chrome-Instanz, Mac, Web MIDI. Nur gelesen, dazu ein Schreibbefehl mit dem schon
eingestellten Wert:

- `RQ1 00 00 00 29`, Größe 1, **ohne** Edit-Mode: Antwort
  `F0 41 00 00 00 00 33 12 00 00 00 29 00 57 F7` → `00` = REC. Mit Edit-Mode gleich. Lesen
  braucht den Edit-Mode also nicht.
- `RQ1 00 00 00 00`, Größe `30`: 48 Byte, eine Antwort.
  `00 14 32 19 01 00 00 32 | 00 × 8 | 01 00 01 08 14 08 02 16 17 01 14 14 0E 14 | 18 × 11 | 00 00 00 00 14 02 04`.
  Das passt zum Aufbau in Q2: USB-Pegel bei 0 dB / 100 % (`14`, `32`), Global EQ an (`10` = `01`),
  alle GEQ-Bänder 0 dB (`18`), Power-Amp-In-Level 0 dB (`2D` = `14`), EQ3 gewählt (`2E` = `02`),
  Power Control „Half“ (`2F` = `04`). Die MkI-Adressen aus Q1 (USB bei `00 00 00 51`–`57`)
  gelten für den MkII also **nicht**.
- `RQ1 00 00 01 10`, Größe `0B`: `00 00 04 0A 04 64 0A 00 02 0A 04` → Line Out Custom aus,
  MIC 1 gewählt, MIC 1 = RBN121 (`04`), 10 cm, 4 cm; MIC 2 = CND451 (`02`), 10 cm, 4 cm.
  `01 15`–`01 17` (`64 0A 00`) sind in Q2 nicht benannt.
- `DT1 00 00 00 29 00` (REC, unverändert), ohne Edit-Mode, nach 300 ms zurückgelesen: `00`.
  Der Amp nimmt den Befehl an und meldet nichts zurück, wie bei Patch-Adressen.
- Nicht getestet: andere Werte schreiben, Klang, Verhalten nach Aus- und Einschalten
  (`device-test.md` Teil 7).

### 10.7 Presets: Rundweg und Schreibreihenfolge, 2026-11-01

Unsichtbare Chrome-Instanz, Mac, Panel-Kanal (Deluxe Crunch, alle Effekte aus):

- Ganzen Patch gelesen, in ein Preset umgewandelt (`patchToPreset`) und zurück in Bytes
  (`presetToPatch`). Ergebnis: 122 Bytes, **0 Abweichungen** zum Amp, 0 Hinweise.
- Gelesene Werte der neuen Adressen (7.7): Noise Suppressor aus, Threshold 5, Release 50.
  EQ 1 und EQ 2 aus, parametrisch, 500 Hz / 4 kHz, Q 1, alle Gains 0 dB. Position EQ 1 Amp
  In, EQ 2 Amp Out. Contour aus, 1. Cab Resonance Vintage. Patch Level 100.
- Diese 122 Bytes mit unveränderten Werten zurückgeschrieben, Panel-Block zuerst (26
  Nachrichten, die erste an `60 00 06 16`). Der Amp hat alles bestätigt („geladen und
  bestätigt“, keine Abweichung, Editor „Keine Änderungen“).
- Nicht getestet: geänderte Werte, Klang (`device-test.md` Teil 8).

## 11. Offene Punkte

Die Checkliste für den Gerätetest und alle offenen Protokollfragen stehen jetzt in
[`device-test.md`](device-test.md).

---

## 12. System-Parameter

Globale Einstellungen. In BOSS Tone Studio stehen sie im SYSTEM-Tab (neben Cab Sim/Line Out
und Global EQ). Sie gelten für alle Kanäle und gehören zu keinem Patch. Darum fehlen sie
in Patch-Backups und in der Bibliothek.

### 12.1 Adressraum, Speichern, Edit-Mode

| Frage | Antwort | Quelle | Status |
| --- | --- | --- | --- |
| Eigener Adressraum? | Ja. System = `00 00 xx xx`. Q2 bildet die Adresse als `00` + Bereich + Seite + Offset; das Air-Feel-Feld `"00", "00", "29"` wird zu `00 00 00 29`. Patches liegen woanders (`60 00 …` temporär, `10 0n …` gespeichert). | Q2 `MidiTable.cpp:581–612` (`dataChange`, Zweig `System`), `midi.xml:48` `<System>` | GETESTET (eigen), 10.6 |
| Lesen | Normales RQ1. Q2 liest den System-Bereich als `RQ1 00 00 00 00`, Größe `00 02 00 1D` (`globalVariables.h:66`). Wir lesen nur die einzelnen Bytes. | Q2, eigener Test | GETESTET (eigen) |
| Schreiben | Normales DT1, ohne eigenen Speicherbefehl. Q2 schickt System-Werte nur als DT1 (`SysxIO.cpp:1095–1112` `systemWrite`, Einzelwerte über `dataChange`) und nennt das „replace the SYSTEM DATA currently stored in the KATANA“ (`mainWindow.cpp:768`). Der Speicherbefehl `7F 00 01 04` gilt nur für Patches. | Q2 | **UNVERIFIZIERT** (nur Q2) |
| Bleibt die Einstellung nach dem Ausschalten? | Laut Q2 ja, weil der Wert sofort im Amp gespeichert wird. Nicht geprüft. | Q2 | **UNVERIFIZIERT** → `device-test.md` Teil 7 |
| Edit-Mode nötig? | Zum Lesen nein (10.6). Ein Schreiben ohne Edit-Mode nahm der Amp an (unveränderter Wert). Ob ein *anderer* Wert ohne Edit-Mode wirkt, ist offen. Die App ist sowieso immer im Edit-Mode. | eigener Test | Lesen GETESTET (eigen), Schreiben UNVERIFIZIERT |

### 12.2 Line Out Air Feel

| Adresse | Größe | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| `00 00 00 29` | 1 | `00` = REC, `01` = LIVE, `02` = BLEND | Q2 `midi.xml:262–266` („Output: Line Out Mode“ mit Record, Live, Blend), `stompbox_cab.cpp:86–91` (Gruppe „Line Output“) | Adresse und Lesen: **GETESTET (eigen)** (10.6). Zuordnung der Werte und Wirkung: **UNVERIFIZIERT** (nur Q2) → `device-test.md` Teil 7 |

- Wirkt nur auf LINE OUT, PHONES/REC OUT und USB-Audio, nicht auf den Lautsprecher (Q6).
- REC = nah mikrofoniert wie bei einer Aufnahme, LIVE = Amp im Raum, BLEND = Mischung aus beiden.
- Ist Line Out Custom an (12.3), gilt die Custom-Einstellung. Q2 graut den Air-Feel-Schalter
  dann aus (`stompbox_cab.cpp:89`, `customSystemOverride.cpp`: Overlay, solange
  `00 00 01 10` ≥ `01`).

Nachrichten (Checksumme = (128 − Summe aus Adresse und Daten mod 128) mod 128). Die
Vitest-Tests in `src/lib/system.test.js` prüfen genau diese Bytes:

| Zweck | Nachricht |
| --- | --- |
| Lesen | `F0 41 00 00 00 00 33 11 00 00 00 29 00 00 00 01 56 F7` |
| REC setzen | `F0 41 00 00 00 00 33 12 00 00 00 29 00 57 F7` |
| LIVE setzen | `F0 41 00 00 00 00 33 12 00 00 00 29 01 56 F7` |
| BLEND setzen | `F0 41 00 00 00 00 33 12 00 00 00 29 02 55 F7` |
| Antwort bei REC (gemessen) | `F0 41 00 00 00 00 33 12 00 00 00 29 00 57 F7` |

### 12.3 Line Out Custom (ab Katana MkII Version 2)

Version 2 (2022) erweitert die Line-Out-Simulation um wählbare virtuelle Mikrofone mit
Position (Q6). In Q2 heißt der Bereich „Custom Mic“, Seite 2 des Systembereichs. Zwei
Einstellungen (MIC 1, MIC 2), eine davon aktiv. Beim Katana-Artist MkII entspricht das dem
Schalter CUSTOM SETTING OFF/M1/M2 (Q6).

| Adresse | Parameter | Werte | Quelle | Status |
| --- | --- | --- | --- | --- |
| `00 00 01 10` | Line Out Custom an/aus | `00` aus, `01` an | Q2 `midi.xml:839`, `stompbox_cab.cpp:99` | gelesen (10.6), sonst UNVERIFIZIERT |
| `00 00 01 11` | Auswahl | `00` MIC 1, `01` MIC 2 | Q2 `midi.xml:843` | gelesen, UNVERIFIZIERT |
| `00 00 01 12` | MIC 1 Typ | `00` DYN57, `01` DYN421, `02` CND451, `03` CND87, `04` RBN121 | Q2 `midi.xml:847` | gelesen, UNVERIFIZIERT |
| `00 00 01 13` | MIC 1 Abstand | `00`–`14` = 0–20 cm | Q2 `midi.xml:854` | gelesen, UNVERIFIZIERT |
| `00 00 01 14` | MIC 1 Position | `00`–`0A` = 0–10 cm (von der Mitte) | Q2 `midi.xml:857` | gelesen, UNVERIFIZIERT |
| `00 00 01 15`–`17` | ? | gelesen `64 0A 00`, in Q2 nicht benannt. Möglicherweise „Ambience“ (Version 2 nennt Mic Type/Mic Position/Ambience), nicht belegt. | – | UNBEKANNT |
| `00 00 01 18` | MIC 2 Typ | wie MIC 1 | Q2 `midi.xml:863` | gelesen, UNVERIFIZIERT |
| `00 00 01 19` | MIC 2 Abstand | wie MIC 1 | Q2 `midi.xml:870` | gelesen, UNVERIFIZIERT |
| `00 00 01 1A` | MIC 2 Position | wie MIC 1 | Q2 `midi.xml:873` | gelesen, UNVERIFIZIERT |

katana-helper liest nur `00 00 01 10`, um einen Hinweis zu zeigen, wenn Custom an ist. Die
Custom-Regler sind noch nicht im Editor.

### 12.4 Weitere System-Werte (Auszug, nicht im Editor)

| Adresse | Parameter | Quelle |
| --- | --- | --- |
| `00 00 00 00`–`07` | USB: In/Out Mode, To Effect Level, Effect Out Level, Mix Level, Direct Monitor, Direct Monitor CMD, Loopback, Dry Output Level | Q2 `midi.xml:51–79` |
| `00 00 00 10` | Global EQ an/aus | Q2 `midi.xml:87`, `menuPage_system.cpp:49` |
| `00 00 00 11`–`28` | Global EQ (Art, Position, PEQ, GEQ) | Q2 `midi.xml:91–261` |
| `00 00 00 2E` | Global EQ 1–3 (grün/rot/gelb) | Q2 `midi.xml:284` |
| `00 00 00 2F` | Power Control (10 %–90 %, Half) | Q2 `midi.xml:289` |

Status: UNVERIFIZIERT (nur Q2). Die gelesenen Werte (10.6) sind plausibel.

Keine Treffer zu Air Feel, Line Out oder System-Adressen in Q3 (TuxKatana) und Q4
(ktnacontrol); Q4 erwähnt „Line Out Only“ nur als Position des Global EQ. Q1 beschreibt den
MkI mit anderen Offsets (10.6). katana-rs enthält eine Kopie von Q2 `midi.xml` und zählt
nicht als eigene Quelle.
