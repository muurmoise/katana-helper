// USB-MIDI event packets (4 bytes each), written from the public spec
// "Universal Serial Bus Device Class Definition for MIDI Devices", Release 1.0,
// chapter 4 (USB-MIDI Event Packets).
//
// Byte 0: (cable number << 4) | Code Index Number (CIN)
// Bytes 1-3: up to 3 MIDI bytes, unused bytes are 0x00.
//
// The Katana MkII uses this packet format on a vendor-specific bulk
// interface (see docs/protocol.md, section 1).

/** Number of MIDI bytes carried by each CIN (spec table 4-1). */
const CIN_LENGTH = [
  0, // 0x0 reserved (misc function codes)
  0, // 0x1 reserved (cable events)
  2, // 0x2 two-byte system common
  3, // 0x3 three-byte system common
  3, // 0x4 SysEx starts or continues
  1, // 0x5 single-byte system common, or SysEx ends with 1 byte
  2, // 0x6 SysEx ends with 2 bytes
  3, // 0x7 SysEx ends with 3 bytes
  3, // 0x8 note off
  3, // 0x9 note on
  3, // 0xA poly key press
  3, // 0xB control change
  2, // 0xC program change
  2, // 0xD channel pressure
  3, // 0xE pitch bend
  1, // 0xF single byte
];

export function cinLength(cin) {
  return CIN_LENGTH[cin & 0x0f];
}

/** Pack one complete SysEx message (F0 … F7) into USB-MIDI packets. */
export function packSysex(message, cable = 0) {
  const msg = Array.from(message);
  if (msg[0] !== 0xf0 || msg[msg.length - 1] !== 0xf7) {
    throw new Error('SysEx muss mit F0 beginnen und mit F7 enden');
  }
  const head = (cable & 0x0f) << 4;
  const out = [];
  for (let i = 0; i < msg.length; i += 3) {
    const chunk = msg.slice(i, i + 3);
    const isLast = i + 3 >= msg.length;
    const cin = isLast ? 0x4 + chunk.length : 0x4; // 5, 6 or 7 for the last chunk
    while (chunk.length < 3) chunk.push(0x00);
    out.push(head | cin, ...chunk);
  }
  return Uint8Array.from(out);
}

/** Pack a channel voice message (note, CC, program change, …). */
export function packChannelMessage(message, cable = 0) {
  const msg = Array.from(message);
  const status = msg[0];
  if (status < 0x80 || status >= 0xf0) throw new Error('Kein Channel-Voice-Status-Byte');
  const cin = status >> 4; // 0x8 … 0xE
  const length = cinLength(cin);
  if (msg.length !== length) throw new Error(`Erwartet ${length} Bytes, erhalten ${msg.length}`);
  const bytes = [...msg];
  while (bytes.length < 3) bytes.push(0x00);
  return Uint8Array.from([((cable & 0x0f) << 4) | cin, ...bytes]);
}

/**
 * Split a transfer into USB-MIDI packets: [{ cable, cin, bytes }].
 * Skips packets with CIN 0x0/0x1 (this includes all-zero padding)
 * and a trailing partial packet.
 */
export function unpackPackets(data) {
  const view = data instanceof DataView ? data : null;
  const length = view ? view.byteLength : data.length;
  const at = view ? (i) => view.getUint8(i) : (i) => data[i];
  const packets = [];
  for (let i = 0; i + 3 < length; i += 4) {
    const head = at(i);
    const cin = head & 0x0f;
    const n = cinLength(cin);
    if (n === 0) continue;
    const bytes = [];
    for (let k = 1; k <= n; k++) bytes.push(at(i + k));
    packets.push({ cable: head >> 4, cin, bytes });
  }
  return packets;
}

/**
 * Turns USB transfers into complete MIDI messages. A SysEx message can be
 * split over several transfers, and one transfer can hold several messages,
 * so feed every transfer in order.
 */
export class UsbMidiReceiver {
  constructor() {
    this.sysex = null;
  }

  /** Returns [{ sysex: bool, bytes: number[], incomplete?: true }]. */
  push(data) {
    const out = [];
    for (const { cin, bytes } of unpackPackets(data)) {
      const isSysexPacket = cin >= 0x4 && cin <= 0x7 && (cin === 0x4 || this.sysex || bytes[0] === 0xf0);
      if (isSysexPacket && bytes[0] === 0xf0 && this.sysex) {
        // A new message starts before the old one ended.
        out.push({ sysex: true, bytes: this.sysex, incomplete: true });
        this.sysex = null;
      }
      if (cin === 0x4) {
        if (!this.sysex) this.sysex = []; // also keeps a continuation whose start we missed
        this.sysex.push(...bytes);
      } else if (isSysexPacket) {
        const msg = [...(this.sysex || []), ...bytes];
        this.sysex = null;
        const complete = msg[0] === 0xf0 && msg[msg.length - 1] === 0xf7;
        out.push(complete ? { sysex: true, bytes: msg } : { sysex: true, bytes: msg, incomplete: true });
      } else {
        out.push({ sysex: false, bytes });
      }
    }
    return out;
  }
}
