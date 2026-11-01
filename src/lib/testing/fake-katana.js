// Test double: a Katana MkII behind fake Web MIDI ports. It keeps the temporary patch and
// the nine stored channels, answers RQ1 like the real amp (241-byte messages, gap at
// 07 44–07 7F, 1932 bytes per patch, see docs/protocol.md 2.3), stores DT1 writes and
// carries out the save command. It also keeps parts of the system area (00 00 00 00–2F, 00 00 01 10–1A,
// values read from our amp on 2026-11-01). Only used by tests.

import { ADDR, PATCH_DUMP_SIZE, buildDT1, fromBase128, hex, parseHex, parseSysex, toBase128 } from '../sysex.js';
import { WebMidiTransport } from '../midi-transport.js';

export const IDENTITY_REPLY = parseHex('F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7');
const GAP = [fromBase128([0, 0, 0x07, 0x44]), fromBase128([0, 0, 0x08, 0x00])];
const SAVE = hex([0x7f, 0x00, 0x01, 0x04]);

const ascii = (text) => [...text.padEnd(16).slice(0, 16)].map((c) => c.charCodeAt(0));

/** A plausible patch as offset → byte: all 0x32, the given name, values from our real amp. */
export function samplePatch(name) {
  const p = new Map();
  for (let o = 0; o < PATCH_DUMP_SIZE; o++) if (o < GAP[0] || o >= GAP[1]) p.set(o, 0x32);
  const fill = (hi, lo, bytes) => bytes.forEach((b, i) => p.set(hi * 128 + lo + i, b));
  fill(0, 0, ascii(name));
  fill(0x00, 0x10, [0x01, 0x0f]); // booster on, Rat
  fill(0x00, 0x21, [0x08]); // Clean (Panel)
  fill(0x06, 0x24, [0x0a, 0x0f, 0x0e]); // booster slots
  fill(0x06, 0x39, [0x01, 0x00, 0x00, 0x00, 0x01]); // colours
  fill(0x06, 0x50, [0x01, 0x21, 0x1a, 0x27, 0x3a, 0x33, 0x00]); // panel knobs
  fill(0x06, 0x5c, [0x00, 0x02, 0x00, 0x00, 0x00, 0x02]); // LEDs
  return p;
}

/** System area as offset → byte, from our amp (docs/protocol.md 10.6). */
export function sampleSystem() {
  const s = new Map();
  const page1 = '00 14 32 19 01 00 00 32 00 00 00 00 00 00 00 00 01 00 01 08 14 08 02 16 17 01 14 14 0E 14 18 18 18 18 18 18 18 18 18 18 18 00 00 00 00 14 02 04';
  parseHex(page1).forEach((b, i) => s.set(i, b));
  parseHex('00 00 04 0A 04 64 0A 00 02 0A 04').forEach((b, i) => s.set(128 + 0x10 + i, b));
  return s;
}

export function fakeKatana({
  name = 'muur zusamstra?e',
  answers = true,
  saves = true,
  systemAnswers = true,
  systemWrites = true,
} = {}) {
  const channelNames = [name, 'MUUR Main', 'MUUR Main FXLoop', 'Mono', 'Blackout', 'Lifer', 'ethereal', 'banjo', 'Princeton'];
  const stored = channelNames.map((n) => samplePatch(n));
  const temp = samplePatch(name);
  const system = sampleSystem();
  const sys = { answers: systemAnswers, writes: systemWrites };
  const sent = [];
  let channel = 0;

  const input = { id: 'in', name: 'KATANA', manufacturer: 'BOSS', state: 'connected', onmidimessage: null };
  const reply = (bytes) => input.onmidimessage?.({ data: Uint8Array.from(bytes) });

  /** Which memory an address belongs to: [map, base] or null. */
  const region = (address) => {
    if (address[0] === 0x60 && address[1] === 0x00) return [temp, [0x60, 0, 0, 0]];
    if (address[0] === 0x10 && address[1] <= 8) return [stored[address[1]], [0x10, address[1], 0, 0]];
    if (address[0] === 0x00 && address[1] === 0x00) return [system, [0, 0, 0, 0]];
    return null;
  };

  const answerRead = (address, size) => {
    if (hex(address) === hex(ADDR.ACTIVE_CHANNEL)) return reply(buildDT1(address, [0, channel]));
    const r = region(address);
    if (!r) return;
    const [mem, base] = r;
    if (mem === system && !sys.answers) return;
    const baseAbs = fromBase128(base);
    let o = fromBase128(address) - baseAbs;
    const end = o + size;
    while (o < end) {
      while (o < end && !mem.has(o)) o++;
      if (o >= end) break;
      const from = o;
      const data = [];
      while (o < end && mem.has(o) && data.length < 241) data.push(mem.get(o++));
      reply(buildDT1(toBase128(baseAbs + from), data));
    }
  };

  const output = {
    id: 'out',
    name: 'KATANA',
    manufacturer: 'BOSS',
    state: 'connected',
    send(data) {
      sent.push(hex(data));
      if (!answers) return;
      const msg = parseSysex(data);
      if (msg.kind === 'identity-request') reply(IDENTITY_REPLY);
      if (msg.kind === 'rq1') answerRead(msg.address, msg.sizeValue);
      if (msg.kind !== 'dt1') return;
      if (hex(msg.address) === hex(ADDR.ACTIVE_CHANNEL)) {
        channel = msg.data[1];
        stored[channel].forEach((b, o) => temp.set(o, b));
      } else if (hex(msg.address) === SAVE) {
        if (saves) temp.forEach((b, o) => stored[msg.data[1]].set(o, b));
      } else {
        const r = region(msg.address);
        if (r && (r[0] === temp || (r[0] === system && sys.writes))) {
          const o = fromBase128(msg.address) - fromBase128(r[1]);
          msg.data.forEach((b, i) => r[0].set(o + i, b));
        }
      }
    },
  };

  const access = {
    sysexEnabled: true,
    inputs: new Map([['in', input]]),
    outputs: new Map([['out', output]]),
    onstatechange: null,
  };

  const offset = (address) => fromBase128(address) - fromBase128([0x60, 0, 0, 0]);

  return {
    sent,
    temp,
    stored,
    system,
    /** System byte by 00 00 xx xx address. */
    systemByte: (address) => system.get(fromBase128(address)),
    /** Make the system area stop answering reads or ignore writes. */
    setSystem({ answers = sys.answers, writes = sys.writes } = {}) {
      sys.answers = answers;
      sys.writes = writes;
    },
    get channel() {
      return channel;
    },
    /** Temp patch byte by 60 00 xx xx address. */
    byte: (address) => temp.get(offset(address)),
    setByte: (address, b) => temp.set(offset(address), b),
    /** The amp sends something on its own, e.g. a knob turn. */
    amp: (address, data) => reply(buildDT1(address, data)),
    transport: () => new WebMidiTransport({ requestMIDIAccess: async () => access }),
    unplug(state) {
      input.state = state;
      output.state = state;
      access.onstatechange?.({ port: output });
    },
  };
}
