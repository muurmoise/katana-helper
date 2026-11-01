// The temporary patch (60 00 xx xx) as the editor sees it: which control lives where,
// plus a byte store that follows reads, writes and messages from the amp.
// Addresses: docs/protocol.md sections 6 and 7.

import { TABLES } from './describe.js';
import { fromBase128, hex } from './sysex.js';

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

const effect = (key, label, on, type, color, slot0, led, knob, types) => ({
  key,
  label,
  on: P(...on),
  type: P(...type),
  color: P(0x06, color),
  slots: [0, 1, 2].map((i) => P(0x06, slot0 + i)),
  led: P(0x06, led),
  knob: P(0x06, knob),
  types: entries(types),
});

/** The five effect blocks. slots = type per colour (green, red, yellow). */
export const EFFECTS = [
  effect('booster', 'Booster', [0x00, 0x10], [0x00, 0x11], 0x39, 0x24, 0x5d, 0x57, TABLES.boosterTypes),
  effect('mod', 'MOD', [0x01, 0x00], [0x01, 0x01], 0x3a, 0x27, 0x5e, 0x58, TABLES.modTypes),
  effect('fx', 'FX', [0x03, 0x00], [0x03, 0x01], 0x3b, 0x2a, 0x5f, 0x59, TABLES.modTypes),
  effect('delay', 'Delay', [0x05, 0x00], [0x05, 0x01], 0x3c, 0x2d, 0x60, 0x5a, TABLES.delayTypes),
  effect('reverb', 'Reverb', [0x05, 0x40], [0x05, 0x41], 0x3d, 0x30, 0x61, 0x5b, TABLES.reverbTypes),
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

