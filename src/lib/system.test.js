import { describe, expect, it } from 'vitest';
import { Connection } from './connection.js';
import { Editor } from './editor.js';
import { KatanaClient } from './katana.js';
import { Logger } from './log.js';
import { hex } from './sysex.js';
import {
  AIR_FEEL,
  SYSTEM_ADDR,
  SystemSettings,
  airFeelMessage,
  airFeelName,
  airFeelRequest,
  readAirFeel,
  readLineOutCustom,
  setAirFeel,
} from './system.js';
import { describe as label } from './describe.js';
import { fakeKatana } from './testing/fake-katana.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, ms = 1000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('Bedingung nicht erfüllt');
    await sleep(5);
  }
}

// The exact messages from docs/protocol.md section 12.2.
const DOC = {
  read: 'F0 41 00 00 00 00 33 11 00 00 00 29 00 00 00 01 56 F7',
  REC: 'F0 41 00 00 00 00 33 12 00 00 00 29 00 57 F7',
  LIVE: 'F0 41 00 00 00 00 33 12 00 00 00 29 01 56 F7',
  BLEND: 'F0 41 00 00 00 00 33 12 00 00 00 29 02 55 F7',
  customRead: 'F0 41 00 00 00 00 33 11 00 00 01 10 00 00 00 01 6E F7',
};

const client = (amp) => new KatanaClient(amp.transport(), { timeoutMs: 60, idleMs: 20, editModeDelayMs: 0 });

async function openClient(amp) {
  const c = client(amp);
  await c.transport.open();
  c.transport.autoSelect();
  return c;
}

async function setup(options) {
  const amp = fakeKatana(options);
  const logger = new Logger();
  const connection = new Connection({
    transport: amp.transport(),
    logger,
    nav: { requestMIDIAccess() {} },
    createClient: (t) => new KatanaClient(t, { timeoutMs: 60, idleMs: 20, editModeDelayMs: 0 }),
  });
  const editor = new Editor(connection, { throttleMs: 20, verifyDelayMs: 30, channelSettleMs: 20 });
  const system = new SystemSettings(connection, { verifyDelayMs: 10 });
  await connection.connect();
  await until(() => editor.loaded && !system.loading && (system.loaded || !!system.error));
  const logged = (text) => logger.entries.some((e) => e.text.includes(text));
  const airFeelWrites = () => amp.sent.filter((m) => m.startsWith('F0 41 00 00 00 00 33 12 00 00 00 29'));
  return { amp, logger, connection, editor, system, logged, airFeelWrites };
}

describe('Air Feel messages', () => {
  it('match the bytes documented in docs/protocol.md, checksum included', () => {
    expect(hex(airFeelRequest())).toBe(DOC.read);
    for (const name of ['REC', 'LIVE', 'BLEND']) expect(hex(airFeelMessage(name))).toBe(DOC[name]);
  });

  it('map REC/LIVE/BLEND to 00/01/02 and back', () => {
    expect(AIR_FEEL).toEqual({ REC: 0, LIVE: 1, BLEND: 2 });
    expect([0, 1, 2, 3].map(airFeelName)).toEqual(['REC', 'LIVE', 'BLEND', null]);
    expect(SYSTEM_ADDR.AIR_FEEL).toEqual([0x00, 0x00, 0x00, 0x29]);
  });

  it('refuse unknown values', () => {
    expect(() => airFeelMessage('STUDIO')).toThrow(RangeError);
    expect(() => airFeelMessage(1)).toThrow(RangeError);
  });

  it('have German labels in the log', () => {
    expect(label(SYSTEM_ADDR.AIR_FEEL, [0x02])).toBe('System: Line Out Air Feel = BLEND (02)');
    expect(label(SYSTEM_ADDR.LINE_OUT_CUSTOM, [0x00])).toBe('System: Line Out Custom = aus');
  });
});

describe('readAirFeel / setAirFeel', () => {
  it('send the documented RQ1 and DT1 and use the amp memory', async () => {
    const amp = fakeKatana();
    const c = await openClient(amp);
    expect(await readAirFeel(c)).toBe('REC');
    expect(amp.sent.at(-1)).toBe(DOC.read);

    await setAirFeel(c, 'BLEND');
    expect(amp.sent.at(-1)).toBe(DOC.BLEND);
    expect(amp.systemByte(SYSTEM_ADDR.AIR_FEEL)).toBe(0x02);
    expect(await readAirFeel(c)).toBe('BLEND');

    expect(await readLineOutCustom(c)).toBe(false);
    expect(amp.sent.at(-1)).toBe(DOC.customRead);
  });

  it('report unknown values and missing answers', async () => {
    const amp = fakeKatana();
    amp.system.set(0x29, 0x05);
    const c = await openClient(amp);
    await expect(readAirFeel(c)).rejects.toThrow('unbekannter Wert 05');
    amp.setSystem({ answers: false });
    await expect(readAirFeel(c)).rejects.toThrow('Keine Antwort');
  });

  it('never touch the save command or the patch', async () => {
    const amp = fakeKatana();
    const c = await openClient(amp);
    const before = new Map(amp.temp);
    await setAirFeel(c, 'LIVE');
    expect(amp.sent.some((m) => m.includes('7F 00 01 04'))).toBe(false);
    expect(amp.temp).toEqual(before);
  });
});

describe('SystemSettings', () => {
  it('reads Air Feel and Line Out Custom after connecting', async () => {
    const { system, logged } = await setup();
    expect(system.airFeel).toBe('REC');
    expect(system.lineOutCustom).toBe(false);
    expect(system.ready).toBe(true);
    expect(logged('System: Line Out Air Feel = REC')).toBe(true);
  });

  it('is not usable without an amp', async () => {
    const { connection, system } = await setup();
    await connection.disconnect();
    expect(system.ready).toBe(false);
    expect(system.airFeel).toBe(null);
    expect(await system.setAirFeel('LIVE')).toBe(false);
  });

  it('switches, reads back and confirms', async () => {
    const { amp, system, editor, logged } = await setup();
    const seen = [];
    system.onChange((s) => seen.push([s.airFeel, s.busy]));
    expect(await system.setAirFeel('LIVE')).toBe(true);
    expect(amp.systemByte(SYSTEM_ADDR.AIR_FEEL)).toBe(0x01);
    expect(system.airFeel).toBe('LIVE');
    expect(system.error).toBe(null);
    expect(logged('Bestätigt: Line Out Air Feel = LIVE')).toBe(true);
    expect(seen[0]).toEqual(['LIVE', true]);
    expect(seen.at(-1)).toEqual(['LIVE', false]);
    // A system setting is not a patch change.
    expect(editor.dirty).toBe(false);
  });

  it('writes the old value back when the amp keeps another one', async () => {
    const { amp, system, airFeelWrites } = await setup();
    amp.setSystem({ writes: false });
    expect(await system.setAirFeel('BLEND')).toBe(false);
    expect(system.airFeel).toBe('REC');
    expect(system.error).toContain('BLEND wurde nicht übernommen');
    expect(system.error).toContain('Wieder auf REC gestellt');
    expect(airFeelWrites()).toEqual([DOC.BLEND, DOC.REC]);
  });

  it('reports a timeout and shows the old value', async () => {
    const { amp, system, airFeelWrites } = await setup();
    amp.setSystem({ answers: false });
    expect(await system.setAirFeel('LIVE')).toBe(false);
    expect(system.airFeel).toBe('REC');
    expect(system.error).toContain('Keine Antwort');
    expect(airFeelWrites()).toEqual([DOC.LIVE, DOC.REC]);
    expect(system.busy).toBe(false);
  });

  it('follows changes the amp reports on its own', async () => {
    const { amp, system } = await setup();
    amp.amp(SYSTEM_ADDR.AIR_FEEL, [0x02]);
    expect(system.airFeel).toBe('BLEND');
    amp.amp(SYSTEM_ADDR.LINE_OUT_CUSTOM, [0x01]);
    expect(system.lineOutCustom).toBe(true);
  });

  it('shows an error when Air Feel cannot be read', async () => {
    const { system } = await setup({ systemAnswers: false });
    expect(system.loaded).toBe(false);
    expect(system.ready).toBe(false);
    expect(system.error).toContain('Air Feel konnte nicht gelesen werden');
  });
});
