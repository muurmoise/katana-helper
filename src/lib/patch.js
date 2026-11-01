// The temporary patch (60 00 xx xx) as the editor sees it: which control lives where,
// plus a byte store that follows reads, writes and messages from the amp.
// Addresses: docs/protocol.md sections 6 and 7.

import { TABLES } from './describe.js';
import { fromBase128, hex, toBase128 } from './sysex.js';

const P = (hi, lo) => [0x60, 0x00, hi, lo];

export const AMP = {
  typeKnob: P(0x06, 0x50),
  model: P(0x00, 0x21),
  variationLed: P(0x06, 0x5c),
};

/** Panel knobs (06 5x, 0–100) and the preamp value the amp derives from each. */
export const KNOBS = [
  { key: 'gain', label: 'Gain', address: P(0x06, 0x51), preamp: P(0x00, 0x22) },
  { key: 'bass', label: 'Bass', address: P(0x06, 0x53), preamp: P(0x00, 0x24) },
  { key: 'middle', label: 'Middle', address: P(0x06, 0x54), preamp: P(0x00, 0x25) },
  { key: 'treble', label: 'Treble', address: P(0x06, 0x55), preamp: P(0x00, 0x26) },
  { key: 'presence', label: 'Presence', address: P(0x06, 0x56), preamp: P(0x00, 0x27) },
  { key: 'volume', label: 'Volume', address: P(0x06, 0x52), preamp: P(0x00, 0x28) },
];

const entries = (table) =>
  Array.isArray(table)
    ? table.map((name, value) => [value, name]).filter(([, name]) => name)
    : Object.entries(table)
        .map(([value, name]) => [Number(value), name])
        .sort((a, b) => a[0] - b[0]);

// Order as on the amp: the five panel models, their variations, then the hidden models.
const AMP_MODEL_ORDER = [
  0x01, 0x08, 0x0b, 0x18, 0x17, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x00, 0x09, 0x02, 0x0a, 0x0c,
  0x03, 0x0d, 0x11, 0x0f, 0x05, 0x0e, 0x10, 0x06, 0x16, 0x12, 0x13, 0x04, 0x14, 0x15, 0x07,
];
export const AMP_MODELS = AMP_MODEL_ORDER.map((v) => [v, TABLES.ampModels[v]]);
export const AMP_KNOB = entries(TABLES.ampKnob);

const effect = (key, label, on, type, color, slot0, led, knob, types, extra = {}) => ({
  key,
  label,
  on: P(...on),
  type: P(...type),
  color: P(0x06, color),
  slots: [0, 1, 2].map((i) => P(0x06, slot0 + i)),
  led: P(0x06, led),
  knob: P(0x06, knob),
  types: entries(types),
  ...extra,
});

/** What the reverb knob controls, per colour (06 36–06 38): 00 Delay 2, 01 both, 02 Reverb. */
export const REVERB_LAYER = { slots: [0, 1, 2].map((i) => P(0x06, 0x36 + i)), options: entries(TABLES.reverbKnob) };

/**
 * The effect blocks. slots = type per colour (green, red, yellow). Delay 2 has no button
 * or knob of its own: colour, LED and knob belong to the reverb (`shares`).
 */
export const EFFECTS = [
  effect('booster', 'Booster', [0x00, 0x10], [0x00, 0x11], 0x39, 0x24, 0x5d, 0x57, TABLES.boosterTypes),
  effect('mod', 'MOD', [0x01, 0x00], [0x01, 0x01], 0x3a, 0x27, 0x5e, 0x58, TABLES.modTypes),
  effect('fx', 'FX', [0x03, 0x00], [0x03, 0x01], 0x3b, 0x2a, 0x5f, 0x59, TABLES.modTypes),
  effect('delay', 'Delay', [0x05, 0x00], [0x05, 0x01], 0x3c, 0x2d, 0x60, 0x5a, TABLES.delayTypes),
  effect('reverb', 'Reverb', [0x05, 0x40], [0x05, 0x41], 0x3d, 0x30, 0x61, 0x5b, TABLES.reverbTypes, { layer: REVERB_LAYER }),
  effect('delay2', 'Delay 2', [0x05, 0x20], [0x05, 0x21], 0x3d, 0x33, 0x61, 0x5b, TABLES.delayTypes, {
    shares: 'reverb',
    layer: REVERB_LAYER,
  }),
];

export const COLORS = ['Grün', 'Rot', 'Gelb'];

/** Byte store keyed by absolute address. */
export class PatchState {
  constructor() {
    this.bytes = new Map();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(addresses) {
    for (const l of this.listeners) l(addresses);
  }

  /** Replace everything with the chunks of a patch read. */
  load(chunks) {
    this.bytes.clear();
    for (const c of chunks) this.write(c.address, c.data);
    this.emit(null); // null = everything changed
  }

  write(address, data) {
    const start = fromBase128(address);
    const changed = [];
    Array.from(data).forEach((b, i) => {
      if (this.bytes.get(start + i) !== b) changed.push(start + i);
      this.bytes.set(start + i, b);
    });
    return changed;
  }

  /** Set bytes and notify listeners. Returns the absolute addresses that changed. */
  apply(address, data) {
    const changed = this.write(address, data);
    if (changed.length) this.emit(changed);
    return changed;
  }

  get(address) {
    return this.bytes.get(fromBase128(address));
  }

  has(address) {
    return this.bytes.has(fromBase128(address));
  }

  snapshot() {
    return new Map(this.bytes);
  }
}

/** Group absolute addresses into runs of consecutive bytes: [[start, length], …]. */
export function runs(absAddresses) {
  const sorted = [...new Set(absAddresses)].sort((a, b) => a - b);
  const out = [];
  for (const a of sorted) {
    const last = out.at(-1);
    if (last && last[0] + last[1] === a) last[1]++;
    else out.push([a, 1]);
  }
  return out;
}

/** Backup file content (JSON). Phase 3 will import it. */
export function backupFile({ chunks, channel, patchName, version, date = new Date() }) {
  return {
    format: 'katana-helper-backup',
    formatVersion: 1,
    created: date.toISOString(),
    device: 'BOSS Katana MkII',
    firmware: version ?? null,
    channel,
    patchName,
    chunks: chunks.map((c) => ({ address: hex(c.address), data: hex(c.data) })),
  };
}


// ---------------------------------------------------------------- whole patches
// A patch in memory is a Map offset → byte, offsets relative to the patch start
// (60 00 00 00 for the temporary patch, 10 0n 00 00 for stored channel n).

export const PATCH_BASE = fromBase128([0x60, 0x00, 0x00, 0x00]);

/** Live LED states (06 5C–06 61): reported by the amp, not part of the sound. */
export const LIVE_OFFSETS = new Set([0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x61].map((lo) => 0x06 * 128 + lo));

/** Patch map from a KatanaClient.read() result at `base` (4-byte address). */
export function patchFromRead(result, base) {
  const start = fromBase128(base);
  const map = new Map();
  for (const c of result.chunks) {
    const o = fromBase128(c.address) - start;
    c.data.forEach((b, i) => map.set(o + i, b));
  }
  return map;
}

/** Patch map from the editor state (absolute addresses of the temporary patch). */
export function patchFromState(state) {
  const map = new Map();
  for (const [abs, b] of state.bytes) {
    const o = abs - PATCH_BASE;
    if (o >= 0 && o < 16384) map.set(o, b);
  }
  return map;
}

/** Map → [{ offset, data: 'hex' }] runs, for storage and files. */
export function serializePatch(map) {
  const out = [];
  for (const [start, length] of runs([...map.keys()])) {
    const data = Array.from({ length }, (_, i) => map.get(start + i));
    out.push({ offset: start, data: hex(data) });
  }
  return out;
}

export function parsePatch(chunks) {
  const map = new Map();
  for (const c of chunks) {
    const bytes = typeof c.data === 'string' ? c.data.split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16)) : c.data;
    if (!Number.isInteger(c.offset) || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 0x7f)) {
      throw new Error('Ungültige Patch-Daten');
    }
    bytes.forEach((b, i) => map.set(c.offset + i, b));
  }
  return map;
}

/** Offsets of the panel block 60 00 06 xx (amp type switch, panel knobs, colours, chain). */
const PANEL_BLOCK = [0x06 * 128, 0x07 * 128];
const inPanel = (o) => o >= PANEL_BLOCK[0] && o < PANEL_BLOCK[1];

/**
 * DT1 writes that put `map` into the temporary patch: runs of at most `max` bytes,
 * leaving out the live LED bytes.
 *
 * The panel block (06 xx) goes first. The amp derives values from the panel controls (the
 * AMP TYPE switch sets the amp model 00 21, an effect knob moves the main parameter of the
 * effect). Writing the panel first and the detail values after it keeps the details of
 * `map` instead of the derived ones.
 */
export function patchWrites(map, { max = 241 } = {}) {
  const offsets = [...map.keys()].filter((o) => !LIVE_OFFSETS.has(o));
  const writes = [];
  const ordered = [...runs(offsets.filter(inPanel)), ...runs(offsets.filter((o) => !inPanel(o)))];
  for (const [start, length] of ordered) {
    for (let s = start; s < start + length; s += max) {
      const n = Math.min(max, start + length - s);
      writes.push({
        address: toBase128(PATCH_BASE + s),
        data: Array.from({ length: n }, (_, i) => map.get(s + i)),
      });
    }
  }
  return writes;
}

/** Offsets where two patches differ, ignoring the live LED bytes. */
export function patchDiff(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].filter((o) => !LIVE_OFFSETS.has(o) && a.get(o) !== b.get(o)).sort((x, y) => x - y);
}

export function patchName(map) {
  return String.fromCharCode(...Array.from({ length: 16 }, (_, i) => map.get(i) ?? 0x20).map((b) => (b >= 0x20 && b < 0x7f ? b : 0x3f))).trimEnd();
}

/** Text → 16 name bytes. The amp only shows ASCII; other characters become '?', like on the amp. */
export function nameBytes(text) {
  return [...String(text).slice(0, 16).padEnd(16)].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x20 && code < 0x7f ? code : 0x3f;
  });
}
