// Roland SysEx for the BOSS Katana MkII.
// Message format and addresses: docs/protocol.md.

export const ROLAND_ID = 0x41;
export const DEVICE_ID = 0x00;
export const MODEL_ID = [0x00, 0x00, 0x00, 0x33];
export const CMD_RQ1 = 0x11;
export const CMD_DT1 = 0x12;

/** F0 41 00 00 00 00 33 – the part every Katana message starts with. */
export const HEADER = [0xf0, ROLAND_ID, DEVICE_ID, ...MODEL_ID];

/** Universal identity request (no Roland header). */
export const IDENTITY_REQUEST = [0xf0, 0x7e, 0x00, 0x06, 0x01, 0xf7];

/** Addresses used by the probe and phase 1 (see docs/protocol.md). */
export const ADDR = {
  EDIT_MODE: [0x7f, 0x00, 0x00, 0x01],
  // Sources call this the device name. On our amp it returned the patch name, so it is
  // probably the stored Panel patch (A1–B4 follow at 10 01 … 10 08). See docs/protocol.md 2.2.
  PANEL_NAME: [0x10, 0x00, 0x00, 0x00],
  ACTIVE_CHANNEL: [0x00, 0x01, 0x00, 0x00],
  PATCH: [0x60, 0x00, 0x00, 0x00],
  PATCH_NAME: [0x60, 0x00, 0x00, 0x00],
  AMP_TYPE_KNOB: [0x60, 0x00, 0x06, 0x50],
  GAIN: [0x60, 0x00, 0x06, 0x51],
};

/**
 * Size to ask for when reading a whole patch: 00 00 0F 48 = 1992, as FxFloorBoard does.
 * The amp skips 60 00 07 44–07 7F and answers 1932 bytes (tested 2026-11-01). The older
 * value 1920 (00 00 0F 00) cut off the last 72 bytes.
 */
export const PATCH_DUMP_SIZE = 1992;

/** Bytes a full patch read returns (1992 minus the 60-byte gap). */
export const PATCH_BYTES = 1932;

/** Stored channel n (0 = Panel, 1–8 = A1–B4), same layout as the temporary patch. */
export function channelAddress(n) {
  if (!Number.isInteger(n) || n < 0 || n > 8) throw new RangeError(`Kanal ${n} gibt es nicht`);
  return [0x10, n, 0x00, 0x00];
}

/**
 * Roland checksum over address + data bytes:
 * (128 - (sum mod 128)) mod 128.
 */
export function checksum(bytes) {
  let sum = 0;
  for (const b of bytes) sum = (sum + b) & 0x7f;
  return (128 - sum) & 0x7f;
}

/** Number → 4 bytes, 7 bits each, most significant first. */
export function toBase128(value, length = 4) {
  if (!Number.isInteger(value) || value < 0 || value >= 128 ** length) {
    throw new RangeError(`Wert ${value} passt nicht in ${length} 7-Bit-Bytes`);
  }
  const out = new Array(length);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = value & 0x7f;
    value = Math.floor(value / 128);
  }
  return out;
}

/** 7-bit bytes, most significant first → number. */
export function fromBase128(bytes) {
  let value = 0;
  for (const b of bytes) value = value * 128 + b;
  return value;
}

function assert7Bit(bytes, what) {
  if (bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 0x7f)) {
    throw new RangeError(`${what} enthält Bytes außerhalb von 00–7F`);
  }
}

function assertAddress(address) {
  if (address.length !== 4) throw new RangeError('Adresse muss 4 Bytes lang sein');
  assert7Bit(address, 'Adresse');
}

function frame(command, body) {
  return Uint8Array.from([...HEADER, command, ...body, checksum(body), 0xf7]);
}

/** RQ1: ask the amp to send `size` bytes starting at `address`. */
export function buildRQ1(address, size) {
  assertAddress(address);
  const sizeBytes = Array.isArray(size) ? size : toBase128(size);
  if (sizeBytes.length !== 4) throw new RangeError('Größe muss 4 Bytes lang sein');
  assert7Bit(sizeBytes, 'Größe');
  return frame(CMD_RQ1, [...address, ...sizeBytes]);
}

/** DT1: write `data` starting at `address`. */
export function buildDT1(address, data) {
  assertAddress(address);
  const bytes = Array.from(data);
  if (bytes.length === 0) throw new RangeError('DT1 braucht mindestens 1 Datenbyte');
  assert7Bit(bytes, 'Daten');
  return frame(CMD_DT1, [...address, ...bytes]);
}

export function buildEditMode(on) {
  return buildDT1(ADDR.EDIT_MODE, [on ? 0x01 : 0x00]);
}

/**
 * Parse one complete SysEx message (F0 … F7).
 * Returns { kind, … } where kind is 'rq1', 'dt1', 'identity-reply',
 * 'identity-request' or 'unknown'. Roland messages carry checksumOk.
 */
export function parseSysex(input) {
  const msg = Array.from(input);
  if (msg[0] !== 0xf0 || msg[msg.length - 1] !== 0xf7) {
    return { kind: 'unknown', reason: 'kein vollständiges F0…F7', bytes: msg };
  }

  if (msg[1] === 0x7e && msg[3] === 0x06) {
    if (msg[4] === 0x01) return { kind: 'identity-request', bytes: msg };
    if (msg[4] === 0x02) {
      return {
        kind: 'identity-reply',
        deviceId: msg[2],
        manufacturer: msg[5],
        family: msg.slice(6, 8),
        member: msg.slice(8, 10),
        version: msg.slice(10, msg.length - 1),
        bytes: msg,
      };
    }
  }

  const isKatana = HEADER.every((b, i) => msg[i] === b);
  if (!isKatana || msg.length < 14) {
    return { kind: 'unknown', reason: 'kein Katana-Header', bytes: msg };
  }

  const command = msg[7];
  const body = msg.slice(8, msg.length - 2);
  const received = msg[msg.length - 2];
  const expected = checksum(body);
  const base = {
    address: body.slice(0, 4),
    checksum: received,
    expectedChecksum: expected,
    checksumOk: received === expected,
    bytes: msg,
  };

  if (command === CMD_DT1) return { kind: 'dt1', ...base, data: body.slice(4) };
  if (command === CMD_RQ1 && body.length === 8) {
    const size = body.slice(4);
    return { kind: 'rq1', ...base, size, sizeValue: fromBase128(size) };
  }
  return { kind: 'unknown', reason: `Befehl ${hex([command])}`, ...base };
}

/** Address + offset, counting in base 128 like the amp does. */
export function addAddress(address, offset) {
  return toBase128(fromBase128(address) + offset);
}

export function sameAddress(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Bytes → "F0 41 00 …" */
export function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** "F0 41 00" or "f04100" → array of bytes. */
export function parseHex(text) {
  const clean = text.replace(/[^0-9a-f]/gi, '');
  if (clean.length % 2 !== 0) throw new Error('Ungerade Anzahl Hex-Ziffern');
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

/** Printable ASCII, other bytes as '.' */
export function ascii(bytes) {
  return Array.from(bytes, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
}
