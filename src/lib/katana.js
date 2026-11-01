// Talks to the Katana over any transport with send(bytes) and onMessage(listener).
// Requests run one after another; replies are matched by address range.

import {
  ADDR,
  IDENTITY_REQUEST,
  ROLAND_ID,
  buildDT1,
  buildEditMode,
  buildRQ1,
  fromBase128,
  hex,
  parseSysex,
} from './sysex.js';
import { asciiName, channelFromData } from './describe.js';

export const KATANA_FAMILY = [0x33, 0x03];
export const SAVE_COMMAND = [0x7f, 0x00, 0x01, 0x04];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class TimeoutError extends Error {
  constructor(what, ms) {
    super(`Keine Antwort auf ${what} nach ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

export function isKatanaMk2(identity) {
  return (
    identity?.manufacturer === ROLAND_ID &&
    identity.family?.[0] === KATANA_FAMILY[0] &&
    identity.family?.[1] === KATANA_FAMILY[1]
  );
}

export class KatanaClient {
  /**
   * timeoutMs: how long to wait for the first reply.
   * idleMs: after a partial reply, how long to wait for more before giving up on the rest.
   *   The amp skips undefined ranges, so a read may legitimately end early.
   * editModeDelayMs: pause after switching edit mode before the next request.
   */
  constructor(transport, { timeoutMs = 1500, idleMs = 250, editModeDelayMs = 150 } = {}) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.idleMs = idleMs;
    this.editModeDelayMs = editModeDelayMs;
    this.listeners = new Map();
    this.waiters = new Set();
    this.queue = Promise.resolve();
    this.editMode = false;
    this.unsubscribe = transport.onMessage((bytes) => this.handle(bytes));
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return () => this.listeners.get(event).delete(listener);
  }

  emit(event, payload) {
    for (const l of this.listeners.get(event) ?? []) l(payload);
  }

  /** Every outgoing message goes through here so the UI can log it. */
  send(bytes, label) {
    this.emit('send', { bytes: Array.from(bytes), label });
    this.transport.send(bytes);
  }

  handle(bytes) {
    const msg = bytes[0] === 0xf0 ? parseSysex(bytes) : { kind: 'midi', bytes };
    let claimed = false;
    for (const w of [...this.waiters]) {
      if (w.offer(msg)) claimed = true;
    }
    // `solicited` tells the UI whether this was a reply or something the amp sent on its own.
    this.emit('message', { msg, solicited: claimed });
    if (msg.kind === 'dt1' && msg.checksumOk) this.emit('dt1', { ...msg, solicited: claimed });
  }

  /** Run fn after all earlier requests have finished. */
  enqueue(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  identify() {
    return this.enqueue(
      () =>
        new Promise((resolve, reject) => {
          const waiter = {
            offer: (msg) => {
              if (msg.kind !== 'identity-reply') return false;
              finish();
              resolve({ ...msg, isKatanaMk2: isKatanaMk2(msg) });
              return true;
            },
          };
          const timer = setTimeout(() => {
            finish();
            reject(new TimeoutError('Identity Request', this.timeoutMs));
          }, this.timeoutMs);
          const finish = () => {
            clearTimeout(timer);
            this.waiters.delete(waiter);
          };
          this.waiters.add(waiter);
          this.send(IDENTITY_REQUEST, 'Identity Request');
        }),
    );
  }

  setEditMode(on) {
    return this.enqueue(async () => {
      this.send(buildEditMode(on), `Edit-Mode ${on ? 'an' : 'aus'}`);
      this.editMode = on;
      this.emit('edit-mode', on);
      if (this.editModeDelayMs > 0) await sleep(this.editModeDelayMs);
    });
  }

  /**
   * DT1: write bytes to the temporary patch or a system address. The amp does not answer.
   * Writing to the save command (7F 00 01 04) is refused: it overwrites a channel for good,
   * and katana-helper never saves without a separate, explicit feature (phase 3).
   */
  write(address, data, label = `DT1 ${hex(address)}`) {
    if (hex(address) === hex(SAVE_COMMAND)) {
      return Promise.reject(new Error('Speichern ist gesperrt'));
    }
    const message = buildDT1(address, data);
    return this.enqueue(async () => {
      this.send(message, label);
    });
  }

  /**
   * Store the temporary patch in channel n (1–8 = A1–B4) for good: DT1 7F 00 01 04 00 0n
   * (FxFloorBoard patchWriteDialog.cpp). Panel (0) is refused. Only PatchManager calls this,
   * after it has backed up the channel.
   */
  saveToChannel(n) {
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      return Promise.reject(new RangeError(`In Kanal ${n} wird nicht gespeichert (nur A1–B4)`));
    }
    const message = buildDT1(SAVE_COMMAND, [0x00, n]);
    return this.enqueue(async () => {
      this.send(message, `SPEICHERN in Kanal ${n}`);
    });
  }

  /**
   * Send edit mode off without waiting in the queue. For page unload, where async work
   * does not finish.
   */
  editModeOffNow() {
    if (!this.editMode) return;
    try {
      this.send(buildEditMode(false), 'Edit-Mode aus (Seite wird geschlossen)');
    } catch {
      // Port already gone; nothing to switch off.
    }
    this.editMode = false;
  }

  /**
   * RQ1 and collect the DT1 replies.
   * Resolves { address, size, chunks: [{ address, data }], received, complete,
   *            byteAt(address) }.
   */
  read(address, size, label = `RQ1 ${hex(address)}`) {
    return this.enqueue(
      () =>
        new Promise((resolve, reject) => {
          const start = fromBase128(address);
          const end = start + size;
          const chunks = [];
          let covered = start;
          let received = 0;
          let idle = null;

          const result = (complete) => {
            const bytes = new Map();
            for (const c of chunks) {
              const s = fromBase128(c.address);
              c.data.forEach((b, i) => bytes.set(s + i, b));
            }
            return {
              address,
              size,
              chunks,
              received,
              complete,
              byteAt: (a) => bytes.get(fromBase128(a)),
            };
          };

          const finish = () => {
            clearTimeout(timer);
            clearTimeout(idle);
            this.waiters.delete(waiter);
          };

          const waiter = {
            offer: (msg) => {
              if (msg.kind !== 'dt1' || !msg.checksumOk) return false;
              const s = fromBase128(msg.address);
              if (s < start || s >= end) return false;
              const data = msg.data.slice(0, end - s);
              chunks.push({ address: msg.address, data });
              received += data.length;
              covered = Math.max(covered, s + data.length);
              clearTimeout(timer);
              clearTimeout(idle);
              if (covered >= end) {
                finish();
                resolve(result(true));
              } else {
                idle = setTimeout(() => {
                  finish();
                  resolve(result(false));
                }, this.idleMs);
              }
              return true;
            },
          };

          const timer = setTimeout(() => {
            finish();
            reject(new TimeoutError(label, this.timeoutMs));
          }, this.timeoutMs);

          this.waiters.add(waiter);
          this.send(buildRQ1(address, size), label);
        }),
    );
  }

  async readName(address, label) {
    const r = await this.read(address, 16, label);
    return asciiName(r.chunks[0]?.data ?? []);
  }

  async readChannel() {
    const r = await this.read(ADDR.ACTIVE_CHANNEL, 2, 'RQ1 Aktiver Kanal');
    return channelFromData(r.chunks[0].data);
  }

  dispose() {
    this.unsubscribe?.();
    for (const w of this.waiters) this.waiters.delete(w);
  }
}

