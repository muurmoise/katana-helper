// Global SYSTEM settings of the Katana MkII. They live at 00 00 xx xx, outside the patch
// (60 00 …, 10 0n …), apply to every channel and are not part of a patch or backup.
// Addresses and values: docs/protocol.md section 12.
//
// Line Out Air Feel (00 00 00 29): REC / LIVE / BLEND. Affects LINE OUT, PHONES/REC OUT and
// USB audio only, not the speaker. Line Out Custom (00 00 01 10) replaces it when on.

import { buildDT1, buildRQ1, hex } from './sysex.js';

export const SYSTEM_ADDR = {
  AIR_FEEL: [0x00, 0x00, 0x00, 0x29],
  LINE_OUT_CUSTOM: [0x00, 0x00, 0x01, 0x10],
};

/** Air Feel name → byte at 00 00 00 29 (FxFloorBoard midi.xml: Record, Live, Blend). */
export const AIR_FEEL = Object.freeze({ REC: 0x00, LIVE: 0x01, BLEND: 0x02 });

export const AIR_FEEL_NAMES = Object.freeze(Object.keys(AIR_FEEL));

/** Byte → 'REC' | 'LIVE' | 'BLEND', or null for anything else. */
export function airFeelName(byte) {
  return AIR_FEEL_NAMES.find((n) => AIR_FEEL[n] === byte) ?? null;
}

function airFeelByte(name) {
  if (!Object.hasOwn(AIR_FEEL, name)) throw new RangeError(`Air Feel "${name}" gibt es nicht (REC, LIVE, BLEND)`);
  return AIR_FEEL[name];
}

/** RQ1 for the Air Feel byte. */
export function airFeelRequest() {
  return buildRQ1(SYSTEM_ADDR.AIR_FEEL, 1);
}

/** DT1 that sets Air Feel to `name`. */
export function airFeelMessage(name) {
  return buildDT1(SYSTEM_ADDR.AIR_FEEL, [airFeelByte(name)]);
}

/** Read Air Feel through a KatanaClient. Resolves 'REC' | 'LIVE' | 'BLEND'. */
export async function readAirFeel(client) {
  const r = await client.read(SYSTEM_ADDR.AIR_FEEL, 1, 'Line Out Air Feel lesen');
  const byte = r.byteAt(SYSTEM_ADDR.AIR_FEEL);
  if (byte === undefined) throw new Error('Line Out Air Feel: keine Daten in der Antwort');
  const name = airFeelName(byte);
  if (!name) throw new Error(`Line Out Air Feel: unbekannter Wert ${hex([byte])}`);
  return name;
}

/** Set Air Feel through a KatanaClient (DT1, the amp does not answer). */
export function setAirFeel(client, name) {
  const byte = airFeelByte(name);
  return client.write(SYSTEM_ADDR.AIR_FEEL, [byte], `Line Out Air Feel = ${name}`);
}

/** Read whether Line Out Custom is on (00 00 01 10). Resolves true/false. */
export async function readLineOutCustom(client) {
  const r = await client.read(SYSTEM_ADDR.LINE_OUT_CUSTOM, 1, 'Line Out Custom lesen');
  const byte = r.byteAt(SYSTEM_ADDR.LINE_OUT_CUSTOM);
  if (byte === undefined) throw new Error('Line Out Custom: keine Daten in der Antwort');
  return byte !== 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The "System (global)" settings of the app, without DOM.
 * - Reads Air Feel (and Line Out Custom) after every connect.
 * - setAirFeel(): DT1, then read back. On a mismatch or timeout it reports an error and
 *   writes the previous value back.
 * - Picks up Air Feel changes the amp reports on its own (e.g. from BOSS Tone Studio).
 */
export class SystemSettings {
  constructor(connection, { verifyDelayMs = 150 } = {}) {
    this.connection = connection;
    this.verifyDelayMs = verifyDelayMs;
    this.listeners = new Set();
    this.reset();

    connection.onChange((c) => {
      if (c.state === 'connected' && !this.loaded && !this.loading) this.load();
      if (c.state !== 'connected' && c.state !== 'connecting') this.reset();
    });
    connection.onData((msg) => this.fromAmp(msg));
  }

  reset() {
    this.airFeel = null;
    this.lineOutCustom = null;
    this.loaded = false;
    this.loading = null;
    this.busy = false;
    this.error = null;
    this.emit();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const l of this.listeners ?? []) l(this);
  }

  get client() {
    return this.connection.state === 'connected' ? this.connection.client : null;
  }

  /** The switch can be used: amp connected, value known, nothing in progress. */
  get ready() {
    return !!this.client && this.loaded && !this.busy;
  }

  log(level, text) {
    this.connection.log(level, text);
  }

  load() {
    this.loading = (async () => {
      const client = this.client;
      if (!client) return;
      try {
        this.airFeel = await readAirFeel(client);
        this.loaded = true;
        this.error = null;
        this.log('info', `System: Line Out Air Feel = ${this.airFeel}`);
      } catch (e) {
        this.error = `Air Feel konnte nicht gelesen werden: ${e.message}`;
        this.log('err', this.error);
      }
      try {
        this.lineOutCustom = await readLineOutCustom(client);
        if (this.lineOutCustom) this.log('warn', 'System: Line Out Custom ist an, Air Feel wirkt dann nicht');
      } catch (e) {
        this.lineOutCustom = null;
        this.log('warn', `Line Out Custom konnte nicht gelesen werden: ${e.message}`);
      }
    })().finally(() => {
      this.loading = null;
      this.emit();
    });
    this.emit();
    return this.loading;
  }

  /**
   * Switch Air Feel. Resolves true when the amp confirmed the new value.
   * On failure: `error` is set, the previous value is written back and shown.
   */
  async setAirFeel(name) {
    airFeelByte(name);
    const client = this.client;
    if (!client || !this.loaded || this.busy) return false;
    const previous = this.airFeel;
    if (name === previous) return true;

    this.busy = true;
    this.error = null;
    this.airFeel = name;
    this.emit();
    try {
      await setAirFeel(client, name);
      await sleep(this.verifyDelayMs);
      const got = await readAirFeel(client);
      if (got !== name) throw new Error(`Amp meldet ${got} statt ${name}`);
      this.log('ok', `Bestätigt: Line Out Air Feel = ${name}`);
      return true;
    } catch (e) {
      this.log('err', `Air Feel ${name} nicht übernommen: ${e.message}`);
      this.airFeel = await this.restore(client, previous);
      this.error = `${name} wurde nicht übernommen (${e.message}). ${
        this.airFeel === previous ? `Wieder auf ${previous} gestellt.` : `Der Amp meldet jetzt ${this.airFeel ?? 'nichts'}.`
      }`;
      return false;
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  /** Write `previous` back and read what the amp has now. Falls back to `previous`. */
  async restore(client, previous) {
    try {
      await setAirFeel(client, previous);
      await sleep(this.verifyDelayMs);
      const now = await readAirFeel(client);
      this.log(now === previous ? 'ok' : 'err', `Air Feel zurückgesetzt, Amp meldet ${now}`);
      return now;
    } catch (e) {
      this.log('err', `Air Feel zurücksetzen: ${e.message}`);
      return previous;
    }
  }

  fromAmp(msg) {
    if (!this.loaded || this.busy || !msg.checksumOk) return;
    const at = (a) => hex(msg.address) === hex(a);
    if (at(SYSTEM_ADDR.AIR_FEEL) && msg.data.length >= 1) {
      const name = airFeelName(msg.data[0]);
      if (name && name !== this.airFeel) {
        this.airFeel = name;
        this.emit();
      }
    } else if (at(SYSTEM_ADDR.LINE_OUT_CUSTOM) && msg.data.length >= 1) {
      const on = msg.data[0] !== 0;
      if (on !== this.lineOutCustom) {
        this.lineOutCustom = on;
        this.emit();
      }
    }
  }
}
