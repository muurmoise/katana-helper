// Patches and channels: keep patches in the library, load them into the editor, save the
// current sound to a channel. Every save backs up the channel first and checks the result.

import { CHANNEL_NAMES, asciiName } from './describe.js';
import { PATCH_DUMP_SIZE, channelAddress, hex } from './sysex.js';
import { patchDiff, patchFromRead, patchFromState, patchName } from './patch.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class PatchManager {
  constructor({ connection, editor, library, saveSettleMs = 600 }) {
    this.connection = connection;
    this.editor = editor;
    this.library = library;
    this.saveSettleMs = saveSettleMs;
    this.channelNames = null; // index 0 = Panel, 1–8 = A1–B4
    this.busy = null; // text while a longer job runs
    this.listeners = new Set();

    // Read the channel names once the editor has its patch (keeps the start-up order calm).
    editor.onChange(() => {
      if (editor.ready && !this.channelNames && !this.namesLoading) this.readChannelNames();
      if (!editor.ready && connection.state !== 'connected') this.channelNames = null;
    });
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const l of this.listeners) l(this);
  }

  log(level, text) {
    this.connection.log(level, text);
  }

  get client() {
    return this.connection.client;
  }

  get firmware() {
    const id = this.connection.info.identity;
    return id ? hex(id.version) : null;
  }

  /** Run a job with a busy label; refuses to start a second one. */
  async job(label, fn) {
    if (this.busy) throw new Error(`Bitte warten: ${this.busy}`);
    this.busy = label;
    this.emit();
    try {
      return await fn();
    } finally {
      this.busy = null;
      this.emit();
    }
  }

  async readChannelNames() {
    if (!this.client) return;
    this.namesLoading = true;
    try {
      const names = [];
      for (let n = 0; n <= 8; n++) {
        const r = await this.client.read(channelAddress(n), 16, `RQ1 Name ${CHANNEL_NAMES[n]}`);
        names.push(asciiName(r.chunks[0]?.data ?? []));
      }
      this.channelNames = names;
    } catch (e) {
      this.log('warn', `Kanalnamen lesen: ${e.message}`);
    } finally {
      this.namesLoading = false;
      this.emit();
    }
  }

  /** Read a stored channel completely (10 0n 00 00), without switching to it. */
  async readChannel(n) {
    const r = await this.client.read(channelAddress(n), PATCH_DUMP_SIZE, `RQ1 Kanal ${CHANNEL_NAMES[n]}`);
    const map = patchFromRead(r, channelAddress(n));
    if (!r.complete || map.size < 1000) throw new Error(`Kanal ${CHANNEL_NAMES[n]} unvollständig gelesen (${map.size} Byte)`);
    return map;
  }

  /** Copy a channel into the library. kind 'backup' marks automatic copies. */
  storeChannel(n, { kind = 'patch', note = '' } = {}) {
    const run = async () => {
      const map = await this.readChannel(n);
      const entry = await this.library.add(map, { kind, origin: CHANNEL_NAMES[n], note, firmware: this.firmware });
      this.log('ok', `${kind === 'backup' ? 'Backup' : 'Gesichert'}: ${CHANNEL_NAMES[n]} "${entry.name}" (${map.size} Byte)`);
      return entry;
    };
    return kind === 'backup' ? run() : this.job(`${CHANNEL_NAMES[n]} sichern`, run);
  }

  /** Copy the sound as it is now (temporary patch) into the library. */
  storeCurrent() {
    return this.job('Aktuellen Klang sichern', async () => {
      if (!this.editor.ready) throw new Error('Nicht verbunden');
      const map = patchFromState(this.editor.state);
      const ch = CHANNEL_NAMES[this.connection.info.channel] ?? '?';
      const entry = await this.library.add(map, { origin: `Aktueller Klang (${ch})`, firmware: this.firmware });
      this.log('ok', `Gesichert: aktueller Klang "${entry.name}"`);
      return entry;
    });
  }

  /** Put a library entry into the temporary patch (the amp's current sound). */
  loadEntry(id) {
    return this.job('Patch laden', async () => {
      const entry = await this.library.get(id);
      if (!entry) throw new Error('Eintrag nicht gefunden');
      return this.editor.applyPatch(this.library.patchOf(entry));
    });
  }

  /**
   * Save the current sound to channel n (1–8), for good.
   * 1. Back up channel n into the library; stop if that fails.
   * 2. Optionally set the patch name.
   * 3. Send the save command.
   * 4. Read channel n back and compare with the current sound.
   */
  saveToChannel(n, { name = null } = {}) {
    return this.job(`Speichern in ${CHANNEL_NAMES[n]}`, async () => {
      if (!Number.isInteger(n) || n < 1 || n > 8) throw new RangeError('Speichern nur in A1–B4');
      if (!this.editor.ready) throw new Error('Nicht verbunden');
      const label = CHANNEL_NAMES[n];
      this.log('info', `===== Speichern in ${label} =====`);

      const backup = await this.storeChannel(n, { kind: 'backup', note: `Automatisch vor dem Speichern in ${label}` });

      if (name != null && name !== patchName(patchFromState(this.editor.state))) {
        this.editor.setName(name);
        await sleep(this.editor.verifyDelayMs + 50); // let the name write and read-back finish
      }

      const expected = patchFromState(this.editor.state);
      await this.client.saveToChannel(n);
      await sleep(this.saveSettleMs);

      const stored = await this.readChannel(n);
      const diff = patchDiff(expected, stored).filter((o) => expected.has(o));
      if (diff.length === 0) {
        this.log('ok', `Gespeichert in ${label} und bestätigt: "${patchName(stored)}"`);
        this.editor.commitBaseline();
      } else {
        this.log('warn', `Gespeichert in ${label}, aber ${diff.length} Byte weichen ab. Backup: "${backup.name}" in der Bibliothek.`);
      }
      await this.readChannelNames();
      await this.connection.refresh();
      return { ok: diff.length === 0, diff, backup };
    });
  }

  /** Load a library entry and save it to channel n (with backup). */
  async writeEntryToChannel(id, n, { name = null } = {}) {
    if (!Number.isInteger(n) || n < 1 || n > 8) throw new RangeError('Speichern nur in A1–B4');
    const result = await this.loadEntry(id);
    if (!result.ok) throw new Error('Patch wurde nicht vollständig übernommen, Speichern abgebrochen');
    return this.saveToChannel(n, { name });
  }
}
