import { describe, expect, it } from 'vitest';
import { Connection } from './connection.js';
import { KatanaClient } from './katana.js';
import { Logger } from './log.js';
import { WebMidiTransport } from './midi-transport.js';
import { ADDR, buildDT1, hex, parseHex, parseSysex } from './sysex.js';

const IDENTITY_REPLY = parseHex('F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7');
const NAME = [...'muur zusamstra?e'].map((c) => c.charCodeAt(0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fake MIDIAccess with a simulated amp behind the "KATANA" ports. The amp answers identity
 * requests and RQ1 for the addresses phase 1 reads, like the real one did (protocol.md 10).
 */
function setup({ answers = true, katana = true } = {}) {
  const sent = [];
  const input = { id: 'in', name: 'KATANA', manufacturer: 'BOSS', state: 'connected', onmidimessage: null };
  const amp = (bytes) => input.onmidimessage?.({ data: Uint8Array.from(bytes) });
  const output = {
    id: 'out',
    name: 'KATANA',
    manufacturer: 'BOSS',
    state: 'connected',
    send(data) {
      sent.push(hex(data));
      if (!answers) return;
      const msg = parseSysex(data);
      if (msg.kind === 'identity-request') amp(IDENTITY_REPLY);
      if (msg.kind === 'rq1') {
        const a = hex(msg.address);
        if (a === hex(ADDR.ACTIVE_CHANNEL)) amp(buildDT1(ADDR.ACTIVE_CHANNEL, [0, 0]));
        if (a === hex(ADDR.PATCH_NAME) || a === hex(ADDR.PANEL_NAME)) amp(buildDT1(msg.address, NAME));
      }
    },
  };
  const access = {
    sysexEnabled: true,
    inputs: new Map(katana ? [['in', input]] : []),
    outputs: new Map(katana ? [['out', output]] : []),
    onstatechange: null,
  };
  const transport = new WebMidiTransport({ requestMIDIAccess: async () => access });
  const logger = new Logger();
  const conn = new Connection({
    transport,
    logger,
    nav: { requestMIDIAccess() {} },
    createClient: (t) => new KatanaClient(t, { timeoutMs: 40, idleMs: 20, editModeDelayMs: 0 }),
    reconnectDelayMs: 10,
  });
  const unplug = (state) => {
    input.state = state;
    output.state = state;
    access.onstatechange?.({ port: output });
  };
  return { conn, sent, amp, logger, unplug, access };
}

describe('Connection', () => {
  it('reports a browser without Web MIDI', () => {
    const conn = new Connection({ transport: new WebMidiTransport(), nav: {} });
    expect(conn.state).toBe('unsupported');
  });

  it('connects, switches on edit mode and reads the basics', async () => {
    const { conn, sent } = setup();
    await conn.connect();
    expect(conn.state).toBe('connected');
    expect(conn.info.identity.isKatanaMk2).toBe(true);
    expect(conn.info.channel).toBe(0);
    expect(conn.info.patchName).toBe('muur zusamstra?e');
    expect(conn.info.editMode).toBe(true);
    expect(sent[0]).toBe('F0 7E 00 06 01 F7');
    expect(sent[1]).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 01 7F F7');
  });

  it('reports denied permission', async () => {
    const transport = new WebMidiTransport({
      requestMIDIAccess: async () => {
        throw Object.assign(new Error('Permission denied'), { name: 'SecurityError' });
      },
    });
    const conn = new Connection({ transport, nav: { requestMIDIAccess() {} } });
    await conn.connect();
    expect(conn.state).toBe('denied');
  });

  it('reports a missing Katana', async () => {
    const { conn } = setup({ katana: false });
    await conn.connect();
    expect(conn.state).toBe('no-device');
  });

  it('reports a port that does not answer', async () => {
    const { conn } = setup({ answers: false });
    await conn.connect();
    expect(conn.state).toBe('no-answer');
  });

  it('notices an unplugged amp and reconnects when it is back', async () => {
    const { conn, unplug } = setup();
    await conn.connect();
    unplug('disconnected');
    expect(conn.state).toBe('lost');
    unplug('connected');
    await wait(60);
    expect(conn.state).toBe('connected');
  });

  it('follows a channel change made on the amp', async () => {
    const { conn, amp, logger } = setup();
    await conn.connect();
    amp(buildDT1(ADDR.ACTIVE_CHANNEL, [0, 5]));
    expect(conn.info.channel).toBe(5);
    const last = logger.entries.at(-1);
    expect(last.tag).toBe('amp');
    expect(last.text).toContain('Aktiver Kanal = B1');
  });

  it('switches edit mode off when disconnecting', async () => {
    const { conn, sent } = setup();
    await conn.connect();
    await conn.disconnect();
    expect(conn.state).toBe('idle');
    expect(sent.at(-1)).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 00 00 F7');
  });

  it('switches edit mode off on page hide', async () => {
    const { conn, sent } = setup();
    await conn.connect();
    conn.pageHide();
    expect(sent.at(-1)).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 00 00 F7');
  });

  it('logs checksum errors', async () => {
    const { conn, amp, logger } = setup();
    await conn.connect();
    amp(parseHex('F0 41 00 00 00 00 33 12 60 00 06 51 21 00 F7'));
    expect(logger.entries.at(-1).level).toBe('err');
  });
});
