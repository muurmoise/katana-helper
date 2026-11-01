import { describe, expect, it } from 'vitest';
import {
  ADDR,
  addAddress,
  ascii,
  buildDT1,
  buildEditMode,
  buildRQ1,
  checksum,
  fromBase128,
  hex,
  parseHex,
  parseSysex,
  PATCH_DUMP_SIZE,
  toBase128,
} from './sysex.js';

describe('checksum', () => {
  it('matches the worked example from katana_sysex.txt', () => {
    expect(checksum([0x60, 0x00, 0x12, 0x14, 0x01])).toBe(0x79);
  });

  it('returns 00 when the sum is a multiple of 128', () => {
    expect(checksum([0x7f, 0x00, 0x00, 0x01, 0x00])).toBe(0x00);
  });

  it('matches the channel messages captured by TuxKatana', () => {
    const sums = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => checksum([0x00, 0x01, 0x00, 0x00, 0x00, n]));
    expect(sums).toEqual([0x7e, 0x7d, 0x7c, 0x7b, 0x7a, 0x79, 0x78, 0x77]);
  });
});

describe('base 128', () => {
  it('encodes the patch dump size as 00 00 0F 00', () => {
    expect(toBase128(PATCH_DUMP_SIZE)).toEqual([0x00, 0x00, 0x0f, 0x00]);
    expect(fromBase128([0x00, 0x00, 0x0f, 0x00])).toBe(1920);
  });

  it('adds offsets with a 7-bit carry', () => {
    expect(addAddress([0x60, 0x00, 0x00, 0x00], 241)).toEqual([0x60, 0x00, 0x01, 0x71]);
    expect(addAddress([0x60, 0x00, 0x00, 0x7f], 1)).toEqual([0x60, 0x00, 0x01, 0x00]);
  });

  it('rejects values that do not fit', () => {
    expect(() => toBase128(-1)).toThrow(RangeError);
    expect(() => toBase128(128 ** 4)).toThrow(RangeError);
  });
});

describe('builders', () => {
  it('builds edit mode on/off', () => {
    expect(hex(buildEditMode(true))).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 01 7F F7');
    expect(hex(buildEditMode(false))).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 00 00 F7');
  });

  it('builds RQ1 for the device name (TuxKatana trace)', () => {
    expect(hex(buildRQ1(ADDR.DEVICE_NAME, 16))).toBe(
      'F0 41 00 00 00 00 33 11 10 00 00 00 00 00 00 10 60 F7',
    );
  });

  it('builds RQ1 for the patch dump (TuxKatana trace)', () => {
    expect(hex(buildRQ1(ADDR.PATCH, PATCH_DUMP_SIZE))).toBe(
      'F0 41 00 00 00 00 33 11 60 00 00 00 00 00 0F 00 11 F7',
    );
  });

  it('builds RQ1 for the active channel with a valid checksum', () => {
    expect(hex(buildRQ1(ADDR.ACTIVE_CHANNEL, 2))).toBe(
      'F0 41 00 00 00 00 33 11 00 01 00 00 00 00 00 02 7D F7',
    );
  });

  it('builds DT1 messages from docs/protocol.md', () => {
    expect(hex(buildDT1(ADDR.ACTIVE_CHANNEL, [0x00, 0x01]))).toBe(
      'F0 41 00 00 00 00 33 12 00 01 00 00 00 01 7E F7',
    );
    expect(hex(buildDT1(ADDR.GAIN, [0x32]))).toBe('F0 41 00 00 00 00 33 12 60 00 06 51 32 17 F7');
  });

  it('rejects bytes above 7F and wrong address lengths', () => {
    expect(() => buildDT1(ADDR.GAIN, [0x80])).toThrow(RangeError);
    expect(() => buildDT1([0x60, 0x00, 0x06], [0x01])).toThrow(RangeError);
    expect(() => buildDT1(ADDR.GAIN, [])).toThrow(RangeError);
  });
});

describe('parseSysex', () => {
  it('parses the device name reply from TuxKatana', () => {
    const reply = parseHex(
      'F0 41 00 00 00 00 33 12 10 00 00 00 4B 41 54 41 4E 41 20 4D 6B 32 20 20 20 20 20 20 76 F7',
    );
    const msg = parseSysex(reply);
    expect(msg.kind).toBe('dt1');
    expect(msg.address).toEqual(ADDR.DEVICE_NAME);
    expect(msg.checksumOk).toBe(true);
    expect(ascii(msg.data).trim()).toBe('KATANA Mk2');
  });

  it('flags a wrong checksum', () => {
    const msg = parseSysex(parseHex('F0 41 00 00 00 00 33 12 60 00 06 51 32 18 F7'));
    expect(msg.checksumOk).toBe(false);
    expect(msg.expectedChecksum).toBe(0x17);
  });

  it('parses its own RQ1 messages', () => {
    const msg = parseSysex(buildRQ1(ADDR.PATCH, PATCH_DUMP_SIZE));
    expect(msg.kind).toBe('rq1');
    expect(msg.sizeValue).toBe(1920);
    expect(msg.checksumOk).toBe(true);
  });

  it('parses the identity reply from TuxKatana', () => {
    const msg = parseSysex(parseHex('F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7'));
    expect(msg.kind).toBe('identity-reply');
    expect(msg.manufacturer).toBe(0x41);
    expect(msg.family).toEqual([0x33, 0x03]);
    expect(msg.version).toEqual([0x06, 0x00, 0x00, 0x00]);
  });

  it('marks foreign or broken messages as unknown', () => {
    expect(parseSysex([0xf0, 0x43, 0x10, 0xf7]).kind).toBe('unknown');
    expect(parseSysex([0xf0, 0x41, 0x00]).kind).toBe('unknown');
  });
});

describe('hex helpers', () => {
  it('round-trips', () => {
    expect(parseHex('f0 41 0A')).toEqual([0xf0, 0x41, 0x0a]);
    expect(hex([0xf0, 0x41, 0x0a])).toBe('F0 41 0A');
    expect(() => parseHex('F0 4')).toThrow();
  });
});
