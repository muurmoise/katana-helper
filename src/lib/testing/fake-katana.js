// Test double: a Katana MkII behind fake Web MIDI ports. It keeps a memory of the temporary
// patch, answers RQ1 like the real amp (241-byte messages, gap at 60 00 07 44–07 7F, see
// docs/protocol.md 2.3) and stores DT1 writes. Only used by tests.

import { ADDR, buildDT1, fromBase128, hex, parseHex, parseSysex, toBase128 } from '../sysex.js';
import { WebMidiTransport } from '../midi-transport.js';

export const IDENTITY_REPLY = parseHex('F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7');
const PATCH = fromBase128(ADDR.PATCH);
const GAP = [fromBase128([0x60, 0x00, 0x07, 0x44]), fromBase128([0x60, 0x00, 0x08, 0x00])];

export function fakeKatana({ name = 'muur zusamstra?e', answers = true } = {}) {
  const memory = new Map();
  const sent = [];
  const nameBytes = [...name.padEnd(16)].map((c) => c.charCodeAt(0));
  const fill = (abs, bytes) => bytes.forEach((b, i) => memory.set(abs + i, b));

  // A plausible patch: every byte 0x32, name at the start, values from our real amp.
  for (let a = PATCH; a < PATCH + 1920; a++) if (a < GAP[0] || a >= GAP[1]) memory.set(a, 0x32);
  fill(PATCH, nameBytes);
  const at = (hi, lo) => fromBase128([0x60, 0x00, hi, lo]);
  fill(at(0x00, 0x10), [0x01, 0x0f]); // booster on, Rat
  fill(at(0x00, 0x21), [0x08]); // Clean (Panel)
  fill(at(0x06, 0x24), [0x0a, 0x0f, 0x0e]); // booster slots
  fill(at(0x06, 0x39), [0x01, 0x00, 0x00, 0x00, 0x01]); // colours
  fill(at(0x06, 0x50), [0x01, 0x21, 0x1a, 0x27, 0x3a, 0x33, 0x00]); // panel knobs
  let channel = 0;

  const input = { id: 'in', name: 'KATANA', manufacturer: 'BOSS', state: 'connected', onmidimessage: null };
  const reply = (bytes) => input.onmidimessage?.({ data: Uint8Array.from(bytes) });

  const answerRead = (address, size) => {
    const start = fromBase128(address);
    if (hex(address) === hex(ADDR.ACTIVE_CHANNEL)) return reply(buildDT1(address, [0, channel]));
    if (address[0] === 0x10) return reply(buildDT1(address, nameBytes));
    // Send runs of existing bytes, at most 241 per message.
    let a = start;
    const end = start + size;
    while (a < end) {
      while (a < end && !memory.has(a)) a++;
      if (a >= end) break;
      const data = [];
      const from = a;
      while (a < end && memory.has(a) && data.length < 241) data.push(memory.get(a++));
      reply(buildDT1(toBase128(from), data));
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
      if (msg.kind === 'dt1') {
        if (hex(msg.address) === hex(ADDR.ACTIVE_CHANNEL)) channel = msg.data[1];
        else if (msg.address[0] === 0x60) fill(fromBase128(msg.address), msg.data);
      }
    },
  };

  const access = {
    sysexEnabled: true,
    inputs: new Map([['in', input]]),
    outputs: new Map([['out', output]]),
    onstatechange: null,
  };

  return {
    sent,
    memory,
    get channel() {
      return channel;
    },
    /** The amp sends something on its own, e.g. a knob turn. */
    amp: (address, data) => reply(buildDT1(address, data)),
    byte: (address) => memory.get(fromBase128(address)),
    transport: () => new WebMidiTransport({ requestMIDIAccess: async () => access }),
    unplug(state) {
      input.state = state;
      output.state = state;
      access.onstatechange?.({ port: output });
    },
  };
}
