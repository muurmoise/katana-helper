import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allEffectParams, fromRaw, toRaw } from './effect-params.js';
import { PatchLibrary, memoryBackend } from './library.js';
import { patchName } from './patch.js';
import { PRESET_FORMAT, patchToPreset, presetReference, presetToPatch } from './preset.js';
import { fromBase128 } from './sysex.js';
import { samplePatch } from './testing/fake-katana.js';

// Offset in the patch for 60 00 hi lo.
const o = (hi, lo) => fromBase128([0x60, 0x00, hi, lo]) - fromBase128([0x60, 0, 0, 0]);

const SOLO = {
  format: PRESET_FORMAT,
  formatVersion: 1,
  name: 'Puppets Solo',
  description: 'Test',
  amp: { model: 'BG Lead', gain: 62, volume: 55, bass: 45, middle: 60, treble: 58, presence: 52 },
  booster: { on: true, type: 'Tubescreamer', color: 'red', knob: 40, params: { Drive: 15, Bottom: -5, Tone: 5, 'Effect Level': 85, 'Direct Mix': 0, Solo: 'Off', 'Solo Level': 50 } },
  mod: { on: false },
  delay: { on: true, type: 'Analog', params: { Time: 420, Feedback: 22, 'High Cut': '4 kHz', 'Effect Level': 18, 'Direct Mix': 100 } },
  reverb: { on: true, type: 'Plate', color: 'yellow', knob: 30, params: { Time: 2.5, 'Pre Delay': 20, 'Low Cut': '200 Hz', 'High Cut': '6.3 kHz', Density: 8, 'Effect Level': 20, 'Direct Mix': 100 } },
  noiseSuppressor: { on: true, threshold: 35, release: 40 },
  eq1: { on: true, type: 'Graphic', position: 'Amp Out', params: { '31 Hz': 0, '62 Hz': -3.5, '125 Hz': 0, '250 Hz': 0, '500 Hz': 1, '1 kHz': 2, '2 kHz': 1.5, '4 kHz': 0, '8 kHz': -2, '16 kHz': -4, Level: 0 } },
  contour: { on: true, type: 2 },
  cabResonance: 'Modern',
  patchLevel: 60,
};

describe('presetToPatch', () => {
  it('turns names and display values into the documented bytes', () => {
    const { map, name, description, warnings } = presetToPatch(SOLO);
    expect(name).toBe('Puppets Solo');
    expect(description).toBe('Test');
    expect(warnings).toEqual([]);
    expect(patchName(map)).toBe('Puppets Solo');
    // amp: model BG Lead (10), switch Lead (03), panel knobs
    expect(map.get(o(0x00, 0x21))).toBe(0x10);
    expect(map.get(o(0x06, 0x50))).toBe(0x03);
    expect([0x51, 0x52, 0x53, 0x54, 0x55, 0x56].map((lo) => map.get(o(0x06, lo)))).toEqual([62, 55, 45, 60, 58, 52]);
    // booster: on, Tubescreamer (0C) as active type and in the red slot, colour red, knob 40 → 41
    expect(map.get(o(0x00, 0x10))).toBe(1);
    expect(map.get(o(0x00, 0x11))).toBe(0x0c);
    expect(map.get(o(0x06, 0x25))).toBe(0x0c);
    expect(map.get(o(0x06, 0x39))).toBe(1);
    expect(map.get(o(0x06, 0x57))).toBe(41);
    expect(map.get(o(0x00, 0x12))).toBe(15); // Drive
    expect(map.get(o(0x00, 0x13))).toBe(45); // Bottom -5
    expect(map.get(o(0x00, 0x14))).toBe(55); // Tone +5
    // delay: Analog (07), 420 ms = 03 24, High Cut 4 kHz = list entry 8
    expect(map.get(o(0x05, 0x01))).toBe(0x07);
    expect([map.get(o(0x05, 0x02)), map.get(o(0x05, 0x03))]).toEqual([0x03, 0x24]);
    expect(map.get(o(0x05, 0x05))).toBe(8);
    expect(map.get(o(0x06, 0x5a))).toBe(51); // default knob 50
    // reverb: yellow, Plate in the yellow slot, 2.5 s = raw 24, knob controls reverb
    expect(map.get(o(0x06, 0x3d))).toBe(2);
    expect(map.get(o(0x06, 0x32))).toBe(0x04);
    expect(map.get(o(0x05, 0x42))).toBe(24);
    expect([map.get(o(0x05, 0x43)), map.get(o(0x05, 0x44))]).toEqual([0, 20]);
    expect(map.get(o(0x06, 0x38))).toBe(2);
    expect(map.get(o(0x06, 0x5b))).toBe(31);
    // missing effects are off, with the knob at 00
    for (const [on, knob] of [[o(0x01, 0x00), o(0x06, 0x58)], [o(0x03, 0x00), o(0x06, 0x59)]]) {
      expect(map.get(on)).toBe(0);
      expect(map.get(knob)).toBe(0);
    }
    expect(map.get(o(0x05, 0x20))).toBe(0); // Delay 2
    // noise suppressor, EQ 1 graphic (0.5 dB steps), contour, cab, patch level
    expect([0x66, 0x67, 0x68].map((lo) => map.get(o(0x05, lo)))).toEqual([1, 35, 40]);
    expect(map.get(o(0x00, 0x40))).toBe(1);
    expect(map.get(o(0x00, 0x41))).toBe(1);
    expect(map.get(o(0x00, 0x4e))).toBe(17); // 62 Hz -3.5 dB
    expect(map.get(o(0x00, 0x53))).toBe(27); // 2 kHz +1.5 dB
    expect(map.get(o(0x06, 0x22))).toBe(1); // Amp Out
    expect(map.get(o(0x00, 0x60))).toBe(0); // EQ 2 missing → off
    expect([map.get(o(0x06, 0x16)), map.get(o(0x06, 0x17))]).toEqual([1, 1]);
    expect(map.get(o(0x06, 0x43))).toBe(1);
    expect(map.get(o(0x05, 0x70))).toBe(60);
  });

  it('leaves untouched what a preset does not mention', () => {
    const { map } = presetToPatch({ format: PRESET_FORMAT, name: 'Klein', amp: { model: 'Clean', gain: 20, volume: 50, bass: 50, middle: 50, treble: 50, presence: 50 } });
    expect(map.get(o(0x00, 0x21))).toBe(0x08); // "Clean" finds "Clean (Panel)"
    expect(map.has(o(0x06, 0x43))).toBe(false); // cab resonance
    expect(map.has(o(0x05, 0x70))).toBe(false); // patch level
    expect(map.has(o(0x00, 0x11))).toBe(false); // booster type
    expect(map.get(o(0x00, 0x10))).toBe(0); // but the booster is off
  });

  it('warns about missing parameters but still converts', () => {
    const { warnings } = presetToPatch({
      format: PRESET_FORMAT,
      name: 'Lücke',
      amp: { model: 'Brown', gain: 70 },
      mod: { on: true, type: 'Tremolo', params: { Rate: 40 } },
    });
    expect(warnings).toContain('amp.volume: fehlt, bleibt wie im aktuellen Klang');
    expect(warnings).toContain('mod.params: Wave Shape, Depth, Level fehlt, bleibt wie im aktuellen Klang');
    expect(warnings.some((w) => w.includes('Umlaute'))).toBe(true);
  });

  it('lists every problem at once, with the path and what is allowed', () => {
    let error;
    try {
      presetToPatch({
        format: PRESET_FORMAT,
        name: 'Fehler',
        amp: { model: 'Mesa Mark IIC+', gain: 130 },
        booster: { on: true, type: 'Tubescreamer', color: 'blue', params: { Drive: 200, Gain: 3 } },
        delay: { on: true },
        reverb: { on: true, type: 'Hall 1', color: 'red' },
        delay2: { on: true, type: 'Digital', color: 'green' },
        flanger: {},
      });
    } catch (e) {
      error = e;
    }
    expect(error.name).toBe('PresetError');
    const text = error.problems.join('\n');
    expect(text).toContain('amp.model: „Mesa Mark IIC+“ gibt es nicht. Erlaubt: ');
    expect(text).toContain('amp.gain: ganze Zahl 0 … 100 erwartet');
    expect(text).toContain('booster.color: green, red oder yellow erwartet');
    expect(text).toContain('booster.params.Drive: 200 liegt außerhalb 0 … 120');
    expect(text).toContain('booster.params.Gain: gibt es bei Tubescreamer nicht. Erlaubt: Drive, Bottom');
    expect(text).toContain('delay.type: fehlt');
    expect(text).toContain('delay2.color: Delay 2 und Reverb teilen sich die Farbe');
    expect(text).toContain('flanger: unbekannter Abschnitt');
  });

  it('refuses things that are no preset', () => {
    expect(() => presetToPatch(null)).toThrow('JSON-Objekt');
    expect(() => presetToPatch({ name: 'x', amp: { model: 'Clean' } })).toThrow('format');
    expect(() => presetToPatch({ format: PRESET_FORMAT, amp: { model: 'Clean' } })).toThrow('name: fehlt');
  });

  it('lets Delay 2 use the reverb colour, knob and knob assignment', () => {
    const { map } = presetToPatch({
      format: PRESET_FORMAT,
      name: 'Delay2',
      amp: { model: 'Clean' },
      delay2: { on: true, type: 'Tape Echo', color: 'red', knob: 60, params: { Time: 300 } },
    });
    expect(map.get(o(0x05, 0x20))).toBe(1);
    expect(map.get(o(0x06, 0x3d))).toBe(1); // shared colour: red
    expect(map.get(o(0x06, 0x34))).toBe(0x08); // Delay 2 type, red slot
    expect(map.get(o(0x06, 0x37))).toBe(0); // reverb knob controls Delay 2
    expect(map.get(o(0x06, 0x5b))).toBe(61);
    expect(map.get(o(0x05, 0x40))).toBe(0); // reverb off
  });

  it('accepts values as written in BOSS Tone Studio', () => {
    const { map } = presetToPatch({
      format: PRESET_FORMAT,
      name: 'Werte',
      amp: { model: 'clean twin' },
      mod: { on: true, type: 'phaser', params: { 'step rate': 'Off', Rate: 30 } },
      fx: { on: true, type: '2x2 Chorus', params: { 'Low Pre Delay': 7.5, 'Xover Freq': '800 Hz' } },
    });
    expect(map.get(o(0x00, 0x21))).toBe(0x09);
    expect(map.get(o(0x02, 0x08))).toBe(0); // Step Rate Off
    expect(map.get(o(0x04, 0x3a))).toBe(15); // FX = MOD + 02 00; 7.5 ms = raw 15
  });
});

describe('patchToPreset', () => {
  it('reads a patch back into the same preset', () => {
    // Start from a full patch and put the preset on top, like loading it into the amp.
    const base = samplePatch('Basis');
    const { map } = presetToPatch(SOLO);
    for (const [k, v] of map) base.set(k, v);
    const back = patchToPreset(base);
    expect(back.amp).toEqual(SOLO.amp);
    expect(back.booster).toEqual(SOLO.booster);
    expect(back.delay).toMatchObject({ on: true, type: 'Analog', params: SOLO.delay.params });
    expect(back.reverb).toMatchObject({ on: true, type: 'Plate', color: 'yellow', knob: 30, knobControls: 'Reverb', params: SOLO.reverb.params });
    expect(back.noiseSuppressor).toEqual(SOLO.noiseSuppressor);
    expect(back.eq1).toEqual(SOLO.eq1);
    expect(back.contour).toEqual(SOLO.contour);
    expect(back.cabResonance).toBe('Modern');
    expect(back.patchLevel).toBe(60);

    // And the exported preset converts to exactly the bytes of the patch.
    const again = presetToPatch(back);
    const diff = [...again.map].filter(([k, v]) => base.get(k) !== v);
    expect(diff).toEqual([]);
  });
});

describe('value conversion', () => {
  it('turns every raw value of every effect parameter into a display value and back', () => {
    for (const p of allEffectParams()) {
      const raws = p.options ? p.options.map(([v]) => v) : Array.from({ length: p.max - p.min + 1 }, (_, i) => p.min + i);
      for (const raw of raws) expect(toRaw(p, fromRaw(p, raw))).toBe(raw);
    }
  });
});

describe('library import', () => {
  it('imports a preset pasted from a chat, with its code fence', async () => {
    const lib = new PatchLibrary(memoryBackend());
    const warnings = [];
    const text = '```json\n' + JSON.stringify({ ...SOLO, booster: { on: true, type: 'Blues Drive' } }, null, 2) + '\n```';
    expect(await lib.importJson(text, { onWarning: (w) => warnings.push(w) })).toBe(1);
    const [entry] = await lib.list();
    expect(entry).toMatchObject({ name: 'Puppets Solo', origin: 'Preset', note: 'Test', kind: 'patch' });
    expect(warnings[0]).toContain('„Puppets Solo“: booster.params: Drive, Bottom');
    expect(lib.patchOf(entry).get(o(0x00, 0x11))).toBe(0x0a);
  });

  it('imports several presets and names the broken one', async () => {
    const lib = new PatchLibrary(memoryBackend());
    expect(await lib.importJson(JSON.stringify([SOLO, { ...SOLO, name: 'Zwei' }]))).toBe(2);
    await expect(lib.importJson(JSON.stringify([SOLO, { ...SOLO, amp: { model: 'X' } }]))).rejects.toThrow('Preset 2: Preset ungültig');
  });
});

describe('docs/preset-guide.md', () => {
  const guide = readFileSync(new URL('../../docs/preset-guide.md', import.meta.url), 'utf8');

  it('has an example that converts without errors or hints', () => {
    const m = guide.match(/<!-- BEGIN BEISPIEL -->\n```json\n([\s\S]*?)\n```\n<!-- END BEISPIEL -->/);
    expect(m, 'Beispiel fehlt').not.toBeNull();
    const result = presetToPatch(JSON.parse(m[1]));
    expect(result.warnings).toEqual([]);
    expect(result.name).toBe('Puppets Solo');
  });

  it('contains the current reference (npm run docs:preset)', () => {
    const m = guide.match(/<!-- BEGIN REFERENZ[^>]*-->\n([\s\S]*?)\n<!-- END REFERENZ -->/);
    expect(m, 'Markierungen fehlen').not.toBeNull();
    expect(m[1]).toBe(presetReference());
  });
});
