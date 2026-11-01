# Presets für den BOSS Katana-100 MkII mit Claude oder ChatGPT

Diese Datei ist die Arbeitsgrundlage für ein Sprachmodell (Claude, ChatGPT o. Ä.), das
für katana-helper einen Klang („Preset“) entwirft. Sie enthält alles, was über den Amp
bekannt ist: Amp-Modelle und ihre Vorbilder, Effekte mit allen Reglern und Wertebereichen,
das Ausgabeformat und ein vollständiges Beispiel.

Stand: 2026-11-01, katana-helper ab Version 0.7.0.

---

## Teil A – Für dich: So benutzt du diese Datei

1. **Datei an das Modell geben.** In Claude oder ChatGPT diese Datei hochladen (oder in ein
   Projekt bzw. einen eigenen GPT als Wissen legen).
2. **Wunsch formulieren**, zum Beispiel:

   > Erstelle einen Gitarrensound wie das Solo von Metallica auf „Master of Puppets“.
   > Gitarre: Humbucker. Ich spiele über den Lautsprecher, Zimmerlautstärke.

   Hilfreich sind Angaben zu Gitarre (Humbucker/Single Coil), Lautstärke, Lautsprecher
   oder Kopfhörer/Aufnahme, und ob ein Expression-Pedal da ist.
3. **Antwort übernehmen.** Das Modell antwortet mit einem JSON-Block. Den ganzen Block
   kopieren (auch mit ```json-Rahmen).
4. **In katana-helper einfügen.** Bereich **Patches → Bibliothek → „Preset einfügen …“**,
   einfügen, **„In Bibliothek übernehmen“**. Fehler im JSON zeigt der Dialog sofort an;
   dann die Fehlermeldung an das Modell zurückgeben.
5. **Anhören.** Beim neuen Eintrag **„Laden“**. Das schreibt das Preset in den aktuellen
   Klang, **nichts wird gespeichert**. „Änderungen zurücknehmen“ stellt den alten Klang
   wieder her.
6. **Feinschliff.** Im Editor nachregeln oder dem Modell sagen, was nicht passt („zu
   matschig“, „mehr Sustain“). Um ihm den aktuellen Stand zu zeigen: **„Klang als Preset“**
   speichert den Klang als JSON-Datei, die du dem Modell wieder gibst.
7. **Speichern.** Beim Eintrag **„In Kanal …“** (oder im Editor „Speichern …“ beim Kanal).
   katana-helper sichert den Zielkanal vorher automatisch in die Bibliothek.

Die Bibliothek liegt im Browser (IndexedDB) und gehört zum jeweiligen Browser und zur
Adresse der App. „Alle exportieren“ sichert sie als Datei.

---

## Teil B – Auftrag an das Modell

Du entwirfst Klänge für einen **BOSS Katana-100 MkII** (Gitarren-Modeling-Amp, 100 W,
12-Zoll-Lautsprecher, Firmware Version 2). Der Nutzer lädt deine Antwort in die Web-App
katana-helper, die sie in Roland-SysEx übersetzt und an den Amp schickt.

**Antworte immer so:**

1. Zwei bis fünf Sätze: Welches Original-Equipment du annimmst (Gitarre, Amp, Pedale,
   Studio) und wie du es auf den Katana überträgst. Kennzeichne, was du sicher weißt und
   was du schätzt.
2. **Genau ein** JSON-Codeblock (```json) im Format `katana-helper-preset` (Teil E).
   Mehrere Varianten nur auf Wunsch, dann als JSON-Array in einem Block.
3. Danach höchstens fünf Stichpunkte: welche Regler der Nutzer zuerst nachstellen sollte
   und warum (z. B. „Gain zuerst, wenn es zu sehr zerrt“).

**Regeln für das JSON:**

- Verwende **nur** Namen und Wertebereiche aus der Referenz (Teil G). Erfinde keine Typen,
  Regler oder Abschnitte. Groß-/Kleinschreibung ist egal.
- Werte so angeben, wie sie in BOSS Tone Studio angezeigt werden: Zahlen in der Einheit der
  Referenz (z. B. `-50 … +50`, `ms`, `s`, `dB`), Listenwerte als Text (z. B. `"4 kHz"`).
- Für jeden eingeschalteten Effekt **alle** Regler seines Typs angeben. Fehlende Regler
  behalten sonst den Wert aus dem Klang, der gerade im Amp ist, und das Ergebnis wird
  zufällig.
- Effekte, die du nicht brauchst, weglassen oder mit `"on": false` angeben. Fehlende
  Effektblöcke schaltet katana-helper aus.
- `name`: höchstens 16 Zeichen, nur ASCII (keine Umlaute, kein ß).
- Keine Kommentare im JSON.

---

## Teil C – Der Katana-100 MkII in Kürze

### Aufbau und Signalweg

- **Booster** (Overdrive/Distortion/Boost) → **Amp** (Preamp mit Gain, Bass, Middle,
  Treble, Presence, Volume) → **MOD** und **FX** (gleiche Effektliste) → **Delay** und
  **Delay 2** → **Reverb**. Dazu **Noise Suppressor**, zwei **EQs** (EQ 1, EQ 2) und
  **Contour**.
- Die genaue Reihenfolge der Blöcke („Kette“) speichert jeder Kanal selbst. Ein Preset
  ändert sie **nicht**. In der Regel liegt der Booster vor dem Amp, Delay und Reverb liegen
  dahinter. Ob MOD/FX vor oder hinter dem Amp liegen, ist nicht festgelegt. Plane deshalb
  so, dass der Klang in beiden Fällen funktioniert, und nenne es, wenn die Position wichtig
  ist (z. B. Wah oder Kompressor vor dem Amp).
- Am Panel hat jeder Effekt (Booster, MOD, FX, Delay, Reverb) einen **Regler** und einen
  **Farbtaster** mit drei Speicherplätzen **Grün/Rot/Gelb**. Jede Farbe kann einen anderen
  Typ halten. Das Preset setzt den Typ in die gewählte Farbe (`color`, Standard grün).
- **Delay 2** hat keinen eigenen Regler und keine eigene Farbe. Es teilt sich beides mit dem
  Reverb. `reverb.knobControls` legt fest, ob der Reverb-Regler Delay 2, beides oder nur
  den Reverb steuert. Lässt du es weg, wählt katana-helper passend: nur Reverb an →
  `Reverb`, nur Delay 2 an → `Delay`, beide an → `Delay+Reverb`.
- **Effektregler (`knob`, 0 … 100):** die Stellung des Reglers am Amp. Laut Messung verstellt
  der Amp beim Drehen den Hauptparameter des Effekts mit (z. B. Tremolo-Rate).
  katana-helper schreibt die Panel-Werte zuerst und die Detailregler danach, damit deine
  Detailwerte gelten. Standard: 50.
- **Variation:** Jeder der fünf Amp-Typen hat eine Variation (`Variation Clean` usw.).
  Laut Reviews klingen sie so: Clean wird heller und „amerikanischer“, Crunch geht vom
  Plexi-Charakter Richtung JCM800, Lead wird straffer und moderner, Brown geht Richtung
  5150.
- **Weitere Modelle:** Über SysEx sind 20 weitere Amp-Modelle erreichbar, die das Panel
  nicht anbietet. Es sind ältere COSM-Modelle aus dem BOSS GT-100. Sie funktionieren laut
  Community, BOSS dokumentiert sie für den Katana aber nicht. Sie eignen sich gut, wenn ein
  bestimmter Amp gefragt ist (Tabelle D.1).
- **Global, nicht im Preset:** Line Out Air Feel (REC/LIVE/BLEND, nur Line Out,
  Kopfhörer, USB), Global EQ, Power Control (Leistung). Das stellt der Nutzer im Editor
  unter „System (global)“ bzw. am Amp ein. Wenn es für den Sound wichtig ist, sag es dazu
  (z. B. „für Aufnahme über USB Air Feel auf REC“).
- **Nicht über Presets einstellbar:** Kette, Pedal FX (Expression-Pedal-Wah), Send/Return,
  Knopf-Zuweisungen, Contour-Feinwerte, die Solo-Funktion des Amps. Für einen Solo-Boost
  nutze den Booster (Regler `Solo`/`Solo Level`) oder einen eigenen Kanal mit mehr Volume.

### Was die Regler ungefähr bewirken

- **Gain (Amp):** Verzerrung des Preamps. Clean-Modelle bleiben bis etwa 40–50 sauber.
  High-Gain-Modelle sind ab 50 sehr stark verzerrt.
- **Bass/Middle/Treble/Presence:** Klangregelung. Presence betont die obersten Höhen.
  50 ist neutral.
- **Volume (Amp):** Lautstärke des Kanals. Für einen Solo-Klang etwas mehr als für den
  Rhythmus-Klang.
- **Booster Drive/Effect Level:** Wenig Drive und hoher Effect Level vor einem verzerrten
  Amp ergibt den klassischen „Tube Screamer vor dem Amp“: straffer, mehr Mitten, mehr
  Sustain. Viel Drive heißt, das Pedal selbst zerrt.
- **Booster Bottom/Tone:** −50 … +50, 0 = neutral.
- **Delay Effect Level** (0 … 120) und **Reverb Effect Level** (0 … 100): Anteil des
  Effekts. Für Soli im Bandkontext sind 10–25 typisch, für Ambient-Klänge 40–70.
- **Direct Mix:** Anteil des trockenen Signals. Bei Delay und Reverb fast immer 100.
- **Noise Suppressor:** Threshold höher = schließt früher. Bei High Gain 30–50,
  Release 20–40.
- **Cab Resonance:** Vintage, Modern oder Deep. Nach dem Namen die Resonanz des Gehäuses
  (Deep vermutlich mit mehr Bass). BOSS beschreibt die Stufen nicht genauer.
- **Contour 1–3:** Voreingestellte Klangkurven, seit Katana Version 2. Nur mit
  `on: true` wirksam. Was die drei Kurven genau tun, ist nicht dokumentiert. Im Zweifel
  weglassen.
- **Patch Level:** Gesamtlautstärke des Patches. Weglassen lässt sie unverändert.

---

## Teil D – Vorbilder der Modelle und Effekte

Wofür steht welcher Name? So kannst du echtes Equipment auf den Katana übertragen.
**Quelle Roland:** *BOSS GT-100 Training Guide* (Roland, offiziell). Der Katana nutzt
dieselben Modellnamen wie der GT-100. **Abgeleitet** heißt: Name und Beschreibung passen,
BOSS bestätigt das Vorbild für den Katana aber nicht.

### D.1 Amp-Modelle (`amp.model`)

| Modell | Vorbild / Charakter | Quelle |
| --- | --- | --- |
| Acoustic (Panel) | sehr sauber, neutral, für Akustik-Gitarre mit Tonabnehmer | BOSS (Produktbeschreibung) |
| Clean (Panel) | BOSS-eigener Clean-Sound („Tube Logic“) | BOSS |
| Crunch (Panel) | BOSS-eigener Crunch, Plexi-Charakter | BOSS, Review |
| Lead (Panel) | BOSS-eigener Lead-Sound | BOSS |
| Brown (Panel) | High Gain, an den „Brown Sound“ (Eddie Van Halen) angelehnt | Review |
| Variation Acoustic … Variation Brown | Varianten der fünf Panel-Typen (Teil C) | Review |
| Natural Clean | BOSS-eigenes Modell, möglichst wenig Eigenfärbung | Roland |
| Clean Twin | Fender Twin Reverb | Roland |
| Combo Crunch | BOSS-eigenes Modell, Crunch mit feiner Anschlagsdynamik | Roland |
| Pro Crunch | Fender Pro Reverb | Roland |
| Deluxe Crunch | Fender Deluxe Reverb | Roland |
| Stack Crunch | BOSS-eigenes Modell, Crunch mit 4x12-Charakter | Roland |
| VO Drive | Vox AC30TB, Drive-Sound | Roland |
| BG Drive | MESA/Boogie mit Treble Shift (späte 70er/80er) | Roland |
| Match Drive | Matchless DC-30, linker Eingang | Roland |
| Power Drive | BOSS-eigenes Modell, vielseitiger Drive für Rhythmus und Lead | Roland |
| VO Lead | Vox AC30TB, Lead-Sound | Roland |
| BG Lead | MESA/Boogie (Mark IIb), Lead-Kanal | Roland |
| Extreme Lead | BOSS-eigenes Modell, ausgeglichener High-Gain-Lead | Roland |
| T-Amp Lead | Hughes & Kettner Triamp, Amp 3 | Roland |
| MS-1959 I | Marshall 1959 Super Lead („Plexi“), Eingang I | Roland |
| MS-1959 I+II | Marshall 1959, Eingänge I und II gebrückt (mehr Bass) | Roland |
| HiGain Stack | BOSS-eigenes Modell, modifizierter Vintage-Marshall | Roland |
| R-Fier Vintage | MESA/Boogie Dual Rectifier, Kanal 2, Vintage-Modus | Roland |
| R-Fier Modern | MESA/Boogie Dual Rectifier, Kanal 2, Modern-Modus | Roland |
| Core Metal | BOSS-eigenes Modell, großer Metal-Stack | Roland |

### D.2 Booster (`booster.type`)

| Typ | Vorbild | Quelle |
| --- | --- | --- |
| Mid Boost | BOSS FB-2, Mid-Einstellung (Mitten, für Soli) | Roland |
| Clean Boost | BOSS FB-2 | Roland |
| Treble Boost | BOSS FB-2 mit angehobenen Höhen | Roland |
| Crunch OD, Natural OD, Warm OD | BOSS-eigene Overdrives | Roland |
| Fat DS, Metal DS | BOSS-eigene Distortions | Roland |
| OCT Fuzz | Ace Tone (Acetone) Fuzz, Oktav-Fuzz | Roland |
| Blues Drive | BOSS BD-2 | Roland (GT-100: „Blues OD“) |
| Overdrive | BOSS OD-1 | abgeleitet (GT-100: „OD-1“) |
| Tubescreamer | Ibanez TS-808 Tube Screamer | Roland (GT-100: „T-Scream“) |
| Turbo OD | BOSS OD-2 mit Turbo | Roland |
| Distortion | BOSS DS-1 | Roland (GT-100: „Dist“) |
| Rat | ProCo RAT (großes Gehäuse) | Roland |
| GuV DS | Marshall Guv'nor | Roland |
| DST+ | MXR Distortion+ | Roland |
| Metal Zone | BOSS MT-2 | Roland |
| '60s Fuzz | Arbiter Fuzz Face | Roland |
| Muff Fuzz | Electro-Harmonix Big Muff | Roland |
| HM-2 | BOSS HM-2 Heavy Metal (schwedischer Death-Metal-Sound) | abgeleitet (Name) |
| Metal Core | BOSS ML-2 Metal Core | abgeleitet (Name) |
| Centa OD | „Klon“-artiger Transparent-Overdrive (Klon Centaur), seit Katana Version 2 | abgeleitet (Name, BOSS-Pressemitteilung) |

### D.3 MOD und FX (`mod.type`, `fx.type`)

| Typ | Vorbild / Zweck | Quelle |
| --- | --- | --- |
| T.Wah, Auto Wah | BOSS AW-3 (Anschlags- bzw. automatisches Wah) | Roland |
| Pedal Wah | Wah mit fester Pedalstellung. `Wah Type`: Cry Wah = Dunlop Cry Baby, VO Wah = Vox V846, Fat Wah = Morley, Light/7String/Reso Wah = BOSS-eigen | Roland |
| Compressor | `Comp Type`: BOSS Comp = BOSS CS-3, D-Comp = MXR Dyna Comp, Orange = Dan Armstrong Orange Squeezer, Hi-Band/Light/Fat/Mild = BOSS-eigen | Roland |
| Limiter | `Limiter Type`: BOSS Limiter, Rack 160D = dbx 160X, Vtg Rack U = Urei 1178 (Stereo-Version des 1176) | Roland |
| Graphic EQ | 10-Band-EQ (GT-100: BOSS GE-20) | Roland |
| Para EQ | parametrischer EQ, 2 schwenkbare Mitten | Roland |
| Guitar Sim | Tonabnehmer-Simulation (S→H = Single zu Humbucker usw.) | Roland |
| Slow Gear | BOSS SG-1 (Volumen-Einblendung, „Violin“) | Roland |
| Wave Synth | monophoner Lead-Synth | Roland |
| Octave | BOSS OC-3 | Roland |
| Pitch Shifter, Harmonist | Tonhöhe fest bzw. tonartbezogen (Harmonist nutzt die Tonart des Patches) | Roland |
| AC Processor | Akustik-Prozessor für Akustik-Gitarren | Roland |
| Phaser | BOSS PH-3 | Roland |
| Flanger | BOSS BF-3 | Roland |
| Tremolo | BOSS TR-2 | Roland |
| Rotary | BOSS RT-20 (Leslie) | Roland |
| Uni-V | Univox Uni-Vibe | Roland |
| Slicer | BOSS SL-20 | Roland |
| Vibrato | BOSS VB-2 | Roland |
| Ring Mod | Ringmodulator | Roland |
| Humanizer | „sprechendes“ Wah (Vokale) | Roland |
| 2x2 Chorus | BOSS AD-8, Chorus getrennt nach Bass/Höhen | Roland |
| AC Guitar Sim | lässt eine E-Gitarre akustisch klingen | – (Katana-eigen) |
| Phaser 90E | MXR Phase 90 (Script = Logo-Version mit weniger Resonanz) | abgeleitet (Name) |
| Flanger 117E | MXR M-117 Flanger | abgeleitet (Name) |
| Wah 95E | Dunlop Cry Baby 95Q | abgeleitet (Name) |
| Delay Chorus 30 | Roland DC-30 Analog Chorus Echo | abgeleitet (Name, Regler) |
| Heavy Octave | Oktaven −1/−2, für schwere Riffs | BOSS-eigen |
| Pedal Bend | Pitch-Bend (Whammy-artig) mit fester Pedalstellung | BOSS-eigen, seit Version 2 |

### D.4 Delay (`delay.type`, `delay2.type`) und Reverb (`reverb.type`)

| Typ | Vorbild / Zweck | Quelle |
| --- | --- | --- |
| Digital | sauberes Digital-Delay | Roland |
| Pan | Stereo-Ping-Pong (Tap Time = Verhältnis) | Roland |
| Stereo | trocken links, Effekt rechts | Roland |
| Dual Series, Dual Parallel, Dual L/R | zwei Delays mit eigenen Zeiten | Roland |
| Reverse | rückwärts | Roland |
| Analog | BOSS DM-3 (warm, dunkel) | Roland |
| Tape Echo | Roland RE-201 Space Echo | Roland |
| Modulate | BOSS DD-20 mit Modulation | Roland |
| SDE-3000 | Roland SDE-3000 (80er-Rack-Delay) | abgeleitet (Name) |
| Ambience (Reverb) | Raum-Mikrofonie im Studio, sehr kurz | Roland |
| Room, Hall 1, Hall 2, Plate | Raum, Halle, Plattenhall | allgemein |
| Spring | Federhall (Fender-Amps) | allgemein |
| Mod | modulierter Hall | allgemein |

---

## Teil E – Das Format `katana-helper-preset`

Ein JSON-Objekt. Alle Schlüssel englisch, wie unten.

| Schlüssel | Pflicht | Inhalt | Fehlt → |
| --- | --- | --- | --- |
| `format` | ja | `"katana-helper-preset"` | Fehler |
| `formatVersion` | nein | `1` | – |
| `name` | ja | bis 16 Zeichen ASCII | Fehler |
| `description` | nein | Freitext (Original, Song, Hinweise) | – |
| `amp` | ja | `model` + `gain`, `volume`, `bass`, `middle`, `treble`, `presence` (0 … 100) | Fehler; fehlende Regler bleiben wie im aktuellen Klang (Hinweis) |
| `booster`, `mod`, `fx`, `delay`, `delay2`, `reverb` | nein | Effekt-Abschnitt (unten) | Effekt **aus** |
| `noiseSuppressor` | nein | `on`, `threshold`, `release` (0 … 100) | **aus** |
| `eq1`, `eq2` | nein | `on`, `type` (`Parametric`/`Graphic`), `position` (`Amp In`/`Amp Out`), `params` | **aus** |
| `contour` | nein | `on`, `type` (1, 2, 3) | **aus** |
| `cabResonance` | nein | `Vintage`, `Modern`, `Deep` | unverändert |
| `patchLevel` | nein | 0 … 100 | unverändert |

**Effekt-Abschnitt:**

```json
{ "on": true, "type": "Tubescreamer", "color": "green", "knob": 50, "params": { "Drive": 10 } }
```

- `on` (Pflicht): `true`/`false`.
- `type`: Typname aus der Referenz. Pflicht, wenn `on` true ist.
- `color`: `green`, `red` oder `yellow` (Standard `green`). Delay 2 nutzt die Farbe des
  Reverbs.
- `knob`: Stellung des Effektreglers am Amp, 0 … 100 (Standard 50). Bei Delay 2 gilt der
  Reverb-Regler.
- `params`: Regler des Typs mit Name und Wert laut Referenz. Bei eingeschaltetem Effekt alle
  angeben.
- Nur bei `reverb`: `knobControls` (`Delay`, `Delay+Reverb`, `Reverb`).

katana-helper prüft das Preset vollständig. Bei Fehlern meldet es jeden mit Pfad und den
erlaubten Werten, z. B.
`booster.params.Drive: 200 liegt außerhalb 0 … 120`. Gib diese Meldungen beim Korrigieren
genau so zurück.

---

## Teil F – Vorgehen und Beispiel

### F.1 So kommst du vom Wunsch zum Preset

1. **Original bestimmen:** Künstler, Song, Jahr, Gitarre und Tonabnehmer, Amp, Pedale,
   Studio. Was dir unsicher ist, nennst du als Annahme.
2. **Amp wählen:** das Modell aus D.1, das dem Original am nächsten kommt. Gibt es keins,
   passt der Panel-Typ mit ähnlichem Charakter (Clean, Crunch, Lead, Brown).
3. **Gain staffeln:** Wo das Original einen Booster vor einem verzerrten Amp hatte, nimm
   denselben Typ mit wenig Drive und hohem Effect Level. Amp-Gain eher etwas niedriger als
   gedacht; der Katana komprimiert bei viel Gain stark.
4. **EQ:** zuerst am Amp (Bass/Middle/Treble/Presence). Für Soli eher mehr Mitten als für
   Rhythmus. EQ 1/2 nur für gezielte Korrekturen (z. B. Bässe unter 80 Hz absenken).
5. **Effekte:** nur was im Original hörbar ist. Soli im Bandkontext brauchen meist ein
   dezentes Delay (300–500 ms, wenig Feedback) und wenig Hall.
6. **Noise Suppressor** bei High Gain an.
7. **Lautstärke:** `amp.volume` ausgleichen, `patchLevel` meistens weglassen.

### F.2 Faustwerte als Ausgangspunkt

Erfahrungswerte, nicht am Amp gemessen. Gain-Werte gelten für Humbucker; bei Single Coils
etwa 10 höher.

| Stil | Amp | Gain | Booster | Effekte |
| --- | --- | --- | --- | --- |
| Clean Funk/Pop | Clean Twin oder Clean | 20–35 | Compressor (MOD) | wenig Reverb |
| Blues | Deluxe Crunch, Crunch | 35–55 | Blues Drive oder Tubescreamer, wenig Drive | Spring oder Room |
| Classic Rock | MS-1959 I+II, Crunch | 50–70 | Tubescreamer oder Clean Boost | Room, kurzes Delay |
| 80er Hard Rock | Brown, HiGain Stack | 55–70 | Tubescreamer | Delay 350–450 ms, Plate |
| Thrash Metal | BG Lead, R-Fier Modern, Lead | 55–75 | Tubescreamer, Drive 0–20, Level 80–100 | Noise Suppressor an |
| Modern Metal | R-Fier Modern, Core Metal | 60–80 | Tubescreamer oder Metal Core | Noise Suppressor an |
| Ambient | Clean, Natural Clean | 15–30 | – | Delay 2 + Reverb, Effect Level hoch |

### F.3 Beispiel: Solo aus „Master of Puppets“ (Metallica, 1986)

Wunsch: *„Erstelle einen Gitarrensound wie das Solo von Metallica auf Master of Puppets.“*

**Annahmen:** Kirk Hammett spielte das Album mit einem MESA/Boogie-Mark-Preamp (Mark IIC+)
und einem Ibanez Tube Screamer als Booster, Gitarre mit aktiven Humbuckern (EMG). Der
Solo-Sound ist verzerrt, mittig und singend, mit wenig Hall und etwas Delay im Mix. Diese
Angaben stammen aus allgemein bekannten Interviews und Gear-Berichten, nicht aus einer
Quelle dieses Projekts.

**Übertragung:** BG Lead ist laut Roland der MESA/Boogie-Lead-Sound und damit das nächste
Modell. Tubescreamer mit wenig Drive und hohem Pegel strafft den Amp. Mitten leicht vor,
Bässe zurück. Analog-Delay um 400 ms und ein kurzer Plattenhall leise dazu. Noise
Suppressor an.

<!-- BEGIN BEISPIEL -->
```json
{
  "format": "katana-helper-preset",
  "formatVersion": 1,
  "name": "Puppets Solo",
  "description": "Metallica, Master of Puppets (1986), Solo. MESA Mark + Tube Screamer -> BG Lead + Tubescreamer.",
  "amp": { "model": "BG Lead", "gain": 60, "volume": 55, "bass": 42, "middle": 58, "treble": 60, "presence": 50 },
  "booster": {
    "on": true, "type": "Tubescreamer", "color": "green", "knob": 50,
    "params": { "Drive": 10, "Bottom": 0, "Tone": 5, "Effect Level": 80, "Direct Mix": 0, "Solo": "Off", "Solo Level": 50 }
  },
  "delay": {
    "on": true, "type": "Analog", "color": "green", "knob": 30,
    "params": { "Time": 400, "Feedback": 20, "High Cut": "4 kHz", "Effect Level": 20, "Direct Mix": 100 }
  },
  "reverb": {
    "on": true, "type": "Plate", "color": "green", "knob": 30, "knobControls": "Reverb",
    "params": { "Time": 1.8, "Pre Delay": 10, "Low Cut": "200 Hz", "High Cut": "6.3 kHz", "Density": 8, "Effect Level": 15, "Direct Mix": 100 }
  },
  "noiseSuppressor": { "on": true, "threshold": 40, "release": 30 },
  "eq1": {
    "on": true, "type": "Graphic", "position": "Amp Out",
    "params": { "31 Hz": -2, "62 Hz": -1, "125 Hz": 0, "250 Hz": 0, "500 Hz": 1, "1 kHz": 2, "2 kHz": 1.5, "4 kHz": 0, "8 kHz": -1.5, "16 kHz": -3, "Level": 0 }
  },
  "cabResonance": "Modern"
}
```
<!-- END BEISPIEL -->

Nachstellen: zuerst `amp.gain` (zu matschig → runter), dann `middle`. Wirkt das Solo zu
leise, `amp.volume` um 5–10 anheben.

---

## Teil G – Referenz: alle Namen und Wertebereiche

Automatisch aus dem Code von katana-helper erzeugt (`npm run docs:preset`). Was hier nicht
steht, nimmt katana-helper nicht an.

<!-- BEGIN REFERENZ (automatisch, nicht von Hand ändern) -->
### Amp-Modelle (`amp.model`)

| Modell | Schalter AMP TYPE |
| --- | --- |
| Acoustic (Panel) | Acoustic |
| Clean (Panel) | Clean |
| Crunch (Panel) | Crunch |
| Lead (Panel) | Lead |
| Brown (Panel) | Brown |
| Variation Acoustic | Acoustic |
| Variation Clean | Clean |
| Variation Crunch | Crunch |
| Variation Lead | Lead |
| Variation Brown | Brown |
| Natural Clean | Clean |
| Clean Twin | Clean |
| Combo Crunch | Crunch |
| Pro Crunch | Crunch |
| Deluxe Crunch | Crunch |
| Stack Crunch | Crunch |
| VO Drive | Crunch |
| BG Drive | Crunch |
| Match Drive | Crunch |
| Power Drive | Lead |
| VO Lead | Lead |
| BG Lead | Lead |
| Extreme Lead | Lead |
| T-Amp Lead | Lead |
| MS-1959 I | Crunch |
| MS-1959 I+II | Crunch |
| HiGain Stack | Brown |
| R-Fier Vintage | Brown |
| R-Fier Modern | Brown |
| Core Metal | Brown |

Regler `gain`, `volume`, `bass`, `middle`, `treble`, `presence`: ganze Zahlen 0 … 100.

### Booster (`booster.type`)

Typen: Mid Boost, Clean Boost, Treble Boost, Crunch OD, Natural OD, Warm OD, Fat DS, Metal DS, OCT Fuzz, Blues Drive, Overdrive, Tubescreamer, Turbo OD, Distortion, Rat, GuV DS, DST+, Metal Zone, '60s Fuzz, Muff Fuzz, HM-2, Metal Core, Centa OD.

Alle Booster-Typen haben dieselben Regler:

| Parameter | Werte |
| --- | --- |
| Drive | 0 … 120 |
| Bottom | -50 … +50 |
| Tone | -50 … +50 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |
| Solo | Off, On |
| Solo Level | 0 … 100 |

### MOD und FX (`mod.type`, `fx.type`)

MOD und FX haben dieselben Typen und Regler.

**T.Wah**

| Parameter | Werte |
| --- | --- |
| Mode | LPF, BPF |
| Polarity | Down, Up |
| Sens | 0 … 100 |
| Frequency | 0 … 100 |
| Peak | 0 … 100 |
| Direct Mix | 0 … 100 |
| Effect Level | 0 … 100 |

**Auto Wah**

| Parameter | Werte |
| --- | --- |
| Mode | LPF, BPF |
| Frequency | 0 … 100 |
| Peak | 0 … 100 |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Direct Mix | 0 … 100 |
| Effect Level | 0 … 100 |

**Pedal Wah**

| Parameter | Werte |
| --- | --- |
| Wah Type | Cry Wah, VO Wah, Fat Wah, Light Wah, 7String Wah, Reso Wah |
| Pedal Position | 0 … 100 |
| Pedal Min | 0 … 100 |
| Pedal Max | 0 … 100 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Compressor**

| Parameter | Werte |
| --- | --- |
| Comp Type | BOSS Comp, Hi-Band, Light, D-Comp, Orange, Fat, Mild |
| Sustain | 0 … 100 |
| Attack | 0 … 100 |
| Tone | -50 … +50 |
| Effect Level | 0 … 100 |

**Limiter**

| Parameter | Werte |
| --- | --- |
| Limiter Type | BOSS Limiter, Rack 160D, Vtg Rack U |
| Attack | 0 … 100 |
| Threshold | 0 … 100 |
| Ratio | 1:1, 1.2:1, 1.4:1, 1.6:1, 1.8:1, 2:1, 2.3:1, 2.6:1, 3:1, 3.5:1, 4:1, 5:1, 6:1, 8:1, 10:1, 12:1, 20:1, ∞:1 |
| Release | 0 … 100 |
| Effect Level | 0 … 100 |

**Graphic EQ**

| Parameter | Werte |
| --- | --- |
| 31 Hz | -20 … +20 dB |
| 62 Hz | -20 … +20 dB |
| 125 Hz | -20 … +20 dB |
| 250 Hz | -20 … +20 dB |
| 500 Hz | -20 … +20 dB |
| 1 kHz | -20 … +20 dB |
| 2 kHz | -20 … +20 dB |
| 4 kHz | -20 … +20 dB |
| 8 kHz | -20 … +20 dB |
| 16 kHz | -20 … +20 dB |
| Level | -20 … +20 dB |

**Para EQ**

| Parameter | Werte |
| --- | --- |
| Low Cut | Flat, 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz |
| Low Gain | -20 … +20 dB |
| Low-Mid Freq | 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz |
| Low-Mid Q | 0.5, 1, 2, 4, 8, 16 |
| Low-Mid Gain | -20 … +20 dB |
| High-Mid Freq | 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz |
| High-Mid Q | 0.5, 1, 2, 4, 8, 16 |
| High-Mid Gain | -20 … +20 dB |
| High Gain | -20 … +20 dB |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Level | -20 … +20 dB |

**Guitar Sim**

| Parameter | Werte |
| --- | --- |
| Sim Type | S→H, H→S, H→HF, S→Hollow, H→Hollow, S→AC, H→AC, P→AC |
| Low | -50 … +50 |
| High | -50 … +50 |
| Level | 0 … 100 |
| Body | 0 … 100 |

**Slow Gear**

| Parameter | Werte |
| --- | --- |
| Sens | 0 … 100 |
| Rise Time | 0 … 100 |
| Level | 0 … 100 |

**Wave Synth**

| Parameter | Werte |
| --- | --- |
| Wave | Saw, Square |
| Cutoff Freq | 0 … 100 |
| Resonance | 0 … 100 |
| Filter Sens | 0 … 100 |
| Filter Decay | 0 … 100 |
| Filter Depth | 0 … 100 |
| Synth Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Octave**

| Parameter | Werte |
| --- | --- |
| Range | 1, 2, 3, 4 |
| Octave Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Pitch Shifter**

| Parameter | Werte |
| --- | --- |
| Voice | 1-Voice, 2-Mono |
| PS1 Mode | Fast, Medium, Slow, Mono |
| PS1 Pitch | -24 … +24 Halbtöne |
| PS1 Fine | -50 … +50 |
| PS1 Pre Delay | 0 … 300 ms |
| PS1 Level | 0 … 100 |
| PS2 Mode | Fast, Medium, Slow, Mono |
| PS2 Pitch | -24 … +24 Halbtöne |
| PS2 Fine | -50 … +50 |
| PS2 Pre Delay | 0 … 300 ms |
| PS2 Level | 0 … 100 |
| Feedback | 0 … 100 |
| Direct Mix | 0 … 100 |

**Harmonist**

| Parameter | Werte |
| --- | --- |
| Voice | 1-Voice, 2-Voice |
| HR1 Harmony | -2oct, -14th, -13th, -12th, -11th, -10th, -9th, -1oct, -7th, -6th, -5th, -4th, -3rd, -2nd, Unison, +2nd, +3rd, +4th, +5th, +6th, +7th, +1oct, +9th, +10th, +11th, +12th, +13th, +14th, +2oct, User |
| HR1 Pre Delay | 0 … 300 ms |
| HR1 Level | 0 … 100 |
| HR2 Harmony | -2oct, -14th, -13th, -12th, -11th, -10th, -9th, -1oct, -7th, -6th, -5th, -4th, -3rd, -2nd, Unison, +2nd, +3rd, +4th, +5th, +6th, +7th, +1oct, +9th, +10th, +11th, +12th, +13th, +14th, +2oct, User |
| HR2 Pre Delay | 0 … 300 ms |
| HR2 Level | 0 … 100 |
| Feedback | 0 … 100 |
| Direct Mix | 0 … 100 |

**AC Processor**

| Parameter | Werte |
| --- | --- |
| AC Type | Small, Medium, Bright, Power |
| Bass | -50 … +50 |
| Middle | -50 … +50 |
| Middle Freq | 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz |
| Treble | -50 … +50 |
| Presence | -50 … +50 |
| Level | 0 … 100 |

**Phaser**

| Parameter | Werte |
| --- | --- |
| Phaser Type | 4 Stage, 8 Stage, 12 Stage, Bi-Phase |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Manual | 0 … 100 |
| Resonance | 0 … 100 |
| Step Rate | Off oder 0 … 100 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Flanger**

| Parameter | Werte |
| --- | --- |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Manual | 0 … 100 |
| Resonance | 0 … 100 |
| Low Cut | Flat, 55 Hz, 110 Hz, 165 Hz, 200 Hz, 280 Hz, 340 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Tremolo**

| Parameter | Werte |
| --- | --- |
| Wave Shape | 0 … 100 |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Level | 0 … 100 |

**Rotary**

| Parameter | Werte |
| --- | --- |
| Rate | 0 … 100 |
| Rise Time | 0 … 100 |
| Fall Time | 0 … 100 |
| Depth | 0 … 100 |
| Level | 0 … 100 |

**Uni-V**

| Parameter | Werte |
| --- | --- |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Level | 0 … 100 |

**Slicer**

| Parameter | Werte |
| --- | --- |
| Pattern | P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20 |
| Rate | 0 … 100 |
| Trigger Sens | 0 … 100 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Vibrato**

| Parameter | Werte |
| --- | --- |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Level | 0 … 100 |

**Ring Mod**

| Parameter | Werte |
| --- | --- |
| Mode | Normal, Intelligent |
| Frequency | 0 … 100 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Humanizer**

| Parameter | Werte |
| --- | --- |
| Mode | Picking, Auto |
| Vowel 1 | A, E, I, O, U |
| Vowel 2 | A, E, I, O, U |
| Sens | 0 … 100 |
| Rate | 0 … 100 |
| Depth | 0 … 100 |
| Manual | 0 … 100 |
| Level | 0 … 100 |

**2x2 Chorus**

| Parameter | Werte |
| --- | --- |
| Xover Freq | 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz |
| Low Rate | 0 … 100 |
| Low Depth | 0 … 100 |
| Low Pre Delay | 0 … 40 ms (Schritt 0.5) |
| Low Level | 0 … 100 |
| High Rate | 0 … 100 |
| High Depth | 0 … 100 |
| High Pre Delay | 0 … 40 ms (Schritt 0.5) |
| High Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**AC Guitar Sim**

| Parameter | Werte |
| --- | --- |
| Top | -50 … +50 |
| Body | 0 … 100 |
| Low | -50 … +50 |
| High | -50 … +50 |
| Level | 0 … 100 |

**Phaser 90E**

| Parameter | Werte |
| --- | --- |
| Script | Off, On |
| Speed | 0 … 100 |

**Flanger 117E**

| Parameter | Werte |
| --- | --- |
| Manual | 0 … 100 |
| Width | 0 … 100 |
| Speed | 0 … 100 |
| Regen | 0 … 100 |

**Wah 95E**

| Parameter | Werte |
| --- | --- |
| Pedal Position | 0 … 100 |
| Pedal Min | 0 … 100 |
| Pedal Max | 0 … 100 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Delay Chorus 30**

| Parameter | Werte |
| --- | --- |
| Selector | Chorus, Echo |
| Input Volume | 0 … 100 |
| Chorus Intensity | 0 … 100 |
| Echo Repeat Rate | 40 … 600 |
| Echo Intensity | 0 … 100 |
| Echo Volume | 0 … 100 |
| Tone | 0 … 100 |
| Output | D+E, D/E |

**Heavy Octave**

| Parameter | Werte |
| --- | --- |
| -1 Oct Level | 0 … 100 |
| -2 Oct Level | 0 … 100 |
| Direct Mix | 0 … 100 |

**Pedal Bend**

| Parameter | Werte |
| --- | --- |
| Pitch | -24 … +24 Halbtöne |
| Pedal Position | 0 … 100 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

### Delay und Delay 2 (`delay.type`, `delay2.type`)

Delay 2 hat dieselben Typen und Regler wie Delay.

**Digital**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Pan**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| Tap Time | 0 … 100 % |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Stereo**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| D1 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Dual Series**

| Parameter | Werte |
| --- | --- |
| D1 Time | 1 … 1000 ms |
| D1 Feedback | 0 … 100 |
| D1 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| D1 Effect Level | 0 … 120 |
| D2 Time | 1 … 1000 ms |
| D2 Feedback | 0 … 100 |
| D2 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| D2 Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Dual Parallel**

| Parameter | Werte |
| --- | --- |
| D1 Time | 1 … 1000 ms |
| D1 Feedback | 0 … 100 |
| D1 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| D1 Effect Level | 0 … 120 |
| D2 Time | 1 … 1000 ms |
| D2 Feedback | 0 … 100 |
| D2 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| D2 Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Dual L/R**

| Parameter | Werte |
| --- | --- |
| D1 Time | 1 … 1000 ms |
| D1 Feedback | 0 … 100 |
| D1 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| D1 Effect Level | 0 … 120 |
| D2 Time | 1 … 1000 ms |
| D2 Feedback | 0 … 100 |
| D2 High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| D2 Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Reverse**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Analog**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Tape Echo**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**Modulate**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| Mod Rate | 0 … 100 |
| Mod Depth | 0 … 100 |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

**SDE-3000**

| Parameter | Werte |
| --- | --- |
| Time | 1 … 2000 ms |
| Feedback | 0 … 100 |
| Vintage LPF | Off, On |
| Filter | 8 kHz, 17 kHz |
| Modulation | Off, On |
| Feedback Phase | Normal, Inverse |
| Effect Phase | Normal, Inverse |
| Mod Rate | 0 … 100 |
| Mod Depth | 0 … 100 |
| Effect Level | 0 … 120 |
| Direct Mix | 0 … 100 |

### Reverb (`reverb.type`)

Typen: Ambience, Room, Hall 1, Hall 2, Plate, Spring, Mod.

Regler (bei Spring zusätzlich „Spring Color“, 0 … 100):

| Parameter | Werte |
| --- | --- |
| Time | 0.1 … 10 s (Schritt 0.1) |
| Pre Delay | 0 … 500 ms |
| Low Cut | Flat, 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Density | 0 … 10 |
| Effect Level | 0 … 100 |
| Direct Mix | 0 … 100 |

`reverb.knobControls`: Delay, Delay+Reverb, Reverb.

### Noise Suppressor (`noiseSuppressor`)

| Parameter | Werte |
| --- | --- |
| threshold | 0 … 100 |
| release | 0 … 100 |

### EQ 1 und EQ 2 (`eq1`, `eq2`)

`type`: Parametric, Graphic. `position`: Amp In, Amp Out.

**Parametric**

| Parameter | Werte |
| --- | --- |
| Low Cut | Flat, 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz |
| Low Gain | -20 … +20 dB |
| Low-Mid Freq | 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz |
| Low-Mid Q | 0.5, 1, 2, 4, 8, 16 |
| Low-Mid Gain | -20 … +20 dB |
| High-Mid Freq | 20 Hz, 25 Hz, 31.5 Hz, 40 Hz, 50 Hz, 63 Hz, 80 Hz, 100 Hz, 125 Hz, 160 Hz, 200 Hz, 250 Hz, 315 Hz, 400 Hz, 500 Hz, 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz |
| High-Mid Q | 0.5, 1, 2, 4, 8, 16 |
| High-Mid Gain | -20 … +20 dB |
| High Gain | -20 … +20 dB |
| High Cut | 630 Hz, 800 Hz, 1 kHz, 1.25 kHz, 1.6 kHz, 2 kHz, 2.5 kHz, 3.15 kHz, 4 kHz, 5 kHz, 6.3 kHz, 8 kHz, 10 kHz, 12.5 kHz, Flat |
| Level | -20 … +20 dB |

**Graphic**

| Parameter | Werte |
| --- | --- |
| 31 Hz | -12 … +12 dB (Schritt 0.5) |
| 62 Hz | -12 … +12 dB (Schritt 0.5) |
| 125 Hz | -12 … +12 dB (Schritt 0.5) |
| 250 Hz | -12 … +12 dB (Schritt 0.5) |
| 500 Hz | -12 … +12 dB (Schritt 0.5) |
| 1 kHz | -12 … +12 dB (Schritt 0.5) |
| 2 kHz | -12 … +12 dB (Schritt 0.5) |
| 4 kHz | -12 … +12 dB (Schritt 0.5) |
| 8 kHz | -12 … +12 dB (Schritt 0.5) |
| 16 kHz | -12 … +12 dB (Schritt 0.5) |
| Level | -12 … +12 dB (Schritt 0.5) |

### Sonstiges

- `contour`: `on`, `type` 1, 2 oder 3.
- `cabResonance`: Vintage, Modern, Deep.
- `patchLevel`: 0 … 100.
<!-- END REFERENZ -->

---

## Teil H – Wie sicher ist das?

Adressen und Status: [`docs/protocol.md`](protocol.md).

- **Am eigenen Amp getestet:** Amp-Modell, Amp-Regler, Effekte an/aus, Typ, Farbe, Lesen
  aller Detailregler. Schreiben ist nur mit unveränderten Werten geprüft.
- **Nur aus Quellen (UNVERIFIZIERT):** Noise Suppressor, EQ 1/2 mit Position, Contour,
  Cab Resonance, Patch Level (`protocol.md` 7.7). Sie stehen in FxFloorBoard, sind aber
  noch nicht am Amp gehört.
- **Hörtests stehen aus** (`device-test.md`, Teil 5 und Teil 8). Bis dahin kann ein Regler
  anders klingen als erwartet.
- Die Vorbilder in Teil D stammen aus der GT-100-Dokumentation von Roland. Ob die Katana-
  Modelle genauso klingen wie im GT-100, ist nicht belegt.

### Quellen zu Teil C und D

- Roland/BOSS: *GT-100 Training Guide* – <http://cdn.roland.com/assets/media/pdf/GT-100_Training_Guide.pdf>
- BOSS: *GT-100 Owner's Manual*, OD/DS- und Preamp-Typliste – <https://www.manualslib.com/manual/456170/Boss-Audio-Systems-Gt-100.html?page=52>
- BOSS: Katana MkII Version 2 (2022) – <https://www.roland.com/us/company/press_releases/2022/BOSS-Announces-Version-2-Update-for-Katana-MkII-Gu/>
- guitar.com, Review Katana-50 MkII (Amp-Typen und Variationen) – <https://guitar.com/reviews/amplifier/review-boss-katana-50-mkii/>
- Electrikjam, „BOSS Katana Sneaky Amps“ (versteckte Modelle) – <https://www.electrikjam.com/boss-katana-sneaky-amps-guide/>
- Adressen und Wertebereiche: FxFloorBoard (Colin Willcocks), `midi.xml`, siehe `protocol.md`.
