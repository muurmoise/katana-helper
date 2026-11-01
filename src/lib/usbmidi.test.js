import { describe, expect, it } from 'vitest';
import { buildEditMode, buildRQ1, hex } from './sysex.js';
import { packChannelMessage, packSysex, unpackPackets, UsbMidiReceiver } from './usbmidi.js';

describe('packSysex', () => {
  it('ends with CIN 0x7 when the last chunk has 3 bytes', () => {
    // 15 bytes = 5 packets, last one full
    expect(hex(packSysex(buildEditMode(true)))).toBe(
      [
        '04 F0 41 00',
        '04 00 00 00',
        '04 33 12 7F',
        '04 00 00 01',
        '07 01 7F F7',
      ].join(' '),
    );
  });

  it('ends with CIN 0x6 and pads with 00 for 2 remaining bytes', () => {
    const two = [0xf0, 0x01, 0x02, 0x03, 0xf7]; // 5 bytes → 04 + 06
    expect(hex(packSysex(two))).toBe('04 F0 01 02 06 03 F7 00');
  });

  it('ends with CIN 0x5 for a single remaining F7', () => {
    const four = [0xf0, 0x01, 0x02, 0xf7]; // 4 bytes → 04 + 05
    expect(hex(packSysex(four))).toBe('04 F0 01 02 05 F7 00 00');
  });

  it('handles very short messages', () => {
    expect(hex(packSysex([0xf0, 0xf7]))).toBe('06 F0 F7 00');
    expect(hex(packSysex([0xf0, 0x01, 0xf7]))).toBe('07 F0 01 F7');
  });

  it('puts the cable number in the high nibble', () => {
    expect(packSysex([0xf0, 0xf7], 2)[0]).toBe(0x26);
  });

  it('rejects messages without F0/F7', () => {
    expect(() => packSysex([0x41, 0x00])).toThrow();
  });
});

describe('packChannelMessage', () => {
  it('packs program change and control change', () => {
    expect(hex(packChannelMessage([0xc0, 0x04]))).toBe('0C C0 04 00');
    expect(hex(packChannelMessage([0xb0, 0x10, 0x7f]))).toBe('0B B0 10 7F');
  });

  it('rejects wrong lengths', () => {
    expect(() => packChannelMessage([0xc0])).toThrow();
    expect(() => packChannelMessage([0xf0, 0x01])).toThrow();
  });
});

describe('unpackPackets', () => {
  it('skips zero padding and trailing partial packets', () => {
    const data = Uint8Array.from([0x0c, 0xc0, 0x04, 0x00, 0, 0, 0, 0, 0x0b, 0xb0]);
    expect(unpackPackets(data)).toEqual([{ cable: 0, cin: 0xc, bytes: [0xc0, 0x04] }]);
  });

  it('accepts a DataView (what WebUSB transferIn returns)', () => {
    const packed = packSysex([0xf0, 0x01, 0xf7]);
    const view = new DataView(packed.buffer);
    expect(unpackPackets(view)).toEqual([{ cable: 0, cin: 0x7, bytes: [0xf0, 0x01, 0xf7] }]);
  });
});

describe('UsbMidiReceiver', () => {
  it('round-trips every message length from 2 to 40 bytes', () => {
    for (let n = 2; n <= 40; n++) {
      const msg = [0xf0, ...Array.from({ length: n - 2 }, (_, i) => i & 0x7f), 0xf7];
      const rx = new UsbMidiReceiver();
      expect(rx.push(packSysex(msg))).toEqual([{ sysex: true, bytes: msg }]);
    }
  });

  it('joins a SysEx message split across transfers', () => {
    const msg = Array.from(buildRQ1([0x60, 0, 0, 0], 1920));
    const packed = packSysex(msg);
    const rx = new UsbMidiReceiver();
    expect(rx.push(packed.slice(0, 8))).toEqual([]);
    expect(rx.push(packed.slice(8))).toEqual([{ sysex: true, bytes: msg }]);
  });

  it('returns several messages from one transfer', () => {
    const a = Array.from(buildEditMode(true));
    const b = Array.from(buildEditMode(false));
    const data = Uint8Array.from([...packSysex(a), ...packChannelMessage([0xc0, 0x01]), ...packSysex(b)]);
    expect(new UsbMidiReceiver().push(data)).toEqual([
      { sysex: true, bytes: a },
      { sysex: false, bytes: [0xc0, 0x01] },
      { sysex: true, bytes: b },
    ]);
  });

  it('reports a SysEx message that restarts before it ends as incomplete', () => {
    const rx = new UsbMidiReceiver();
    const first = rx.push(Uint8Array.from([0x04, 0xf0, 0x41, 0x00]));
    expect(first).toEqual([]);
    const second = rx.push(packSysex([0xf0, 0x01, 0xf7]));
    expect(second).toEqual([
      { sysex: true, bytes: [0xf0, 0x41, 0x00], incomplete: true },
      { sysex: true, bytes: [0xf0, 0x01, 0xf7] },
    ]);
  });
});
