import { describe, expect, it } from 'vitest';
import { TABLES } from './describe.js';
import {
  BLOCK_SPANS,
  allEffectParams,
  decodeValue,
  effectParams,
  encodeValue,
  formatValue,
  offsetAddress,
} from './effect-params.js';
import { fromBase128, hex } from './sysex.js';

const abs = (a) => fromBase128(a);
const PATCH = abs([0x60, 0, 0, 0]);
const byLabel = (params, label) => params.find((p) => p.label === label);

describe('effect parameters', () => {
  it('has parameters for every MOD/FX, delay and reverb type', () => {
    for (const type of Object.keys(TABLES.modTypes).map(Number)) {
      expect(effectParams('mod', type).length, `MOD type ${type}`).toBeGreaterThan(0);
      expect(effectParams('fx', type).length).toBe(effectParams('mod', type).length);
    }
    TABLES.delayTypes.forEach((_, t) => expect(effectParams('delay', t).length).toBeGreaterThan(0));
    TABLES.reverbTypes.forEach((_, t) => expect(effectParams('reverb', t).length).toBeGreaterThan(0));
    expect(effectParams('booster', 0x0f).map((p) => p.label)).toContain('Drive');
    expect(effectParams('mod', 0x05)).toEqual([]); // no such type
  });

  it('puts the tremolo where the amp reported it (protocol.md 7.4)', () => {
    const tremolo = effectParams('mod', 0x15);
    expect(tremolo.map((p) => [p.label, hex(p.address)])).toEqual([
      ['Wave Shape', '60 00 02 13'],
      ['Rate', '60 00 02 14'],
      ['Depth', '60 00 02 15'],
      ['Level', '60 00 02 16'],
    ]);
    expect(hex(byLabel(effectParams('fx', 0x15), 'Rate').address)).toBe('60 00 04 14');
  });

  it('shifts FX by 02 00 and Delay 2 by 00 20', () => {
    for (const type of Object.keys(TABLES.modTypes).map(Number)) {
      const mod = effectParams('mod', type);
      effectParams('fx', type).forEach((p, i) => expect(abs(p.address) - abs(mod[i].address)).toBe(256));
    }
    const d1 = effectParams('delay', 0x03);
    effectParams('delay2', 0x03).forEach((p, i) => expect(abs(p.address) - abs(d1[i].address)).toBe(0x20));
  });

  it('crosses from 01 7F to 02 00', () => {
    expect(offsetAddress([0x60, 0, 0x01, 0x00], 0x80)).toEqual([0x60, 0, 0x02, 0x00]);
    expect(hex(byLabel(effectParams('mod', 0x12), 'Treble').address)).toBe('60 00 02 00');
  });

  it('keeps every address inside the patch read and inside its block', () => {
    for (const p of allEffectParams()) {
      const o = abs(p.address) - PATCH;
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o + p.size).toBeLessThanOrEqual(0x0f * 128 + 0x48);
      const span = BLOCK_SPANS[p.key];
      expect(abs(p.address)).toBeGreaterThanOrEqual(abs(span.address));
      expect(abs(p.address) + p.size).toBeLessThanOrEqual(abs(span.address) + span.size);
    }
  });

  it('never lets two parameters of one type overlap', () => {
    for (const key of ['booster', 'mod', 'fx', 'delay', 'delay2', 'reverb']) {
      for (let type = 0; type < 0x29; type++) {
        const used = new Set();
        for (const p of effectParams(key, type)) {
          for (let i = 0; i < p.size; i++) {
            const a = abs(p.address) + i;
            expect(used.has(a), `${key} ${type} ${p.label}`).toBe(false);
            used.add(a);
          }
        }
      }
    }
  });

  it('only allows 7-bit bytes', () => {
    for (const p of allEffectParams()) {
      const values = p.options ? p.options.map(([v]) => v) : [p.min, p.max];
      for (const v of values) for (const b of encodeValue(p, v)) expect(b).toBeLessThanOrEqual(0x7f);
    }
  });

  it('encodes two-byte values as first * 128 + second', () => {
    const time = byLabel(effectParams('delay', 0), 'Time');
    expect(time.size).toBe(2);
    expect(encodeValue(time, 2000)).toEqual([0x0f, 0x50]);
    expect(encodeValue(time, 245)).toEqual([0x01, 0x75]);
    expect(decodeValue(time, [0x01, 0x75])).toBe(245);
    expect(decodeValue(time, [0x01, undefined])).toBeUndefined();
  });

  it('formats values as BOSS Tone Studio shows them', () => {
    const reverb = effectParams('reverb', 5);
    expect(formatValue(byLabel(reverb, 'Time'), 0)).toBe('0.1 s');
    expect(formatValue(byLabel(reverb, 'Time'), 99)).toBe('10.0 s');
    expect(formatValue(byLabel(reverb, 'Low Cut'), 0)).toBe('Flat');
    expect(formatValue(byLabel(reverb, 'High Cut'), 14)).toBe('Flat');
    expect(formatValue(byLabel(reverb, 'High Cut'), 0)).toBe('630 Hz');
    expect(byLabel(reverb, 'Spring Color')).toBeTruthy();
    expect(byLabel(effectParams('reverb', 2), 'Spring Color')).toBeUndefined();

    const booster = effectParams('booster', 0);
    expect(formatValue(byLabel(booster, 'Tone'), 0)).toBe('-50');
    expect(formatValue(byLabel(booster, 'Tone'), 50)).toBe('0');
    expect(formatValue(byLabel(booster, 'Tone'), 100)).toBe('+50');

    const geq = effectParams('mod', 0x06);
    expect(formatValue(geq[0], 40)).toBe('+20 dB');
    const step = byLabel(effectParams('mod', 0x13), 'Step Rate');
    expect(formatValue(step, 0)).toBe('Off');
    expect(formatValue(step, 101)).toBe('100');
    expect(formatValue(byLabel(effectParams('mod', 0x28), 'Pitch'), 0)).toBe('-24');
    expect(formatValue(byLabel(effectParams('mod', 0x04), 'Ratio'), 17)).toBe('∞:1');
    expect(formatValue(step, undefined)).toBe('–');
  });

  it('gives every list the length of its value range (Q2 midi.xml)', () => {
    const para = effectParams('mod', 0x07);
    expect(byLabel(para, 'Low Cut').options).toHaveLength(18);
    expect(byLabel(para, 'Low-Mid Freq').options).toHaveLength(28);
    expect(byLabel(para, 'High Cut').options).toHaveLength(15);
    expect(byLabel(effectParams('mod', 0x1d), 'Xover Freq').options.map(([, n]) => n)).toEqual(
      expect.arrayContaining(['100 Hz', '4 kHz']),
    );
    expect(byLabel(effectParams('mod', 0x1d), 'Xover Freq').options).toHaveLength(17);
    expect(byLabel(effectParams('mod', 0x10), 'HR1 Harmony').options).toHaveLength(30);
  });
});
