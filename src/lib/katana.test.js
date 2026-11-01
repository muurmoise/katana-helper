import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KatanaClient, TimeoutError, isKatanaMk2 } from './katana.js';
import { ADDR, PATCH_DUMP_SIZE, buildDT1, hex, parseHex, toBase128 } from './sysex.js';

// Identity reply recorded on our own amp (docs/protocol.md 10.1).
const IDENTITY_REPLY = parseHex('F0 7E 00 06 02 41 33 03 00 00 06 00 00 00 F7');

/** Transport double: records what is sent, lets the test play the amp. */
function fakeTransport() {
  const listeners = new Set();
  return {
    sent: [],
    send(bytes) {
      this.sent.push(hex(bytes));
    },
    onMessage(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    receive(bytes) {
      for (const l of listeners) l(Array.from(bytes));
    },
  };
}

const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('KatanaClient', () => {
  let t;
  let client;

  beforeEach(() => {
    vi.useFakeTimers();
    t = fakeTransport();
    client = new KatanaClient(t, { timeoutMs: 1000, idleMs: 200, editModeDelayMs: 0 });
  });

  afterEach(() => {
    client.dispose();
    vi.useRealTimers();
  });

  it('identifies a Katana MkII', async () => {
    const p = client.identify();
    await flush();
    expect(t.sent).toEqual(['F0 7E 00 06 01 F7']);
    t.receive(IDENTITY_REPLY);
    const id = await p;
    expect(id.isKatanaMk2).toBe(true);
    expect(hex(id.version)).toBe('06 00 00 00');
  });

  it('rejects other devices as Katana', () => {
    expect(isKatanaMk2({ manufacturer: 0x41, family: [0x10, 0x01] })).toBe(false);
    expect(isKatanaMk2({ manufacturer: 0x43, family: [0x33, 0x03] })).toBe(false);
  });

  it('times out without identity reply', async () => {
    const p = client.identify();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });

  it('switches edit mode and remembers the state', async () => {
    await client.setEditMode(true);
    expect(client.editMode).toBe(true);
    expect(t.sent.at(-1)).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 01 7F F7');
    client.editModeOffNow();
    expect(client.editMode).toBe(false);
    expect(t.sent.at(-1)).toBe('F0 41 00 00 00 00 33 12 7F 00 00 01 00 00 F7');
    client.editModeOffNow();
    expect(t.sent).toHaveLength(2);
  });

  it('reads a single value', async () => {
    const p = client.read(ADDR.GAIN, 1);
    await flush();
    expect(t.sent).toEqual(['F0 41 00 00 00 00 33 11 60 00 06 51 00 00 00 01 48 F7']);
    t.receive(buildDT1(ADDR.GAIN, [0x21]));
    const r = await p;
    expect(r.complete).toBe(true);
    expect(r.byteAt(ADDR.GAIN)).toBe(0x21);
  });

  it('reads names and the active channel', async () => {
    const name = client.readName(ADDR.PATCH_NAME, 'Name');
    await flush();
    t.receive(parseHex('F0 41 00 00 00 00 33 12 60 00 00 00 6D 75 75 72 20 7A 75 73 61 6D 73 74 72 61 3F 65 29 F7'));
    expect(await name).toBe('muur zusamstra?e');

    const ch = client.readChannel();
    await flush();
    t.receive(parseHex('F0 41 00 00 00 00 33 12 00 01 00 00 00 00 7F F7'));
    expect(await ch).toBe(0);
  });

  it('collects a patch dump with a gap like the real amp', async () => {
    // The amp answered with 60 00 00 00–07 43 and 60 00 08 00–0F 47 (docs/protocol.md 2.3).
    const p = client.read(ADDR.PATCH, PATCH_DUMP_SIZE, 'Patch');
    await flush();
    const send = (offset, length) =>
      t.receive(buildDT1([0x60, ...toBase128(offset, 3)], new Array(length).fill(offset % 128)));
    send(0, 241);
    send(241, 241);
    send(482, 241);
    send(723, 241);
    send(1024, 241);
    send(1265, 241);
    send(1506, 241);
    send(1747, 241);
    send(1988, 4);
    const r = await p;
    expect(r.complete).toBe(true);
    expect(r.received).toBe(1932);
    expect(r.chunks).toHaveLength(9);
    expect(r.byteAt([0x60, 0x00, 0x08, 0x00])).toBe(1024 % 128);
    expect(r.byteAt([0x60, 0x00, 0x07, 0x50])).toBeUndefined();
  });

  it('ends a partial read after the idle time', async () => {
    const p = client.read(ADDR.PATCH, 100, 'Teil');
    await flush();
    t.receive(buildDT1(ADDR.PATCH, new Array(40).fill(1)));
    await vi.advanceTimersByTimeAsync(200);
    const r = await p;
    expect(r.complete).toBe(false);
    expect(r.received).toBe(40);
  });

  it('ignores replies with a wrong checksum', async () => {
    const p = client.read(ADDR.GAIN, 1);
    await flush();
    t.receive(parseHex('F0 41 00 00 00 00 33 12 60 00 06 51 21 00 F7'));
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });

  it('runs requests one after another', async () => {
    const a = client.read(ADDR.GAIN, 1, 'A');
    const b = client.read(ADDR.ACTIVE_CHANNEL, 2, 'B');
    await flush();
    expect(t.sent).toHaveLength(1);
    t.receive(buildDT1(ADDR.GAIN, [1]));
    await a;
    await flush();
    expect(t.sent).toHaveLength(2);
    t.receive(buildDT1(ADDR.ACTIVE_CHANNEL, [0, 3]));
    expect((await b).chunks[0].data).toEqual([0, 3]);
  });

  it('keeps the queue going after a timeout', async () => {
    const a = client.read(ADDR.GAIN, 1, 'A');
    const b = client.read(ADDR.GAIN, 1, 'B');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(a).rejects.toBeInstanceOf(TimeoutError);
    await flush();
    t.receive(buildDT1(ADDR.GAIN, [5]));
    expect((await b).byteAt(ADDR.GAIN)).toBe(5);
  });

  it('marks messages the amp sends on its own', () => {
    const seen = [];
    client.on('dt1', (m) => seen.push([hex(m.address), m.solicited]));
    t.receive(parseHex('F0 41 00 00 00 00 33 12 60 00 06 51 23 26 F7'));
    expect(seen).toEqual([['60 00 06 51', false]]);
  });

  it('reports outgoing messages', async () => {
    const sent = [];
    client.on('send', (s) => sent.push(s.label));
    await client.setEditMode(true);
    expect(sent).toEqual(['Edit-Mode an']);
  });
});
