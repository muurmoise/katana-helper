// Detail parameters of each effect type: where a value lives, its range and how it reads.
// Facts from FxFloorBoard (Q2: midi.xml for addresses and ranges, stompbox_*.cpp for which
// parameters belong to which type), cross-checked with TuxKatana (Q3: params/*.yaml).
// See docs/protocol.md section 7.6. This table is our own; no code was taken over.
//
// Parameter names follow BOSS Tone Studio (English), like the amp knobs.

const P = (hi, lo) => [0x60, 0x00, hi, lo];

// ---------------------------------------------------------------- value formats

const signed = (n) => (n > 0 ? `+${n}` : String(n));

const num = (label, lo, max = 100) => ({ label, lo, kind: 'range', min: 0, max, show: String });
// 0–100 shown as -50…+50
const bip = (label, lo) => ({ label, lo, kind: 'range', min: 0, max: 100, show: (v) => signed(v - 50) });
// 0–40 shown as -20…+20 dB
const db = (label, lo) => ({ label, lo, kind: 'range', min: 0, max: 40, show: (v) => `${signed(v - 20)} dB` });
// 0–48 shown as -24…+24 semitones
const semi = (label, lo) => ({ label, lo, kind: 'range', min: 0, max: 48, show: (v) => signed(v - 24) });
const list = (label, lo, names) => ({ label, lo, kind: 'list', options: names.map((n, i) => [i, n]) });
const sw = (label, lo, names = ['Off', 'On']) => ({ ...list(label, lo, names), kind: 'switch' });
// Two bytes, value = first * 128 + second.
const wide = (label, lo, min, max, unit = '') => ({
  label,
  lo,
  kind: 'range',
  size: 2,
  min,
  max,
  show: (v) => (unit ? `${v} ${unit}` : String(v)),
});

const LOW_CUT = [
  'Flat', '20 Hz', '25 Hz', '31.5 Hz', '40 Hz', '50 Hz', '63 Hz', '80 Hz', '100 Hz', '125 Hz',
  '160 Hz', '200 Hz', '250 Hz', '315 Hz', '400 Hz', '500 Hz', '630 Hz', '800 Hz',
];
const FREQ = [
  ...LOW_CUT.slice(1),
  '1 kHz', '1.25 kHz', '1.6 kHz', '2 kHz', '2.5 kHz', '3.15 kHz', '4 kHz', '5 kHz', '6.3 kHz',
  '8 kHz', '10 kHz',
];
const HIGH_CUT = [...FREQ.slice(15), '12.5 kHz', 'Flat'];
const XOVER = FREQ.slice(7, 24);
const Q = ['0.5', '1', '2', '4', '8', '16'];
const FLANGER_LOW_CUT = ['Flat', '55 Hz', '110 Hz', '165 Hz', '200 Hz', '280 Hz', '340 Hz', '400 Hz', '500 Hz', '630 Hz', '800 Hz'];
const RATIO = [
  '1:1', '1.2:1', '1.4:1', '1.6:1', '1.8:1', '2:1', '2.3:1', '2.6:1', '3:1', '3.5:1', '4:1',
  '5:1', '6:1', '8:1', '10:1', '12:1', '20:1', '∞:1',
];
const HARMONY = [
  '-2oct', '-14th', '-13th', '-12th', '-11th', '-10th', '-9th', '-1oct', '-7th', '-6th', '-5th',
  '-4th', '-3rd', '-2nd', 'Unison', '+2nd', '+3rd', '+4th', '+5th', '+6th', '+7th', '+1oct',
  '+9th', '+10th', '+11th', '+12th', '+13th', '+14th', '+2oct', 'User',
];
const WAH = ['Cry Wah', 'VO Wah', 'Fat Wah', 'Light Wah', '7String Wah', 'Reso Wah'];
const PS_MODE = ['Fast', 'Medium', 'Slow', 'Mono'];
const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const GEQ_BANDS = ['31 Hz', '62 Hz', '125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz', '8 kHz', '16 kHz'];

// ---------------------------------------------------------------- MOD / FX
// `lo` = offset from the start of the MOD block (60 00 01 00). The FX block is the same
// layout at 60 00 03 00 (protocol.md 7.2). Offsets above 7F continue in 60 00 02 xx.

const M = (hi, lo) => (hi - 0x01) * 128 + lo;

/** MOD/FX parameters per type value (protocol.md table 9.3). */
export const MOD_PARAMS = {
  0x00: [ // T.Wah
    sw('Mode', M(1, 0x02), ['LPF', 'BPF']),
    sw('Polarity', M(1, 0x03), ['Down', 'Up']),
    num('Sens', M(1, 0x04)),
    num('Frequency', M(1, 0x05)),
    num('Peak', M(1, 0x06)),
    num('Direct Mix', M(1, 0x07)),
    num('Effect Level', M(1, 0x08)),
  ],
  0x01: [ // Auto Wah
    sw('Mode', M(1, 0x09), ['LPF', 'BPF']),
    num('Frequency', M(1, 0x0a)),
    num('Peak', M(1, 0x0b)),
    num('Rate', M(1, 0x0c)),
    num('Depth', M(1, 0x0d)),
    num('Direct Mix', M(1, 0x0e)),
    num('Effect Level', M(1, 0x0f)),
  ],
  0x02: [ // Pedal Wah
    list('Wah Type', M(1, 0x10), WAH),
    num('Pedal Position', M(1, 0x11)),
    num('Pedal Min', M(1, 0x12)),
    num('Pedal Max', M(1, 0x13)),
    num('Effect Level', M(1, 0x14)),
    num('Direct Mix', M(1, 0x15)),
  ],
  0x03: [ // Compressor
    list('Comp Type', M(1, 0x16), ['BOSS Comp', 'Hi-Band', 'Light', 'D-Comp', 'Orange', 'Fat', 'Mild']),
    num('Sustain', M(1, 0x17)),
    num('Attack', M(1, 0x18)),
    bip('Tone', M(1, 0x19)),
    num('Effect Level', M(1, 0x1a)),
  ],
  0x04: [ // Limiter
    list('Limiter Type', M(1, 0x1b), ['BOSS Limiter', 'Rack 160D', 'Vtg Rack U']),
    num('Attack', M(1, 0x1c)),
    num('Threshold', M(1, 0x1d)),
    list('Ratio', M(1, 0x1e), RATIO),
    num('Release', M(1, 0x1f)),
    num('Effect Level', M(1, 0x20)),
  ],
  0x06: [ // Graphic EQ
    ...GEQ_BANDS.map((band, i) => db(band, M(1, 0x21 + i))),
    db('Level', M(1, 0x2b)),
  ],
  0x07: [ // Para EQ
    list('Low Cut', M(1, 0x2c), LOW_CUT),
    db('Low Gain', M(1, 0x2d)),
    list('Low-Mid Freq', M(1, 0x2e), FREQ),
    list('Low-Mid Q', M(1, 0x2f), Q),
    db('Low-Mid Gain', M(1, 0x30)),
    list('High-Mid Freq', M(1, 0x31), FREQ),
    list('High-Mid Q', M(1, 0x32), Q),
    db('High-Mid Gain', M(1, 0x33)),
    db('High Gain', M(1, 0x34)),
    list('High Cut', M(1, 0x35), HIGH_CUT),
    db('Level', M(1, 0x36)),
  ],
  0x09: [ // Guitar Sim
    list('Sim Type', M(1, 0x37), ['S→H', 'H→S', 'H→HF', 'S→Hollow', 'H→Hollow', 'S→AC', 'H→AC', 'P→AC']),
    bip('Low', M(1, 0x38)),
    bip('High', M(1, 0x39)),
    num('Level', M(1, 0x3a)),
    num('Body', M(1, 0x3b)),
  ],
  0x0a: [ // Slow Gear
    num('Sens', M(1, 0x3c)),
    num('Rise Time', M(1, 0x3d)),
    num('Level', M(1, 0x3e)),
  ],
  0x0c: [ // Wave Synth
    sw('Wave', M(1, 0x3f), ['Saw', 'Square']),
    num('Cutoff Freq', M(1, 0x40)),
    num('Resonance', M(1, 0x41)),
    num('Filter Sens', M(1, 0x42)),
    num('Filter Decay', M(1, 0x43)),
    num('Filter Depth', M(1, 0x44)),
    num('Synth Level', M(1, 0x45)),
    num('Direct Mix', M(1, 0x46)),
  ],
  0x0e: [ // Octave
    list('Range', M(1, 0x47), ['1', '2', '3', '4']),
    num('Octave Level', M(1, 0x48)),
    num('Direct Mix', M(1, 0x49)),
  ],
  0x0f: [ // Pitch Shifter
    sw('Voice', M(1, 0x4a), ['1-Voice', '2-Mono']),
    list('PS1 Mode', M(1, 0x4b), PS_MODE),
    semi('PS1 Pitch', M(1, 0x4c)),
    bip('PS1 Fine', M(1, 0x4d)),
    wide('PS1 Pre Delay', M(1, 0x4e), 0, 300, 'ms'),
    num('PS1 Level', M(1, 0x50)),
    list('PS2 Mode', M(1, 0x51), PS_MODE),
    semi('PS2 Pitch', M(1, 0x52)),
    bip('PS2 Fine', M(1, 0x53)),
    wide('PS2 Pre Delay', M(1, 0x54), 0, 300, 'ms'),
    num('PS2 Level', M(1, 0x56)),
    num('Feedback', M(1, 0x57)),
    num('Direct Mix', M(1, 0x58)),
  ],
  0x10: [ // Harmonist (user scales 01 64–01 7B are left out)
    sw('Voice', M(1, 0x59), ['1-Voice', '2-Voice']),
    list('HR1 Harmony', M(1, 0x5a), HARMONY),
    wide('HR1 Pre Delay', M(1, 0x5b), 0, 300, 'ms'),
    num('HR1 Level', M(1, 0x5d)),
    list('HR2 Harmony', M(1, 0x5e), HARMONY),
    wide('HR2 Pre Delay', M(1, 0x5f), 0, 300, 'ms'),
    num('HR2 Level', M(1, 0x61)),
    num('Feedback', M(1, 0x62)),
    num('Direct Mix', M(1, 0x63)),
  ],
  0x12: [ // AC Processor
    list('AC Type', M(1, 0x7c), ['Small', 'Medium', 'Bright', 'Power']),
    bip('Bass', M(1, 0x7d)),
    bip('Middle', M(1, 0x7e)),
    list('Middle Freq', M(1, 0x7f), FREQ),
    bip('Treble', M(2, 0x00)),
    bip('Presence', M(2, 0x01)),
    num('Level', M(2, 0x02)),
  ],
  0x13: [ // Phaser
    list('Phaser Type', M(2, 0x03), ['4 Stage', '8 Stage', '12 Stage', 'Bi-Phase']),
    num('Rate', M(2, 0x04)),
    num('Depth', M(2, 0x05)),
    num('Manual', M(2, 0x06)),
    num('Resonance', M(2, 0x07)),
    { label: 'Step Rate', lo: M(2, 0x08), kind: 'range', min: 0, max: 101, show: (v) => (v === 0 ? 'Off' : String(v - 1)) },
    num('Effect Level', M(2, 0x09)),
    num('Direct Mix', M(2, 0x0a)),
  ],
  0x14: [ // Flanger
    num('Rate', M(2, 0x0b)),
    num('Depth', M(2, 0x0c)),
    num('Manual', M(2, 0x0d)),
    num('Resonance', M(2, 0x0e)),
    list('Low Cut', M(2, 0x10), FLANGER_LOW_CUT),
    num('Effect Level', M(2, 0x11)),
    num('Direct Mix', M(2, 0x12)),
  ],
  0x15: [ // Tremolo
    num('Wave Shape', M(2, 0x13)),
    num('Rate', M(2, 0x14)),
    num('Depth', M(2, 0x15)),
    num('Level', M(2, 0x16)),
  ],
  0x16: [ // Rotary
    num('Rate', M(2, 0x19)),
    num('Rise Time', M(2, 0x1a)),
    num('Fall Time', M(2, 0x1b)),
    num('Depth', M(2, 0x1c)),
    num('Level', M(2, 0x1d)),
  ],
  0x17: [ // Uni-V
    num('Rate', M(2, 0x1e)),
    num('Depth', M(2, 0x1f)),
    num('Level', M(2, 0x20)),
  ],
  0x19: [ // Slicer
    list('Pattern', M(2, 0x21), Array.from({ length: 20 }, (_, i) => `P${i + 1}`)),
    num('Rate', M(2, 0x22)),
    num('Trigger Sens', M(2, 0x23)),
    num('Effect Level', M(2, 0x24)),
    num('Direct Mix', M(2, 0x25)),
  ],
  0x1a: [ // Vibrato
    num('Rate', M(2, 0x26)),
    num('Depth', M(2, 0x27)),
    num('Level', M(2, 0x2a)),
  ],
  0x1b: [ // Ring Mod
    sw('Mode', M(2, 0x2b), ['Normal', 'Intelligent']),
    num('Frequency', M(2, 0x2c)),
    num('Effect Level', M(2, 0x2d)),
    num('Direct Mix', M(2, 0x2e)),
  ],
  0x1c: [ // Humanizer
    sw('Mode', M(2, 0x2f), ['Picking', 'Auto']),
    list('Vowel 1', M(2, 0x30), VOWELS),
    list('Vowel 2', M(2, 0x31), VOWELS),
    num('Sens', M(2, 0x32)),
    num('Rate', M(2, 0x33)),
    num('Depth', M(2, 0x34)),
    num('Manual', M(2, 0x35)),
    num('Level', M(2, 0x36)),
  ],
  0x1d: [ // 2x2 Chorus
    list('Xover Freq', M(2, 0x37), XOVER),
    num('Low Rate', M(2, 0x38)),
    num('Low Depth', M(2, 0x39)),
    { label: 'Low Pre Delay', lo: M(2, 0x3a), kind: 'range', min: 0, max: 80, show: (v) => `${(v / 2).toFixed(1)} ms` },
    num('Low Level', M(2, 0x3b)),
    num('High Rate', M(2, 0x3c)),
    num('High Depth', M(2, 0x3d)),
    { label: 'High Pre Delay', lo: M(2, 0x3e), kind: 'range', min: 0, max: 80, show: (v) => `${(v / 2).toFixed(1)} ms` },
    num('High Level', M(2, 0x3f)),
    num('Direct Mix', M(2, 0x40)),
  ],
  0x1f: [ // AC Guitar Sim
    bip('Top', M(2, 0x41)),
    num('Body', M(2, 0x42)),
    bip('Low', M(2, 0x43)),
    bip('High', M(2, 0x44)),
    num('Level', M(2, 0x45)),
  ],
  0x23: [ // Phaser 90E
    sw('Script', M(2, 0x46)),
    num('Speed', M(2, 0x47)),
  ],
  0x24: [ // Flanger 117E
    num('Manual', M(2, 0x48)),
    num('Width', M(2, 0x49)),
    num('Speed', M(2, 0x4a)),
    num('Regen', M(2, 0x4b)),
  ],
  0x25: [ // Wah 95E
    num('Pedal Position', M(2, 0x4c)),
    num('Pedal Min', M(2, 0x4d)),
    num('Pedal Max', M(2, 0x4e)),
    num('Effect Level', M(2, 0x4f)),
    num('Direct Mix', M(2, 0x50)),
  ],
  0x26: [ // Delay Chorus 30 (DC-30)
    sw('Selector', M(2, 0x51), ['Chorus', 'Echo']),
    num('Input Volume', M(2, 0x52)),
    num('Chorus Intensity', M(2, 0x53)),
    wide('Echo Repeat Rate', M(2, 0x54), 40, 600),
    num('Echo Intensity', M(2, 0x56)),
    num('Echo Volume', M(2, 0x57)),
    num('Tone', M(2, 0x58)),
    sw('Output', M(2, 0x59), ['D+E', 'D/E']),
  ],
  0x27: [ // Heavy Octave
    num('-1 Oct Level', M(2, 0x5a)),
    num('-2 Oct Level', M(2, 0x5b)),
    num('Direct Mix', M(2, 0x5c)),
  ],
  0x28: [ // Pedal Bend
    semi('Pitch', M(2, 0x5d)),
    num('Pedal Position', M(2, 0x5e)),
    num('Effect Level', M(2, 0x5f)),
    num('Direct Mix', M(2, 0x60)),
  ],
};

// ---------------------------------------------------------------- booster
// `lo` = offset from 60 00 00 10.

const BOOSTER_PARAMS = [
  num('Drive', 0x02, 120),
  bip('Bottom', 0x03),
  bip('Tone', 0x04),
  num('Effect Level', 0x07),
  num('Direct Mix', 0x08),
  sw('Solo', 0x05),
  num('Solo Level', 0x06),
];

// ---------------------------------------------------------------- delay
// `lo` = offset from 60 00 05 00 (Delay 1). Delay 2 is the same layout at 60 00 05 20.

const D = {
  time: wide('Time', 0x02, 1, 2000, 'ms'),
  feedback: num('Feedback', 0x04),
  highCut: list('High Cut', 0x05, HIGH_CUT),
  effect: num('Effect Level', 0x06, 120),
  direct: num('Direct Mix', 0x07),
  tap: { ...num('Tap Time', 0x08), show: (v) => `${v} %` },
  d1Time: wide('D1 Time', 0x09, 1, 1000, 'ms'),
  d1Feedback: num('D1 Feedback', 0x0b),
  d1HighCut: list('D1 High Cut', 0x0c, HIGH_CUT),
  d1Effect: num('D1 Effect Level', 0x0d, 120),
  d2Time: wide('D2 Time', 0x0e, 1, 1000, 'ms'),
  d2Feedback: num('D2 Feedback', 0x10),
  d2HighCut: list('D2 High Cut', 0x11, HIGH_CUT),
  d2Effect: num('D2 Effect Level', 0x12, 120),
  modRate: num('Mod Rate', 0x13),
  modDepth: num('Mod Depth', 0x14),
  vintageLpf: sw('Vintage LPF', 0x15),
  filter: sw('Filter', 0x16, ['8 kHz', '17 kHz']),
  fbPhase: sw('Feedback Phase', 0x17, ['Normal', 'Inverse']),
  effectPhase: sw('Effect Phase', 0x18, ['Normal', 'Inverse']),
  modSwitch: sw('Modulation', 0x19),
};
const SIMPLE = [D.time, D.feedback, D.highCut, D.effect, D.direct];
const DUAL = [D.d1Time, D.d1Feedback, D.d1HighCut, D.d1Effect, D.d2Time, D.d2Feedback, D.d2HighCut, D.d2Effect, D.direct];

/** Delay parameters per type value (protocol.md table 9.4). */
const DELAY_PARAMS = {
  0x00: SIMPLE, // Digital
  0x01: [D.time, D.feedback, D.tap, D.highCut, D.effect, D.direct], // Pan
  0x02: [D.time, D.feedback, D.d1HighCut, D.effect, D.direct], // Stereo: Q2 uses the D1 high cut here
  0x03: DUAL,
  0x04: DUAL,
  0x05: DUAL,
  0x06: SIMPLE, // Reverse
  0x07: SIMPLE, // Analog
  0x08: SIMPLE, // Tape Echo
  0x09: [D.time, D.feedback, D.modRate, D.modDepth, D.highCut, D.effect, D.direct], // Modulate
  0x0a: [D.time, D.feedback, D.vintageLpf, D.filter, D.modSwitch, D.fbPhase, D.effectPhase, D.modRate, D.modDepth, D.effect, D.direct], // SDE-3000
};

// ---------------------------------------------------------------- reverb
// `lo` = offset from 60 00 05 40.

const REVERB_COMMON = [
  { label: 'Time', lo: 0x02, kind: 'range', min: 0, max: 99, show: (v) => `${((v + 1) / 10).toFixed(1)} s` },
  wide('Pre Delay', 0x03, 0, 500, 'ms'),
  list('Low Cut', 0x05, LOW_CUT),
  list('High Cut', 0x06, HIGH_CUT),
  num('Density', 0x07, 10),
  num('Effect Level', 0x08),
  num('Direct Mix', 0x09),
];
const REVERB_PARAMS = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((t) => [t, t === 5 ? [...REVERB_COMMON, num('Spring Color', 0x0b)] : REVERB_COMMON]),
);

// ---------------------------------------------------------------- lookup

/** Block start (absolute address in 7-bit steps) and parameter table per effect key. */
const BLOCKS = {
  booster: { base: P(0x00, 0x10), table: Object.fromEntries(Array.from({ length: 0x18 }, (_, t) => [t, BOOSTER_PARAMS])) },
  mod: { base: P(0x01, 0x00), table: MOD_PARAMS },
  fx: { base: P(0x03, 0x00), table: MOD_PARAMS },
  delay: { base: P(0x05, 0x00), table: DELAY_PARAMS },
  delay2: { base: P(0x05, 0x20), table: DELAY_PARAMS },
  reverb: { base: P(0x05, 0x40), table: REVERB_PARAMS },
};

/** Address `offset` steps (7-bit) after `base`. */
export function offsetAddress(base, offset) {
  const lo = base[3] + offset;
  return [base[0], base[1], base[2] + Math.floor(lo / 128), lo % 128];
}

/**
 * Parameters for effect `key` with type value `type`: [{ label, address, kind, size,
 * min, max, show(value), options }]. Empty if the type has no known parameters.
 */
export function effectParams(key, type) {
  const block = BLOCKS[key];
  const params = block?.table[type];
  if (!params) return [];
  return params.map((p) => ({ size: 1, ...p, address: offsetAddress(block.base, p.lo) }));
}

/** Every effect parameter with the effect key and type it belongs to (for labels and tests). */
export function allEffectParams() {
  const out = [];
  for (const [key, block] of Object.entries(BLOCKS)) {
    for (const type of Object.keys(block.table)) {
      for (const p of effectParams(key, Number(type))) out.push({ ...p, key, type: Number(type) });
    }
  }
  return out;
}

/** Bytes for a value: one byte, or two for wide values (value = first * 128 + second). */
export function encodeValue(param, value) {
  return param.size === 2 ? [Math.floor(value / 128), value % 128] : [value];
}

/** Value from bytes (undefined if a byte is missing). */
export function decodeValue(param, bytes) {
  if (bytes.some((b) => b === undefined)) return undefined;
  return param.size === 2 ? bytes[0] * 128 + bytes[1] : bytes[0];
}

/** Text for a value, e.g. "+12", "450 ms", "Flat". */
export function formatValue(param, value) {
  if (value === undefined) return '–';
  if (param.options) return param.options.find(([v]) => v === value)?.[1] ?? `? (${value})`;
  return param.show(value);
}

/** Byte span of each effect block, for reading a whole block back at once. */
export const BLOCK_SPANS = {
  booster: { address: P(0x00, 0x10), size: 0x0f },
  mod: { address: P(0x01, 0x00), size: M(2, 0x61) },
  fx: { address: P(0x03, 0x00), size: M(2, 0x61) },
  delay: { address: P(0x05, 0x00), size: 0x1a },
  delay2: { address: P(0x05, 0x20), size: 0x1a },
  reverb: { address: P(0x05, 0x40), size: 0x0c },
};
