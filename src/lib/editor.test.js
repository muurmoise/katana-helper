import { describe, expect, it } from 'vitest';
import { Connection } from './connection.js';
import { Editor } from './editor.js';
import { KatanaClient, SAVE_COMMAND } from './katana.js';
import { Logger } from './log.js';
import { BLOCK_SPANS, effectParams, encodeValue } from './effect-params.js';
import { AMP, EFFECTS, KNOBS, backupFile, runs } from './patch.js';
import { ADDR, fromBase128 } from './sysex.js';
import { fakeKatana } from './testing/fake-katana.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, ms = 1000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('Bedingung nicht erfüllt');
    await sleep(5);
  }
}

const GAIN = KNOBS.find((k) => k.key === 'gain').address;
const BOOSTER = EFFECTS[0];

async function setup() {
  const amp = fakeKatana();
  const logger = new Logger();
  const connection = new Connection({
    transport: amp.transport(),
    logger,
    nav: { requestMIDIAccess() {} },
    createClient: (t) => new KatanaClient(t, { timeoutMs: 60, idleMs: 20, editModeDelayMs: 0 }),
  });
  const editor = new Editor(connection, { throttleMs: 20, verifyDelayMs: 30, channelSettleMs: 20 });
  await connection.connect();
  await until(() => editor.loaded);
  const writesTo = (address) => amp.sent.filter((m) => m.startsWith(`F0 41 00 00 00 00 33 12 ${address}`));
  const logged = (text) => logger.entries.some((e) => e.text.includes(text));
  return { amp, logger, connection, editor, writesTo, logged };
}

describe('Editor', () => {
  it('reads the whole patch after connecting and keeps it as backup', async () => {
    const { editor } = await setup();
    expect(editor.state.get(GAIN)).toBe(0x21);
    expect(editor.state.get(AMP.model)).toBe(0x08);
    expect(editor.backup.chunks).toHaveLength(9);
    expect(editor.backup.patchName).toBe('muur zusamstra?e');
    expect(editor.dirty).toBe(false);
  });

  it('writes a value, reads it back and reports it', async () => {
    const { amp, editor, logged } = await setup();
    editor.set(GAIN, 0x30, { related: [KNOBS[0].preamp] });
    expect(editor.state.get(GAIN)).toBe(0x30);
    expect(editor.dirty).toBe(true);
    await until(() => logged('Bestätigt: Gain = 48'));
    expect(amp.byte(GAIN)).toBe(0x30);
  });

  it('writes two-byte values (delay time) and confirms them', async () => {
    const { amp, editor, writesTo, logged } = await setup();
    const time = effectParams('delay', 0).find((p) => p.label === 'Time');
    editor.set(time.address, encodeValue(time, 450));
    await until(() => logged('Bestätigt: Delay: Time = 450 ms'));
    expect(writesTo('60 00 05 02 03 42')).toHaveLength(1);
    expect([amp.byte([0x60, 0, 0x05, 0x02]), amp.byte([0x60, 0, 0x05, 0x03])]).toEqual([0x03, 0x42]);
    expect(editor.changed.size).toBe(2);
  });

  it('reads a whole range back when asked (effect knob moves the main parameter)', async () => {
    const { amp, editor, logged } = await setup();
    const rate = [0x60, 0x00, 0x02, 0x14];
    const mod = EFFECTS.find((e) => e.key === 'mod');
    editor.set(mod.knob, 0x30, { related: [BLOCK_SPANS.mod] });
    await until(() => amp.byte(mod.knob) === 0x30);
    amp.setByte(rate, 0x2f); // what the real amp does with the tremolo rate
    await until(() => logged('Rücklesen 60 00 01 00 (225 Byte)'));
    await until(() => editor.state.get(rate) === 0x2f);
  });

  it('sends at most one write per throttle period while a slider moves', async () => {
    const { amp, editor, writesTo } = await setup();
    for (let v = 10; v < 30; v++) editor.set(GAIN, v);
    await sleep(60);
    const writes = writesTo('60 00 06 51');
    expect(writes.length).toBeLessThanOrEqual(3);
    expect(amp.byte(GAIN)).toBe(29);
  });

  it('warns when the amp reports something else', async () => {
    const { amp, editor, logged } = await setup();
    editor.set(GAIN, 0x30);
    await until(() => amp.byte(GAIN) === 0x30);
    amp.setByte(GAIN, 0x31); // amp changed it again before the read-back
    await until(() => logged('Amp meldet Gain = 49'));
    expect(editor.state.get(GAIN)).toBe(0x31);
  });

  it('follows knobs turned on the amp', async () => {
    const { amp, editor } = await setup();
    let notified = 0;
    editor.onChange(() => notified++);
    amp.amp(GAIN, [0x40]);
    expect(editor.state.get(GAIN)).toBe(0x40);
    expect(notified).toBe(1);
    expect(editor.dirty).toBe(false);
  });

  it('takes back its own changes', async () => {
    const { amp, editor } = await setup();
    editor.set(GAIN, 0x50);
    editor.set(BOOSTER.on, 0);
    await sleep(50);
    expect(amp.byte(BOOSTER.on)).toBe(0);
    await editor.undo();
    expect(amp.byte(GAIN)).toBe(0x21);
    expect(amp.byte(BOOSTER.on)).toBe(1);
    expect(editor.dirty).toBe(false);
    expect(editor.state.get(GAIN)).toBe(0x21);
  });

  it('re-reads without losing the undo list', async () => {
    const { amp, editor } = await setup();
    editor.set(GAIN, 0x50);
    await sleep(50);
    await editor.load({ newBaseline: false });
    expect(editor.dirty).toBe(true);
    await editor.undo();
    expect(amp.byte(GAIN)).toBe(0x21);
  });

  it('switches channels and reads the new patch', async () => {
    const { amp, editor, connection } = await setup();
    editor.set(GAIN, 0x50);
    await editor.setChannel(3);
    expect(amp.channel).toBe(3);
    expect(connection.info.channel).toBe(3);
    expect(editor.loaded).toBe(true);
    expect(editor.dirty).toBe(false);
  });

  it('reloads when the channel is changed on the amp', async () => {
    const { amp, editor } = await setup();
    amp.setByte(GAIN, 0x11); // the other channel's patch
    amp.amp(ADDR.ACTIVE_CHANNEL, [0, 5]);
    await until(() => editor.loaded && editor.state.get(GAIN) === 0x11);
  });

  it('ignores channel replies meant for another MIDI client', async () => {
    // A second tab reads the channel; we see the reply. That must not start a re-read,
    // or two tabs keep triggering each other.
    const { amp, editor } = await setup();
    await sleep(30);
    const before = amp.sent.length;
    amp.amp(ADDR.ACTIVE_CHANNEL, [0, 0]);
    await sleep(400);
    expect(amp.sent.length).toBe(before);
    expect(editor.loaded).toBe(true);
  });

  it('does not count a value moved back to its start as a change', async () => {
    const { editor } = await setup();
    editor.set(GAIN, 0x40);
    expect(editor.dirty).toBe(true);
    editor.set(GAIN, 0x21);
    expect(editor.dirty).toBe(false);
  });

  it('does nothing while not connected', async () => {
    const { amp, editor, connection } = await setup();
    await connection.disconnect();
    const before = amp.sent.length;
    editor.set(GAIN, 0x10);
    expect(amp.sent.length).toBe(before);
    expect(editor.loaded).toBe(false);
  });

  it('never sends the save command', async () => {
    const { connection } = await setup();
    await expect(connection.client.write(SAVE_COMMAND, [0x00, 0x01])).rejects.toThrow('gesperrt');
  });
});

describe('patch helpers', () => {
  it('groups addresses into runs', () => {
    expect(runs([5, 3, 4, 10, 11, 4])).toEqual([
      [3, 3],
      [10, 2],
    ]);
  });

  it('writes a backup file', () => {
    const file = backupFile({
      chunks: [{ address: [0x60, 0, 0, 0], data: [1, 2] }],
      channel: 0,
      patchName: 'x',
      version: '06 00 00 00',
      date: new Date('2026-11-01T12:00:00Z'),
    });
    expect(file).toMatchObject({ format: 'katana-helper-backup', created: '2026-11-01T12:00:00.000Z' });
    expect(file.chunks).toEqual([{ address: '60 00 00 00', data: '01 02' }]);
  });

  it('describes the effects with three colour slots each', () => {
    expect(EFFECTS.map((e) => e.label)).toEqual(['Booster', 'MOD', 'FX', 'Delay', 'Reverb', 'Delay 2']);
    const [reverb, delay2] = EFFECTS.slice(4);
    expect(delay2.color).toEqual(reverb.color); // Delay 2 follows the reverb button
    expect(delay2.slots[0]).toEqual([0x60, 0x00, 0x06, 0x33]);
    for (const e of EFFECTS) expect(e.slots).toHaveLength(3);
    expect(BOOSTER.types.find(([v]) => v === 0x0f)[1]).toBe('Rat');
    expect(BOOSTER.types.some(([v]) => v === 0x07)).toBe(false);
  });
});
