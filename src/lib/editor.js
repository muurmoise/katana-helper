// Live editing of the temporary patch.
// - load(): read the whole patch. The first read after connecting doubles as backup.
// - set(): write a value at once (throttled while a slider moves), then read it back.
// - Messages the amp sends on its own (knobs, buttons, channel) update the state.
// - undo(): write back the original bytes of everything the editor changed.
// Nothing here ever saves to a channel.

import { PATCH_DUMP_SIZE, ADDR, fromBase128, hex, toBase128 } from './sysex.js';
import { channelFromData, describe } from './describe.js';
import { PatchState, backupFile, runs } from './patch.js';

const key = (address) => hex(address);

export class Editor {
  constructor(connection, { throttleMs = 40, verifyDelayMs = 350, channelSettleMs = 400 } = {}) {
    this.connection = connection;
    this.throttleMs = throttleMs;
    this.verifyDelayMs = verifyDelayMs;
    this.channelSettleMs = channelSettleMs;
    this.state = new PatchState();
    this.baseline = new Map();
    this.changed = new Set();
    this.backup = null;
    this.loaded = false;
    this.loading = null;
    this.writes = new Map(); // key → { address, data, lastSent, timer, verifyTimer, related, label }
    this.reloadTimer = null;
    this.loadedChannel = null;
    this.listeners = new Set();

    connection.onChange((c) => {
      if (c.state === 'connected' && !this.loaded && !this.loading) this.load();
      if (c.state !== 'connected' && c.state !== 'connecting') this.reset();
    });
    connection.onData((msg) => this.fromAmp(msg));
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const l of this.listeners) l(this);
  }

  get ready() {
    return this.loaded && this.connection.state === 'connected' && !!this.connection.client;
  }

  get dirty() {
    return this.changed.size > 0;
  }

  log(level, text, options) {
    this.connection.log(level, text, options);
  }

  reset() {
    for (const w of this.writes.values()) {
      clearTimeout(w.timer);
      clearTimeout(w.verifyTimer);
    }
    this.writes.clear();
    clearTimeout(this.reloadTimer);
    if (this.loaded) {
      this.loaded = false;
      this.emit();
    }
  }

  /**
   * Read the whole temporary patch.
   * newBaseline: make it the new starting point for undo and the backup (default). With
   * false the editor only syncs its view and keeps the list of its own changes.
   */
  load({ newBaseline = true } = {}) {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const client = this.connection.client;
      if (!client) return;
      this.log('info', '===== Patch lesen =====');
      try {
        const r = await client.read(ADDR.PATCH, PATCH_DUMP_SIZE, 'RQ1 ganzer Patch');
        this.state.load(r.chunks);
        this.loaded = true;
        this.loadedChannel = this.connection.info.channel;
        if (!newBaseline && this.baseline.size) {
          this.log('ok', `Patch neu gelesen: ${r.received} Byte`);
          return;
        }
        this.baseline = this.state.snapshot();
        this.changed.clear();
        const info = this.connection.info;
        // Every full read is the new starting point: undo goes back to it, and it is the backup.
        this.backup = backupFile({
          chunks: r.chunks,
          channel: info.channel,
          patchName: info.patchName,
          version: info.identity ? hex(info.identity.version) : null,
        });
        this.log('ok', `Patch gelesen: ${r.received} Byte in ${r.chunks.length} Nachrichten${r.complete ? '' : ' (unvollständig)'}`);
      } catch (e) {
        this.log('err', `Patch lesen: ${e.message}`);
      } finally {
        this.loading = null;
        this.emit();
      }
    })();
    return this.loading;
  }

  /**
   * Change a value. `data` is a byte or an array of bytes.
   * options.related: addresses to read back as well, to see what else the amp changed.
   */
  set(address, data, { related = [], label } = {}) {
    if (!this.ready) return;
    const bytes = Array.isArray(data) ? data : [data];
    const k = key(address);
    const start = fromBase128(address);

    this.state.apply(address, bytes);
    // A value back at its starting point no longer counts as changed.
    bytes.forEach((b, i) => {
      if (this.baseline.get(start + i) === b) this.changed.delete(start + i);
      else this.changed.add(start + i);
    });

    const w = this.writes.get(k) ?? { address, lastSent: -Infinity, timer: null, verifyTimer: null };
    Object.assign(w, { data: bytes, related, label: label ?? describe(address, bytes) });
    this.writes.set(k, w);

    const now = Date.now();
    const wait = w.lastSent + this.throttleMs - now;
    if (wait <= 0) this.flush(w);
    else if (!w.timer) w.timer = setTimeout(() => this.flush(w), wait);

    clearTimeout(w.verifyTimer);
    w.verifyTimer = setTimeout(() => this.verify(w), this.verifyDelayMs);
    this.emit();
  }

  flush(w) {
    clearTimeout(w.timer);
    w.timer = null;
    w.lastSent = Date.now();
    const client = this.connection.client;
    if (!client) return;
    client.write(w.address, w.data, `Setzen: ${describe(w.address, w.data)}`).catch((e) => this.log('err', e.message));
  }

  /** Read the value back and report whether the amp took it. Then read related values. */
  async verify(w) {
    const client = this.connection.client;
    if (!client) return;
    const expected = w.data;
    try {
      const r = await client.read(w.address, expected.length, `Rücklesen ${hex(w.address)}`);
      const got = expected.map((_, i) => r.byteAt(toBase128(fromBase128(w.address) + i)));
      if (got.every((b, i) => b === expected[i])) {
        this.log('ok', `Bestätigt: ${describe(w.address, got)}`);
      } else {
        this.log('warn', `Amp meldet ${describe(w.address, got)}, gesendet war ${hex(expected)}`);
        if (got.every((b) => b !== undefined)) this.state.apply(w.address, got);
      }
      for (const rel of w.related) {
        const rr = await client.read(rel, 1, `Rücklesen ${hex(rel)}`);
        const b = rr.byteAt(rel);
        if (b !== undefined) this.state.apply(rel, [b]);
      }
    } catch (e) {
      this.log('warn', `Rücklesen: ${e.message}`);
    }
    this.emit();
  }

  /** Switch channel (00 01 00 00). Unsaved edits of the current patch are lost, as on the amp. */
  async setChannel(n) {
    if (!this.ready) return;
    this.reset();
    this.log('info', `===== Kanal wechseln: ${n} =====`);
    await this.connection.client.write(ADDR.ACTIVE_CHANNEL, [0x00, n], `Kanal setzen: ${describe(ADDR.ACTIVE_CHANNEL, [0, n])}`);
    // Give the amp time to load the channel. refresh() reads channel and names and then
    // notifies listeners, which starts the patch read (see constructor).
    await new Promise((r) => setTimeout(r, this.channelSettleMs));
    await this.connection.refresh();
    await this.load();
  }

  /** Write back the starting values of everything the editor changed, then re-read. */
  async undo() {
    if (!this.ready || !this.dirty) return;
    this.log('info', `===== Änderungen zurücknehmen (${this.changed.size} Byte) =====`);
    for (const w of this.writes.values()) {
      clearTimeout(w.timer);
      clearTimeout(w.verifyTimer);
    }
    this.writes.clear();
    const client = this.connection.client;
    for (const [start, length] of runs(this.changed)) {
      const data = Array.from({ length }, (_, i) => this.baseline.get(start + i));
      if (data.some((b) => b === undefined)) continue;
      await client.write(toBase128(start), data, `Zurück: ${describe(toBase128(start), data)}`);
    }
    await this.load();
  }

  /** Handle a DT1 from the amp. Replies to our own reads are handled by the reader. */
  fromAmp(msg) {
    if (msg.solicited || !this.loaded) return;
    if (hex(msg.address) === hex(ADDR.ACTIVE_CHANNEL)) {
      // Channel changed on the amp: a different patch is active now. Replies to other MIDI
      // clients carry the same channel and are ignored (see Connection.track).
      const channel = channelFromData(msg.data);
      if (channel === this.loadedChannel) return;
      this.loadedChannel = channel;
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => {
        this.loaded = false;
        this.load();
      }, this.channelSettleMs);
      return;
    }
    if (msg.address[0] === 0x60) {
      this.state.apply(msg.address, msg.data);
      this.emit();
    }
  }

  backupText() {
    return this.backup ? JSON.stringify(this.backup, null, 2) : null;
  }
}
