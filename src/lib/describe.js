// Human-readable names for Katana MkII addresses and values (UI language: German).
// Addresses and value tables: docs/protocol.md (sections 4–9). The value lists are facts
// taken from FxFloorBoard midi.xml (Q2), not copied code.

import { allEffectParams, decodeValue, formatValue } from './effect-params.js';
import { hex } from './sysex.js';

const ampModels = {
  0x01: 'Acoustic (Panel)', 0x08: 'Clean (Panel)', 0x0b: 'Crunch (Panel)', 0x18: 'Lead (Panel)',
  0x17: 'Brown (Panel)', 0x00: 'Natural Clean', 0x09: 'Clean Twin', 0x02: 'Combo Crunch',
  0x0a: 'Pro Crunch', 0x0c: 'Deluxe Crunch', 0x03: 'Stack Crunch', 0x0d: 'VO Drive',
  0x11: 'BG Drive', 0x0f: 'Match Drive', 0x05: 'Power Drive', 0x1c: 'Variation Acoustic',
  0x1d: 'Variation Clean', 0x1e: 'Variation Crunch', 0x1f: 'Variation Lead',
  0x20: 'Variation Brown', 0x0e: 'VO Lead', 0x10: 'BG Lead', 0x06: 'Extreme Lead',
  0x16: 'T-Amp Lead', 0x12: 'MS-1959 I', 0x13: 'MS-1959 I+II', 0x04: 'HiGain Stack',
  0x14: 'R-Fier Vintage', 0x15: 'R-Fier Modern', 0x07: 'Core Metal',
};

const boosterTypes = [
  'Mid Boost', 'Clean Boost', 'Treble Boost', 'Crunch OD', 'Natural OD', 'Warm OD', 'Fat DS',
  null, 'Metal DS', 'OCT Fuzz', 'Blues Drive', 'Overdrive', 'Tubescreamer', 'Turbo OD',
  'Distortion', 'Rat', 'GuV DS', 'DST+', 'Metal Zone', "'60s Fuzz", 'Muff Fuzz', 'HM-2',
  'Metal Core', 'Centa OD',
];

const modTypes = {
  0x00: 'T.Wah', 0x01: 'Auto Wah', 0x02: 'Pedal Wah', 0x03: 'Compressor', 0x04: 'Limiter',
  0x06: 'Graphic EQ', 0x07: 'Para EQ', 0x09: 'Guitar Sim', 0x0a: 'Slow Gear', 0x0c: 'Wave Synth',
  0x0e: 'Octave', 0x0f: 'Pitch Shifter', 0x10: 'Harmonist', 0x12: 'AC Processor', 0x13: 'Phaser',
  0x14: 'Flanger', 0x15: 'Tremolo', 0x16: 'Rotary', 0x17: 'Uni-V', 0x19: 'Slicer',
  0x1a: 'Vibrato', 0x1b: 'Ring Mod', 0x1c: 'Humanizer', 0x1d: '2x2 Chorus',
  0x1f: 'AC Guitar Sim', 0x23: 'Phaser 90E', 0x24: 'Flanger 117E', 0x25: 'Wah 95E',
  0x26: 'Delay Chorus 30', 0x27: 'Heavy Octave', 0x28: 'Pedal Bend',
};

const delayTypes = [
  'Digital', 'Pan', 'Stereo', 'Dual Series', 'Dual Parallel', 'Dual L/R', 'Reverse', 'Analog',
  'Tape Echo', 'Modulate', 'SDE-3000',
];

const reverbTypes = ['Ambience', 'Room', 'Hall 1', 'Hall 2', 'Plate', 'Spring', 'Mod'];

const ampKnob = ['Acoustic', 'Clean', 'Crunch', 'Lead', 'Brown'];
const colors = ['Grün', 'Rot', 'Gelb'];
const reverbKnob = ['Delay', 'Delay+Reverb', 'Reverb'];

export const CHANNEL_NAMES = ['Panel', 'A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

export const TABLES = { ampModels, boosterTypes, modTypes, delayTypes, reverbTypes, ampKnob, colors, reverbKnob };

const pick = (table) => (d) => {
  const name = table[d[0]];
  return name ? `${name} (${hex(d)})` : `unbekannt (${hex(d)})`;
};
const onOff = (d) => (d[0] ? 'an' : 'aus');
const number = (d) => String(d[0]);
const effectKnob = (d) => (d[0] === 0 ? 'aus (0)' : String(d[0] - 1));

export function asciiName(bytes) {
  return String.fromCharCode(...Array.from(bytes, (b) => (b >= 0x20 && b < 0x7f ? b : 0x3f))).trimEnd();
}

export function channelFromData(d) {
  return d.length >= 2 ? d[0] * 128 + d[1] : d[0];
}

const channel = (d) => {
  const v = channelFromData(d);
  return `${CHANNEL_NAMES[v] ?? '?'} (${hex(d)})`;
};
const name = (d) => `"${asciiName(d)}"`;

// key: address as hex string, value: [name, size, format]
const FIELDS = new Map();
function field(address, label, size, format) {
  FIELDS.set(hex(address), { label, size, format });
}

field([0x7f, 0, 0, 0x01], 'Edit-Mode', 1, onOff);
field([0x00, 0x01, 0, 0], 'Aktiver Kanal', 2, channel);
field([0x10, 0, 0, 0], 'Name Panel-Speicher', 16, name);
for (let i = 1; i <= 8; i++) field([0x10, i, 0, 0], `Name ${CHANNEL_NAMES[i]}`, 16, name);

const P = (hi, lo) => [0x60, 0x00, hi, lo];
field(P(0x00, 0x00), 'Patch-Name', 16, name);
field(P(0x00, 0x10), 'Booster an/aus', 1, onOff);
field(P(0x00, 0x11), 'Booster-Typ', 1, pick(boosterTypes));
field(P(0x00, 0x21), 'Amp-Modell', 1, pick(ampModels));
field(P(0x00, 0x22), 'Preamp-Gain (intern)', 1, number);
field(P(0x00, 0x24), 'Preamp-Bass', 1, number);
field(P(0x00, 0x25), 'Preamp-Middle', 1, number);
field(P(0x00, 0x26), 'Preamp-Treble', 1, number);
field(P(0x00, 0x27), 'Preamp-Presence', 1, number);
field(P(0x00, 0x28), 'Preamp-Volume', 1, number);
field(P(0x01, 0x00), 'MOD an/aus', 1, onOff);
field(P(0x01, 0x01), 'MOD-Typ', 1, pick(modTypes));
field(P(0x03, 0x00), 'FX an/aus', 1, onOff);
field(P(0x03, 0x01), 'FX-Typ', 1, pick(modTypes));
field(P(0x05, 0x00), 'Delay an/aus', 1, onOff);
field(P(0x05, 0x01), 'Delay-Typ', 1, pick(delayTypes));
field(P(0x05, 0x20), 'Delay 2 an/aus', 1, onOff);
field(P(0x05, 0x21), 'Delay-2-Typ', 1, pick(delayTypes));
field(P(0x05, 0x40), 'Reverb an/aus', 1, onOff);
field(P(0x05, 0x41), 'Reverb-Typ', 1, pick(reverbTypes));
['Grün', 'Rot', 'Gelb'].forEach((c, i) => field(P(0x06, 0x36 + i), `Reverb-Regler ${c}`, 1, pick(reverbKnob)));
['Booster', 'MOD', 'FX', 'Delay', 'Reverb'].forEach((n, i) => field(P(0x06, 0x39 + i), `Farbe ${n}`, 1, pick(colors)));
// Type stored per colour slot (green, red, yellow), three bytes per effect from 06 24.
[
  ['Booster', boosterTypes],
  ['MOD', modTypes],
  ['FX', modTypes],
  ['Delay', delayTypes],
  ['Reverb', reverbTypes],
  ['Delay 2', delayTypes],
].forEach(([n, table], i) =>
  colors.forEach((c, j) => field(P(0x06, 0x24 + i * 3 + j), `${n}-Typ ${c}`, 1, pick(table))),
);
field(P(0x06, 0x50), 'AMP-TYPE-Schalter', 1, pick(ampKnob));
['Gain', 'Volume', 'Bass', 'Middle', 'Treble', 'Presence'].forEach((n, i) => field(P(0x06, 0x51 + i), n, 1, number));
['Booster', 'MOD', 'FX', 'Delay', 'Reverb'].forEach((n, i) => field(P(0x06, 0x57 + i), `${n}-Regler`, 1, effectKnob));
field(P(0x06, 0x5c), 'LED Variation', 1, onOff);
// Effect LEDs report the colour too: 00 off, 01 green, 02 red (seen on our amp), 03 yellow (assumed).
const led = (d) => ['aus', 'grün', 'rot', 'gelb'][d[0]] ?? `? (${hex(d)})`;
['Booster', 'MOD', 'FX', 'Delay', 'Reverb'].forEach((n, i) => field(P(0x06, 0x5d + i), `LED ${n}`, 1, led));

// Effect detail parameters (effect-params.js). MOD/FX addresses belong to one type each;
// booster, delay and reverb parameters are shared by all their types.
const EFFECT_NAMES = { booster: 'Booster', mod: 'MOD', fx: 'FX', delay: 'Delay', delay2: 'Delay 2', reverb: 'Reverb' };
for (const p of allEffectParams()) {
  const k = hex(p.address);
  if (FIELDS.has(k)) continue;
  const owner = p.key === 'mod' || p.key === 'fx' ? `${EFFECT_NAMES[p.key]} ${modTypes[p.type]}` : EFFECT_NAMES[p.key];
  FIELDS.set(k, { label: `${owner}: ${p.label}`, size: p.size, format: (d) => formatValue(p, decodeValue(p, d)) });
}

export function fieldAt(address) {
  return FIELDS.get(hex(address)) ?? null;
}

/** Short German label for a DT1 message, e.g. "Gain = 33". */
export function describe(address, data) {
  const f = fieldAt(address);
  if (f && data.length === f.size) return `${f.label} = ${f.format(data)}`;
  if (f) return `${data.length} Byte ab ${f.label}`;
  return `${data.length} Byte`;
}
