import { describe, expect, it } from 'vitest';
import { Connection } from './connection.js';
import { Editor } from './editor.js';
import { KatanaClient } from './katana.js';
import { PatchLibrary, backupToPatch, memoryBackend } from './library.js';
import { Logger } from './log.js';
import { PatchManager } from './manager.js';
import { KNOBS, LIVE_OFFSETS, backupFile, nameBytes, patchDiff, patchName, patchWrites, serializePatch, parsePatch } from './patch.js';
import { PATCH_BYTES } from './sysex.js';
import { fakeKatana, samplePatch } from './testing/fake-katana.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, ms = 2000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('Bedingung nicht erfüllt');
    await sleep(5);
  }
}

const GAIN = KNOBS[0].address;
const GAIN_OFFSET = 0x06 * 128 + 0x51;

async function setup(options) {
  const amp = fakeKatana(options);
  const logger = new Logger();
  const connection = new Connection({
    transport: amp.transport(),
    logger,
    nav: { requestMIDIAccess() {} },
    createClient: (t) => new KatanaClient(t, { timeoutMs: 80, idleMs: 20, editModeDelayMs: 0 }),
  });
  const editor = new Editor(connection, { throttleMs: 10, verifyDelayMs: 20, channelSettleMs: 20, paceMs: 0 });
  const library = new PatchLibrary(memoryBackend());
  const manager = new PatchManager({ connection, editor, library, saveSettleMs: 10 });
  await connection.connect();
  await until(() => editor.loaded && manager.channelNames);
  const logged = (text) => logger.entries.some((e) => e.text.includes(text));
  return { amp, logger, connection, editor, library, manager, logged };
}

describe('patch helpers', () => {
  it('splits a patch into writes of at most 241 bytes and skips the LED bytes', () => {
    const map = samplePatch('Test');
    const writes = patchWrites(map);
    expect(writes.every((w) => w.data.length <= 241)).toBe(true);
    const written = writes.reduce((n, w) => n + w.data.length, 0);
    expect(written).toBe(PATCH_BYTES - LIVE_OFFSETS.size);
    // Panel block first, then the rest from the start of the patch.
    expect(writes[0].address).toEqual([0x60, 0x00, 0x06, 0x00]);
    expect(writes.find((w) => w.address[2] !== 0x06).address).toEqual([0x60, 0x00, 0x00, 0x00]);
    const panelEnd = writes.findIndex((w) => w.address[2] !== 0x06);
    expect(writes.slice(panelEnd).every((w) => w.address[2] !== 0x06)).toBe(true);
  });

  it('round-trips through the storage format', () => {
    const map = samplePatch('Rundreise');
    const back = parsePatch(serializePatch(map));
    expect(patchDiff(map, back)).toEqual([]);
    expect(back.size).toBe(PATCH_BYTES);
    expect(patchName(back)).toBe('Rundreise');
  });

  it('turns names into 16 ASCII bytes', () => {
    expect(nameBytes('Straße')).toEqual([...'Stra?e          '].map((c) => c.charCodeAt(0)));
    expect(nameBytes('a'.repeat(20))).toHaveLength(16);
  });
});

describe('PatchLibrary', () => {
  it('adds, renames, keeps and removes entries', async () => {
    const lib = new PatchLibrary();
    const a = await lib.add(samplePatch('Erster'), { origin: 'A1', createdAt: new Date('2026-11-01T10:00:00Z') });
    const b = await lib.add(samplePatch('Zweiter'), { kind: 'backup', origin: 'A2', createdAt: new Date('2026-11-01T11:00:00Z') });
    expect((await lib.list()).map((e) => e.name)).toEqual(['Zweiter', 'Erster']);

    const renamed = await lib.rename(a.id, 'Neuer Name');
    expect(renamed.name).toBe('Neuer Name');
    expect(patchName(lib.patchOf(renamed))).toBe('Neuer Name');

    expect((await lib.keep(b.id)).kind).toBe('patch');
    await lib.remove(a.id);
    expect(await lib.list()).toHaveLength(1);
  });

  it('exports and imports a library file', async () => {
    const lib = new PatchLibrary();
    await lib.add(samplePatch('Export'), { origin: 'B1' });
    const text = await lib.exportJson();
    const other = new PatchLibrary();
    expect(await other.importJson(text)).toBe(1);
    const [entry] = await other.list();
    expect(entry.name).toBe('Export');
    expect(entry.origin).toBe('B1');
    expect(patchDiff(other.patchOf(entry), samplePatch('Export'))).toEqual([]);
  });

  it('imports a backup file from "Backup speichern"', async () => {
    const map = samplePatch('Backup');
    const chunks = patchWrites(map).map((w) => ({ address: w.address, data: w.data }));
    const file = backupFile({ chunks, channel: 0, patchName: 'Backup', version: '06 00 00 00' });
    expect(patchName(backupToPatch(file))).toBe('Backup');
    const lib = new PatchLibrary();
    expect(await lib.importJson(JSON.stringify(file))).toBe(1);
  });

  it('rejects files it does not know', async () => {
    const lib = new PatchLibrary();
    await expect(lib.importJson('kein json')).rejects.toThrow('JSON');
    await expect(lib.importJson('{"format":"x"}')).rejects.toThrow('Dateiformat');
    await expect(lib.importJson(JSON.stringify({ format: 'katana-helper-library', patches: [{ patch: [{ offset: 0, data: 'FF' }] }] }))).rejects.toThrow();
  });
});

describe('PatchManager', () => {
  it('reads the names of all nine channels', async () => {
    const { manager } = await setup();
    expect(manager.channelNames).toEqual(['muur zusamstra?e', 'MUUR Main', 'MUUR Main FXLoop', 'Mono', 'Blackout', 'Lifer', 'ethereal', 'banjo', 'Princeton']);
  });

  it('copies a channel into the library without switching to it', async () => {
    const { amp, manager, library } = await setup();
    const entry = await manager.storeChannel(4);
    expect(entry.name).toBe('Blackout');
    expect(entry.size).toBe(PATCH_BYTES);
    expect(amp.channel).toBe(0);
    expect((await library.list())[0].origin).toBe('A4');
  });

  it('stores the current sound', async () => {
    const { manager, editor } = await setup();
    editor.set(GAIN, 0x44);
    const entry = await manager.storeCurrent();
    expect(parsePatch(entry.patch).get(GAIN_OFFSET)).toBe(0x44);
  });

  it('loads a library entry into the amp and can undo it', async () => {
    const { amp, manager, library, editor } = await setup();
    const map = samplePatch('Geladen');
    map.set(GAIN_OFFSET, 0x55);
    const entry = await library.add(map);
    const result = await manager.loadEntry(entry.id);
    expect(result.ok).toBe(true);
    expect(amp.byte(GAIN)).toBe(0x55);
    expect(editor.dirty).toBe(true);
    await editor.undo();
    expect(amp.byte(GAIN)).toBe(0x21);
  });

  it('backs up the channel, saves and confirms', async () => {
    const { amp, manager, library, editor, logged } = await setup();
    editor.set(GAIN, 0x60);
    await sleep(40);
    const result = await manager.saveToChannel(3, { name: 'Neu A3' });
    expect(result.ok).toBe(true);
    expect(amp.stored[3].get(GAIN_OFFSET)).toBe(0x60);
    expect(patchName(amp.stored[3])).toBe('Neu A3');
    expect(manager.channelNames[3]).toBe('Neu A3');
    expect(editor.dirty).toBe(false);

    const [backup] = (await library.list()).filter((e) => e.kind === 'backup');
    expect(backup.name).toBe('Mono');
    expect(backup.origin).toBe('A3');
    expect(logged('Gespeichert in A3 und bestätigt')).toBe(true);
  });

  it('warns when the channel does not match after saving', async () => {
    const { manager, editor, logged } = await setup({ saves: false });
    editor.set(GAIN, 0x60);
    await sleep(40);
    const result = await manager.saveToChannel(2);
    expect(result.ok).toBe(false);
    expect(editor.dirty).toBe(true);
    expect(logged('Byte weichen ab')).toBe(true);
  });

  it('does not save when the backup fails', async () => {
    const { amp, manager, connection } = await setup();
    const read = connection.client.read.bind(connection.client);
    connection.client.read = (address, ...rest) =>
      address[0] === 0x10 && address[1] === 5 ? Promise.reject(new Error('kaputt')) : read(address, ...rest);
    await expect(manager.saveToChannel(5)).rejects.toThrow('kaputt');
    expect(amp.sent.some((m) => m.includes('7F 00 01 04'))).toBe(false);
  });

  it('never saves to Panel', async () => {
    const { amp, manager, connection } = await setup();
    await expect(manager.saveToChannel(0)).rejects.toThrow('A1–B4');
    await expect(connection.client.saveToChannel(0)).rejects.toThrow();
    expect(amp.sent.some((m) => m.includes('7F 00 01 04'))).toBe(false);
  });

  it('runs one job at a time', async () => {
    const { manager } = await setup();
    const first = manager.storeChannel(1);
    await expect(manager.storeChannel(2)).rejects.toThrow('Bitte warten');
    await first;
  });

  it('writes a library entry into a channel', async () => {
    const { amp, manager, library } = await setup();
    const map = samplePatch('Aus Bibliothek');
    const entry = await library.add(map);
    const result = await manager.writeEntryToChannel(entry.id, 8);
    expect(result.ok).toBe(true);
    expect(patchName(amp.stored[8])).toBe('Aus Bibliothek');
  });
});
