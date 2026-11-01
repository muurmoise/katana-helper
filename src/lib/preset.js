// Readable presets ("katana-helper-preset"): named settings instead of bytes, so a person or
// a language model (Claude, ChatGPT) can write one. Format and rules: docs/preset-guide.md.
//
// presetToPatch() checks a preset and turns it into a patch map (offset → byte) with only
// the bytes the preset sets. The library stores that map; "Laden" writes it into the
// temporary patch on top of the current sound. patchToPreset() turns a whole patch back into
// a preset, e.g. to show a model a real sound.
//
// Addresses: docs/protocol.md 6, 7 and 7.7.

import { TABLES } from './describe.js';
import { PARAM_KINDS, VALUE_LISTS, decodeValue, effectParams, encodeValue, fromRaw, rangeText, toRaw } from './effect-params.js';
import { AMP, EFFECTS, KNOBS, PATCH_BASE, REVERB_LAYER, nameBytes, patchName } from './patch.js';
import { fromBase128 } from './sysex.js';

export const PRESET_FORMAT = 'katana-helper-preset';
export const PRESET_VERSION = 1;

const P = (hi, lo) => [0x60, 0x00, hi, lo];
const offsetOf = (address) => fromBase128(address) - PATCH_BASE;
const norm = (text) => String(text ?? '').toLowerCase().replace(/[\s_]+/g, '');

const { num, bip, db, halfDb, list } = PARAM_KINDS;
const { LOW_CUT, FREQ, HIGH_CUT, Q } = VALUE_LISTS;

// ---------------------------------------------------------------- amp

/** AMP TYPE switch positions (06 50). */
export const AMP_TYPES = ['Acoustic', 'Clean', 'Crunch', 'Lead', 'Brown'];

/**
 * Switch position written together with each amp model. Panel and variation models belong
 * to their position; for the other models it is our choice by character (docs/preset-guide.md).
 */
const MODEL_SWITCH = {
  0x01: 0, 0x1c: 0, // Acoustic
  0x08: 1, 0x1d: 1, 0x00: 1, 0x09: 1, // Clean, Natural Clean, Clean Twin
  0x0b: 2, 0x1e: 2, 0x02: 2, 0x0a: 2, 0x0c: 2, 0x03: 2, 0x0d: 2, 0x11: 2, 0x0f: 2, 0x12: 2, 0x13: 2,
  0x18: 3, 0x1f: 3, 0x05: 3, 0x0e: 3, 0x10: 3, 0x06: 3, 0x16: 3,
  0x17: 4, 0x20: 4, 0x04: 4, 0x14: 4, 0x15: 4, 0x07: 4,
};

const AMP_MODEL_LIST = Object.entries(TABLES.ampModels).map(([v, name]) => [Number(v), name]);

/** Find an entry of [value, name] by name; "Brown" also finds "Brown (Panel)". */
function byName(entries, text) {
  const n = norm(text);
  return (
    entries.find(([, name]) => norm(name) === n) ??
    entries.find(([, name]) => norm(name.replace(/\s*\(panel\)$/i, '')) === n) ??
    null
  );
}

// ---------------------------------------------------------------- effects

const COLOR_NAMES = ['green', 'red', 'yellow'];
const COLOR_ALIASES = { green: 0, grün: 0, gruen: 0, red: 1, rot: 1, yellow: 2, gelb: 2 };
const KNOB_DEFAULT = 50;
const EFFECT = Object.fromEntries(EFFECTS.map((fx) => [fx.key, fx]));
const REVERB_KNOB = [
  [0, 'Delay'],
  [1, 'Delay+Reverb'],
  [2, 'Reverb'],
];

// ---------------------------------------------------------------- other patch sections
// Each: address of the parameters plus the parameter table (same builders as the effects).

const withAddress = (params, base) => params.map((p) => ({ size: 1, ...p, address: P(base[0], base[1] + p.lo) }));

const PEQ = (lo) => [
  list('Low Cut', lo + 0, LOW_CUT),
  db('Low Gain', lo + 1),
  list('Low-Mid Freq', lo + 2, FREQ),
  list('Low-Mid Q', lo + 3, Q),
  db('Low-Mid Gain', lo + 4),
  list('High-Mid Freq', lo + 5, FREQ),
  list('High-Mid Q', lo + 6, Q),
  db('High-Mid Gain', lo + 7),
  db('High Gain', lo + 8),
  list('High Cut', lo + 9, HIGH_CUT),
  db('Level', lo + 10),
];
const GEQ_BANDS = ['31 Hz', '62 Hz', '125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz', '8 kHz', '16 kHz'];
const GEQ = (lo) => [...GEQ_BANDS.map((b, i) => halfDb(b, lo + i)), halfDb('Level', lo + 10)];

/** Patch EQ 1 (00 40–57) and EQ 2 (00 60–77), position 06 22 / 06 19 (protocol.md 7.7). */
const EQS = {
  eq1: { on: P(0x00, 0x40), type: P(0x00, 0x41), position: P(0x06, 0x22), parametric: withAddress(PEQ(0x02), [0x00, 0x40]), graphic: withAddress(GEQ(0x0d), [0x00, 0x40]) },
  eq2: { on: P(0x00, 0x60), type: P(0x00, 0x61), position: P(0x06, 0x19), parametric: withAddress(PEQ(0x02), [0x00, 0x60]), graphic: withAddress(GEQ(0x0d), [0x00, 0x60]) },
};
const EQ_TYPES = [
  [0, 'Parametric'],
  [1, 'Graphic'],
];
const EQ_POSITIONS = [
  [0, 'Amp In'],
  [1, 'Amp Out'],
];

const NOISE_SUPPRESSOR = { on: P(0x05, 0x66), params: withAddress([num('Threshold', 0x67), num('Release', 0x68)], [0x05, 0x00]) };
const CONTOUR = { on: P(0x06, 0x16), type: P(0x06, 0x17) };
const CAB_RESONANCE = { address: P(0x06, 0x43), options: ['Vintage', 'Modern', 'Deep'] };
const PATCH_LEVEL = withAddress([num('Patch Level', 0x70)], [0x05, 0x00])[0];

/** Top-level keys a preset may have. */
const KEYS = [
  'format', 'formatVersion', 'name', 'description', 'amp',
  ...EFFECTS.map((fx) => fx.key),
  'noiseSuppressor', 'eq1', 'eq2', 'contour', 'cabResonance', 'patchLevel',
];

// ---------------------------------------------------------------- preset → patch

class PresetError extends Error {
  constructor(problems) {
    super(`Preset ungültig:\n- ${problems.join('\n- ')}`);
    this.name = 'PresetError';
    this.problems = problems;
  }
}

/**
 * Check a preset and turn it into a patch map with the bytes it sets.
 * Returns { map, name, description, warnings }. Throws PresetError listing every problem.
 */
export function presetToPatch(preset) {
  const errors = [];
  const warnings = [];
  const map = new Map();
  const set = (address, bytes) => bytes.forEach((b, i) => map.set(offsetOf(address) + i, b));
  const check = (path, fn) => {
    try {
      return fn();
    } catch (e) {
      errors.push(`${path}: ${e.message}`);
      return undefined;
    }
  };
  const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const pick = (entries, text) => {
    if (text === undefined) throw new RangeError('fehlt');
    const hit = byName(entries, text);
    if (!hit) throw new RangeError(`„${text}“ gibt es nicht. Erlaubt: ${entries.map(([, n]) => n).join(', ')}`);
    return hit[0];
  };
  const bool = (path, v) => {
    if (typeof v !== 'boolean') errors.push(`${path}: true oder false erwartet`);
    return v === true;
  };
  const percent = (path, v, fallback) => {
    if (v === undefined) return fallback;
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      errors.push(`${path}: ganze Zahl 0 … 100 erwartet, nicht ${JSON.stringify(v)}`);
      return fallback;
    }
    return v;
  };

  if (!isObject(preset)) throw new PresetError(['Preset muss ein JSON-Objekt sein']);
  if (preset.format !== PRESET_FORMAT) errors.push(`format: "${PRESET_FORMAT}" erwartet`);
  if (preset.formatVersion !== undefined && preset.formatVersion !== PRESET_VERSION) {
    errors.push(`formatVersion: ${PRESET_VERSION} erwartet`);
  }
  for (const key of Object.keys(preset)) {
    if (!KEYS.includes(key)) errors.push(`${key}: unbekannter Abschnitt. Erlaubt: ${KEYS.join(', ')}`);
  }

  // name (16 ASCII characters at 60 00 00 00)
  const name = typeof preset.name === 'string' ? preset.name.trim() : '';
  if (!name) errors.push('name: fehlt');
  else {
    if (name.length > 16) warnings.push(`name: „${name}“ hat mehr als 16 Zeichen und wird gekürzt`);
    if (/[^\x20-\x7e]/.test(name)) warnings.push('name: Umlaute und Sonderzeichen werden am Amp zu „?“');
    set(P(0x00, 0x00), nameBytes(name));
  }

  // amp
  const amp = preset.amp;
  if (!isObject(amp)) errors.push('amp: fehlt');
  else {
    for (const key of Object.keys(amp)) {
      if (key !== 'model' && !KNOBS.some((k) => k.key === key)) errors.push(`amp.${key}: unbekannt. Erlaubt: model, ${KNOBS.map((k) => k.key).join(', ')}`);
    }
    const model = check('amp.model', () => pick(AMP_MODEL_LIST, amp.model));
    if (model !== undefined) {
      set(AMP.typeKnob, [MODEL_SWITCH[model]]);
      set(AMP.model, [model]);
    }
    for (const knob of KNOBS) {
      if (amp[knob.key] === undefined) {
        warnings.push(`amp.${knob.key}: fehlt, bleibt wie im aktuellen Klang`);
        continue;
      }
      const v = percent(`amp.${knob.key}`, amp[knob.key]);
      if (v !== undefined) set(knob.address, [v]);
    }
  }

  // effects
  const sections = Object.fromEntries(EFFECTS.map((fx) => [fx.key, preset[fx.key]]));
  const colorOf = (key) => {
    const c = sections[key]?.color;
    if (c === undefined) return 0;
    const v = COLOR_ALIASES[norm(c)];
    if (v === undefined) errors.push(`${key}.color: green, red oder yellow erwartet, nicht „${c}“`);
    return v ?? 0;
  };
  // Reverb and Delay 2 share one colour button.
  const reverbColor = sections.reverb?.color !== undefined ? colorOf('reverb') : colorOf('delay2');
  if (sections.reverb?.color !== undefined && sections.delay2?.color !== undefined && norm(sections.reverb.color) !== norm(sections.delay2.color)) {
    errors.push('delay2.color: Delay 2 und Reverb teilen sich die Farbe, bitte gleich setzen oder bei delay2 weglassen');
  }
  if (sections.reverb || sections.delay2) set(EFFECT.reverb.color, [reverbColor]);

  for (const fx of EFFECTS) {
    const key = fx.key;
    const sec = sections[key];
    if (sec === undefined) {
      set(fx.on, [0]); // missing effect = off
      continue;
    }
    if (!isObject(sec)) {
      errors.push(`${key}: Objekt erwartet`);
      continue;
    }
    const allowed = ['on', 'type', 'color', 'knob', 'params', ...(key === 'reverb' ? ['knobControls'] : [])];
    for (const k of Object.keys(sec)) if (!allowed.includes(k)) errors.push(`${key}.${k}: unbekannt. Erlaubt: ${allowed.join(', ')}`);
    const on = bool(`${key}.on`, sec.on);
    set(fx.on, [on ? 1 : 0]);
    if (sec.type === undefined) {
      if (on) errors.push(`${key}.type: fehlt`);
      continue;
    }
    const type = check(`${key}.type`, () => pick(fx.types, sec.type));
    if (type === undefined) continue;
    const color = fx.key === 'reverb' || fx.shares ? reverbColor : colorOf(key);
    set(fx.type, [type]);
    set(fx.slots[color], [type]);
    set(fx.color, [color]);

    const params = effectParams(key, type);
    const given = sec.params ?? {};
    if (!isObject(given)) {
      errors.push(`${key}.params: Objekt erwartet`);
      continue;
    }
    for (const [label, value] of Object.entries(given)) {
      const p = params.find((x) => norm(x.label) === norm(label));
      if (!p) {
        errors.push(`${key}.params.${label}: gibt es bei ${fx.types.find(([v]) => v === type)[1]} nicht. Erlaubt: ${params.map((x) => x.label).join(', ')}`);
        continue;
      }
      const raw = check(`${key}.params.${label}`, () => toRaw(p, value));
      if (raw !== undefined) set(p.address, encodeValue(p, raw));
    }
    if (on) {
      const missing = params.filter((p) => !Object.keys(given).some((l) => norm(l) === norm(p.label)));
      if (missing.length) warnings.push(`${key}.params: ${missing.map((p) => p.label).join(', ')} fehlt, bleibt wie im aktuellen Klang`);
    }
  }

  // Effect knobs on the panel: 00 = off, otherwise knob + 1. Delay 2 uses the reverb knob.
  for (const fx of EFFECTS.filter((f) => !f.shares)) {
    const own = sections[fx.key];
    const partner = fx.key === 'reverb' ? sections.delay2 : undefined;
    const on = own?.on === true || partner?.on === true;
    const knob = percent(`${fx.key}.knob`, own?.knob ?? partner?.knob, KNOB_DEFAULT);
    set(fx.knob, [on ? knob + 1 : 0]);
  }

  // What the reverb knob controls, for the reverb colour.
  if (sections.reverb || sections.delay2) {
    const control = sections.reverb?.knobControls;
    let value;
    if (control !== undefined) value = check('reverb.knobControls', () => pick(REVERB_KNOB, control));
    else {
      const rev = sections.reverb?.on === true;
      const d2 = sections.delay2?.on === true;
      value = rev && d2 ? 1 : d2 ? 0 : 2;
    }
    if (value !== undefined) set(REVERB_LAYER.slots[reverbColor], [value]);
  }

  // noise suppressor (missing = off)
  const ns = preset.noiseSuppressor;
  if (ns === undefined) set(NOISE_SUPPRESSOR.on, [0]);
  else if (isObject(ns)) {
    for (const k of Object.keys(ns)) if (!['on', 'threshold', 'release'].includes(k)) errors.push(`noiseSuppressor.${k}: unbekannt. Erlaubt: on, threshold, release`);
    set(NOISE_SUPPRESSOR.on, [bool('noiseSuppressor.on', ns.on) ? 1 : 0]);
    NOISE_SUPPRESSOR.params.forEach((p) => {
      const key = norm(p.label);
      if (ns[key] === undefined) {
        if (ns.on) warnings.push(`noiseSuppressor.${key}: fehlt, bleibt wie im aktuellen Klang`);
        return;
      }
      const v = percent(`noiseSuppressor.${key}`, ns[key]);
      if (v !== undefined) set(p.address, [v]);
    });
  } else errors.push('noiseSuppressor: Objekt erwartet');

  // EQ 1 / EQ 2 (missing = off)
  for (const [key, eq] of Object.entries(EQS)) {
    const sec = preset[key];
    if (sec === undefined) {
      set(eq.on, [0]);
      continue;
    }
    if (!isObject(sec)) {
      errors.push(`${key}: Objekt erwartet`);
      continue;
    }
    for (const k of Object.keys(sec)) if (!['on', 'type', 'position', 'params'].includes(k)) errors.push(`${key}.${k}: unbekannt. Erlaubt: on, type, position, params`);
    const on = bool(`${key}.on`, sec.on);
    set(eq.on, [on ? 1 : 0]);
    if (sec.position !== undefined) {
      const pos = check(`${key}.position`, () => pick(EQ_POSITIONS, sec.position));
      if (pos !== undefined) set(eq.position, [pos]);
    }
    if (sec.type === undefined) {
      if (on) errors.push(`${key}.type: fehlt (Parametric oder Graphic)`);
      continue;
    }
    const type = check(`${key}.type`, () => pick(EQ_TYPES, sec.type));
    if (type === undefined) continue;
    set(eq.type, [type]);
    const params = type === 0 ? eq.parametric : eq.graphic;
    const given = isObject(sec.params) ? sec.params : {};
    for (const [label, value] of Object.entries(given)) {
      const p = params.find((x) => norm(x.label) === norm(label));
      if (!p) {
        errors.push(`${key}.params.${label}: gibt es bei ${EQ_TYPES[type][1]} nicht. Erlaubt: ${params.map((x) => x.label).join(', ')}`);
        continue;
      }
      const raw = check(`${key}.params.${label}`, () => toRaw(p, value));
      if (raw !== undefined) set(p.address, [raw]);
    }
    if (on) {
      const missing = params.filter((p) => !Object.keys(given).some((l) => norm(l) === norm(p.label)));
      if (missing.length) warnings.push(`${key}.params: ${missing.map((p) => p.label).join(', ')} fehlt, bleibt wie im aktuellen Klang`);
    }
  }

  // contour (missing = off)
  const contour = preset.contour;
  if (contour === undefined) set(CONTOUR.on, [0]);
  else if (isObject(contour)) {
    for (const k of Object.keys(contour)) if (!['on', 'type'].includes(k)) errors.push(`contour.${k}: unbekannt. Erlaubt: on, type`);
    set(CONTOUR.on, [bool('contour.on', contour.on) ? 1 : 0]);
    if (contour.type !== undefined) {
      if (![1, 2, 3].includes(contour.type)) errors.push('contour.type: 1, 2 oder 3 erwartet');
      else set(CONTOUR.type, [contour.type - 1]);
    } else if (contour.on) errors.push('contour.type: fehlt (1, 2 oder 3)');
  } else errors.push('contour: Objekt erwartet');

  // cab resonance and patch level (missing = unchanged)
  if (preset.cabResonance !== undefined) {
    const entries = CAB_RESONANCE.options.map((n, i) => [i, n]);
    const v = check('cabResonance', () => pick(entries, preset.cabResonance));
    if (v !== undefined) set(CAB_RESONANCE.address, [v]);
  }
  if (preset.patchLevel !== undefined) {
    const v = percent('patchLevel', preset.patchLevel);
    if (v !== undefined) set(PATCH_LEVEL.address, [v]);
  }

  if (errors.length) throw new PresetError(errors);
  return { map, name: patchName(map), description: typeof preset.description === 'string' ? preset.description : '', warnings };
}

// ---------------------------------------------------------------- patch → preset

/** Display value of a raw value, or undefined when the raw value is out of range. */
function shown(p, raw) {
  if (raw === undefined) return undefined;
  if (!p.options && (raw < p.min || raw > p.max)) return undefined;
  return fromRaw(p, raw);
}

/** Readable preset from a whole patch map (offset → byte). Unknown values are left out. */
export function patchToPreset(map, { description } = {}) {
  const at = (address) => map.get(offsetOf(address));
  const bytesAt = (p) => Array.from({ length: p.size ?? 1 }, (_, i) => map.get(offsetOf(p.address) + i));
  const preset = { format: PRESET_FORMAT, formatVersion: PRESET_VERSION, name: patchName(map) };
  if (description) preset.description = description;

  preset.amp = { model: TABLES.ampModels[at(AMP.model)] };
  for (const k of KNOBS) if (at(k.address) <= 100) preset.amp[k.key] = at(k.address);

  const reverbColor = at(EFFECT.reverb.color) ?? 0;
  for (const fx of EFFECTS) {
    const type = at(fx.type);
    const sec = { on: at(fx.on) === 1 };
    const typeName = fx.types.find(([v]) => v === type)?.[1];
    if (typeName) sec.type = typeName;
    if (!fx.shares) {
      sec.color = COLOR_NAMES[at(fx.color)] ?? 'green';
      const knob = at(fx.knob);
      sec.knob = knob > 0 ? knob - 1 : KNOB_DEFAULT;
    }
    if (fx.key === 'reverb') sec.knobControls = REVERB_KNOB.find(([v]) => v === at(REVERB_LAYER.slots[reverbColor]))?.[1];
    const params = {};
    for (const p of effectParams(fx.key, type)) {
      const v = shown(p, decodeValue(p, bytesAt(p)));
      if (v !== undefined) params[p.label] = v;
    }
    sec.params = params;
    preset[fx.key] = sec;
  }

  preset.noiseSuppressor = { on: at(NOISE_SUPPRESSOR.on) === 1 };
  for (const p of NOISE_SUPPRESSOR.params) {
    const v = shown(p, at(p.address));
    if (v !== undefined) preset.noiseSuppressor[norm(p.label)] = v;
  }

  for (const [key, eq] of Object.entries(EQS)) {
    const type = at(eq.type);
    const sec = { on: at(eq.on) === 1 };
    if (EQ_TYPES[type]) sec.type = EQ_TYPES[type][1];
    if (EQ_POSITIONS[at(eq.position)]) sec.position = EQ_POSITIONS[at(eq.position)][1];
    sec.params = {};
    if (!sec.type) {
      preset[key] = sec;
      continue;
    }
    for (const p of type === 1 ? eq.graphic : eq.parametric) {
      const v = shown(p, at(p.address));
      if (v !== undefined) sec.params[p.label] = v;
    }
    preset[key] = sec;
  }

  preset.contour = { on: at(CONTOUR.on) === 1 };
  if ([0, 1, 2].includes(at(CONTOUR.type))) preset.contour.type = at(CONTOUR.type) + 1;
  const cab = CAB_RESONANCE.options[at(CAB_RESONANCE.address)];
  if (cab) preset.cabResonance = cab;
  const level = shown(PATCH_LEVEL, at(PATCH_LEVEL.address));
  if (level !== undefined) preset.patchLevel = level;
  return preset;
}

// ---------------------------------------------------------------- reference for the guide

const row = (cells) => `| ${cells.join(' | ')} |`;
const paramTable = (params) => [row(['Parameter', 'Werte']), row(['---', '---']), ...params.map((p) => row([p.label, rangeText(p)]))].join('\n');

/**
 * Markdown reference of every name and value range a preset can use. Generated from the
 * tables in the code; docs/preset-guide.md contains it (npm run docs:preset).
 */
export function presetReference() {
  const out = [];
  const h = (text) => out.push('', text, '');

  h('### Amp-Modelle (`amp.model`)');
  out.push(row(['Modell', 'Schalter AMP TYPE']), row(['---', '---']));
  const order = [0x01, 0x08, 0x0b, 0x18, 0x17, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x00, 0x09, 0x02, 0x0a, 0x0c, 0x03, 0x0d, 0x11, 0x0f, 0x05, 0x0e, 0x10, 0x06, 0x16, 0x12, 0x13, 0x04, 0x14, 0x15, 0x07];
  for (const v of order) out.push(row([TABLES.ampModels[v], AMP_TYPES[MODEL_SWITCH[v]]]));
  h('Regler `gain`, `volume`, `bass`, `middle`, `treble`, `presence`: ganze Zahlen 0 … 100.');

  const effectSection = (title, key, typesNote) => {
    const fx = EFFECT[key];
    h(`### ${title}`);
    if (typesNote) out.push(typesNote, '');
    for (const [value, name] of fx.types) {
      const params = effectParams(key, value);
      out.push(`**${name}**`, '', params.length ? paramTable(params) : '(keine Regler)', '');
    }
  };
  h('### Booster (`booster.type`)');
  out.push(`Typen: ${EFFECT.booster.types.map(([, n]) => n).join(', ')}.`, '', 'Alle Booster-Typen haben dieselben Regler:', '', paramTable(effectParams('booster', 0)));
  effectSection('MOD und FX (`mod.type`, `fx.type`)', 'mod', 'MOD und FX haben dieselben Typen und Regler.');
  effectSection('Delay und Delay 2 (`delay.type`, `delay2.type`)', 'delay', 'Delay 2 hat dieselben Typen und Regler wie Delay.');
  h('### Reverb (`reverb.type`)');
  out.push(`Typen: ${EFFECT.reverb.types.map(([, n]) => n).join(', ')}.`, '', 'Regler (bei Spring zusätzlich „Spring Color“, 0 … 100):', '', paramTable(effectParams('reverb', 0)));
  out.push('', `\`reverb.knobControls\`: ${REVERB_KNOB.map(([, n]) => n).join(', ')}.`);

  h('### Noise Suppressor (`noiseSuppressor`)');
  out.push(paramTable(NOISE_SUPPRESSOR.params.map((p) => ({ ...p, label: norm(p.label) }))));
  h('### EQ 1 und EQ 2 (`eq1`, `eq2`)');
  out.push(`\`type\`: ${EQ_TYPES.map(([, n]) => n).join(', ')}. \`position\`: ${EQ_POSITIONS.map(([, n]) => n).join(', ')}.`, '', '**Parametric**', '', paramTable(EQS.eq1.parametric), '', '**Graphic**', '', paramTable(EQS.eq1.graphic));
  h('### Sonstiges');
  out.push(`- \`contour\`: \`on\`, \`type\` 1, 2 oder 3.`, `- \`cabResonance\`: ${CAB_RESONANCE.options.join(', ')}.`, `- \`patchLevel\`: 0 … 100.`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
