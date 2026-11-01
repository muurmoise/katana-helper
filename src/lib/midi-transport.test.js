import { describe, expect, it } from 'vitest';
import { WebMidiTransport, isWebMidiSupported, midiPermission, pickKatanaPort } from './midi-transport.js';

function port(id, name, type, state = 'connected') {
  return { id, name, type, manufacturer: 'BOSS', state, sent: [], send(d) { this.sent.push(d); } };
}

// Port names as Chrome showed them on our Mac (docs/protocol.md 10.1).
function fakeAccess({ sysex = true, katana = true } = {}) {
  const ins = [port('i-umc', 'UMC1820', 'input')];
  const outs = [port('o-umc', 'UMC1820', 'output')];
  if (katana) {
    ins.unshift(port('i-daw', 'KATANA KATANA DAW CTRL', 'input'));
    ins.push(port('i-kat', 'KATANA', 'input'));
    outs.unshift(port('o-daw', 'KATANA KATANA DAW CTRL', 'output'));
    outs.push(port('o-kat', 'KATANA', 'output'));
  }
  return {
    sysexEnabled: sysex,
    inputs: new Map(ins.map((p) => [p.id, p])),
    outputs: new Map(outs.map((p) => [p.id, p])),
    onstatechange: null,
  };
}

describe('pickKatanaPort', () => {
  it('prefers KATANA over KATANA DAW CTRL', () => {
    const access = fakeAccess();
    expect(pickKatanaPort([...access.inputs.values()]).id).toBe('i-kat');
  });

  it('falls back to the DAW port and skips disconnected ports', () => {
    expect(pickKatanaPort([port('a', 'KATANA DAW CTRL', 'input')]).id).toBe('a');
    expect(pickKatanaPort([port('a', 'KATANA', 'input', 'disconnected')])).toBeNull();
    expect(pickKatanaPort([port('a', 'UMC1820', 'input')])).toBeNull();
  });
});

describe('environment checks', () => {
  it('detects Web MIDI', () => {
    expect(isWebMidiSupported({ requestMIDIAccess() {} })).toBe(true);
    expect(isWebMidiSupported({})).toBe(false);
    expect(isWebMidiSupported(undefined)).toBe(false);
  });

  it('reads the MIDI permission or reports unknown', async () => {
    const nav = { permissions: { query: async () => ({ state: 'granted' }) } };
    expect(await midiPermission(nav)).toBe('granted');
    expect(await midiPermission({})).toBe('unknown');
  });
});

describe('WebMidiTransport', () => {
  it('asks for SysEx and selects the Katana ports', async () => {
    const access = fakeAccess();
    let options;
    const t = new WebMidiTransport({ requestMIDIAccess: async (o) => ((options = o), access) });
    await t.open();
    expect(options).toEqual({ sysex: true });
    const sel = t.autoSelect();
    expect(sel.input.name).toBe('KATANA');
    expect(sel.output.name).toBe('KATANA');
    expect(t.ready).toBe(true);

    t.send(Uint8Array.from([0xf0, 0x7e, 0x00, 0x06, 0x01, 0xf7]));
    expect(access.outputs.get('o-kat').sent).toEqual([[0xf0, 0x7e, 0x00, 0x06, 0x01, 0xf7]]);
  });

  it('fails when SysEx is not granted', async () => {
    const t = new WebMidiTransport({ requestMIDIAccess: async () => fakeAccess({ sysex: false }) });
    await expect(t.open()).rejects.toThrow('SysEx');
  });

  it('returns null when no Katana is connected', async () => {
    const t = new WebMidiTransport({ requestMIDIAccess: async () => fakeAccess({ katana: false }) });
    await t.open();
    expect(t.autoSelect()).toBeNull();
    expect(t.ready).toBe(false);
    expect(() => t.send([0xf0, 0xf7])).toThrow();
  });

  it('forwards messages but drops realtime bytes', async () => {
    const access = fakeAccess();
    const t = new WebMidiTransport({ requestMIDIAccess: async () => access });
    await t.open();
    t.autoSelect();
    const got = [];
    t.onMessage((b) => got.push(b));
    const input = access.inputs.get('i-kat');
    input.onmidimessage({ data: Uint8Array.from([0xfe]) });
    input.onmidimessage({ data: Uint8Array.from([0xf0, 0x7e, 0xf7]) });
    expect(got).toEqual([[0xf0, 0x7e, 0xf7]]);

    t.release();
    expect(input.onmidimessage).toBeNull();
    expect(t.ready).toBe(false);
  });

  it('reports port changes and notices a lost port', async () => {
    const access = fakeAccess();
    const t = new WebMidiTransport({ requestMIDIAccess: async () => access });
    await t.open();
    t.autoSelect();
    const events = [];
    t.onPortsChanged((e) => events.push(e.port.name));
    const out = access.outputs.get('o-kat');
    out.state = 'disconnected';
    access.onstatechange({ port: out });
    expect(events).toEqual(['KATANA']);
    expect(t.ready).toBe(false);
  });
});
