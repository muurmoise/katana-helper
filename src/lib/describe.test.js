import { describe as group, expect, it } from 'vitest';
import { asciiName, channelFromData, describe, fieldAt } from './describe.js';

group('describe', () => {
  it('names values recorded on our amp (docs/protocol.md 10)', () => {
    expect(describe([0x60, 0x00, 0x06, 0x51], [0x21])).toBe('Gain = 33');
    expect(describe([0x60, 0x00, 0x00, 0x21], [0x08])).toBe('Amp-Modell = Clean (Panel) (08)');
    expect(describe([0x60, 0x00, 0x06, 0x50], [0x01])).toBe('AMP-TYPE-Schalter = Clean (01)');
    expect(describe([0x60, 0x00, 0x00, 0x11], [0x0f])).toBe('Booster-Typ = Rat (0F)');
    expect(describe([0x60, 0x00, 0x01, 0x01], [0x15])).toBe('MOD-Typ = Tremolo (15)');
    expect(describe([0x60, 0x00, 0x05, 0x41], [0x03])).toBe('Reverb-Typ = Hall 2 (03)');
    expect(describe([0x60, 0x00, 0x06, 0x39], [0x01])).toBe('Farbe Booster = Rot (01)');
    expect(describe([0x60, 0x00, 0x06, 0x5e], [0x01])).toBe('LED MOD = an');
    expect(describe([0x60, 0x00, 0x05, 0x02], [0x01, 0x75])).toBe('Delay-Zeit = 245 ms');
    expect(describe([0x00, 0x01, 0x00, 0x00], [0x00, 0x00])).toBe('Aktiver Kanal = Panel (00 00)');
  });

  it('shows effect knobs with 00 = off', () => {
    expect(describe([0x60, 0x00, 0x06, 0x58], [0x00])).toBe('MOD-Regler = aus (0)');
    expect(describe([0x60, 0x00, 0x06, 0x5b], [0x2f])).toBe('Reverb-Regler = 46');
  });

  it('handles dumps and unknown addresses', () => {
    expect(describe([0x60, 0x00, 0x00, 0x00], new Array(241).fill(0))).toBe('241 Byte ab Patch-Name');
    expect(describe([0x60, 0x00, 0x02, 0x14], [0x1f])).toBe('1 Byte');
    expect(describe([0x60, 0x00, 0x00, 0x11], [0x07])).toBe('Booster-Typ = unbekannt (07)');
    expect(fieldAt([0x60, 0x00, 0x06, 0x51]).size).toBe(1);
  });

  it('decodes names and channels', () => {
    expect(asciiName([0x41, 0x42, 0x20, 0x20, 0x01])).toBe('AB  ?');
    expect(asciiName([0x41, 0x20, 0x20])).toBe('A');
    expect(channelFromData([0x00, 0x05])).toBe(5);
    expect(channelFromData([0x03])).toBe(3);
  });
});
