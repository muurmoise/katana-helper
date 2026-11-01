// Web MIDI access for the Katana (Chrome on macOS with the BOSS driver).
// The rest of the app only sees send(), onMessage() and port events, so it can be tested
// with a fake MIDIAccess.

const KATANA = /katana/i;
const DAW = /daw/i;

export function isWebMidiSupported(nav = globalThis.navigator) {
  return !!nav && typeof nav.requestMIDIAccess === 'function';
}

/** 'granted' | 'prompt' | 'denied' | 'unknown' */
export async function midiPermission(nav = globalThis.navigator) {
  try {
    const status = await nav.permissions.query({ name: 'midi', sysex: true });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * Pick the Katana port from a list. The driver offers "KATANA" and "KATANA DAW CTRL";
 * SysEx works on "KATANA" (tested 2026-11-01), so prefer the port without "DAW".
 */
export function pickKatanaPort(ports) {
  const live = ports.filter((p) => p.state !== 'disconnected');
  return (
    live.find((p) => KATANA.test(p.name) && !DAW.test(p.name)) ??
    live.find((p) => KATANA.test(p.name)) ??
    null
  );
}

export function portInfo(p) {
  return { id: p.id, name: p.name, manufacturer: p.manufacturer ?? '', state: p.state };
}

export class WebMidiTransport {
  constructor({ requestMIDIAccess } = {}) {
    this.requestMIDIAccess =
      requestMIDIAccess ?? ((options) => globalThis.navigator.requestMIDIAccess(options));
    this.access = null;
    this.input = null;
    this.output = null;
    this.messageListeners = new Set();
    this.portListeners = new Set();
  }

  async open() {
    if (this.access) return this.access;
    const access = await this.requestMIDIAccess({ sysex: true });
    if (!access.sysexEnabled) throw new Error('SysEx wurde nicht freigegeben');
    this.access = access;
    access.onstatechange = (e) => {
      const port = e.port ? portInfo(e.port) : null;
      for (const l of this.portListeners) l({ port, type: e.port?.type ?? null });
    };
    return access;
  }

  get inputs() {
    return this.access ? [...this.access.inputs.values()].map(portInfo) : [];
  }

  get outputs() {
    return this.access ? [...this.access.outputs.values()].map(portInfo) : [];
  }

  /** Select ports by id. Pass null to release. */
  select(inputId, outputId) {
    if (this.input) this.input.onmidimessage = null;
    this.input = inputId ? (this.access?.inputs.get(inputId) ?? null) : null;
    this.output = outputId ? (this.access?.outputs.get(outputId) ?? null) : null;
    if (this.input) {
      this.input.onmidimessage = (e) => {
        const bytes = Array.from(e.data);
        // Skip realtime bytes (clock, active sensing).
        if (bytes.length === 1 && bytes[0] >= 0xf8) return;
        for (const l of this.messageListeners) l(bytes);
      };
    }
    return { input: this.input ? portInfo(this.input) : null, output: this.output ? portInfo(this.output) : null };
  }

  /** Select the Katana ports automatically. Returns the chosen ports or null. */
  autoSelect() {
    const input = pickKatanaPort(this.access ? [...this.access.inputs.values()] : []);
    const output = pickKatanaPort(this.access ? [...this.access.outputs.values()] : []);
    if (!input || !output) {
      this.select(null, null);
      return null;
    }
    return this.select(input.id, output.id);
  }

  /** True while both selected ports exist and are connected. */
  get ready() {
    const ok = (p, map) => !!p && map?.has(p.id) && p.state === 'connected';
    return ok(this.input, this.access?.inputs) && ok(this.output, this.access?.outputs);
  }

  get selection() {
    return {
      input: this.input ? portInfo(this.input) : null,
      output: this.output ? portInfo(this.output) : null,
    };
  }

  send(bytes) {
    if (!this.output) throw new Error('Kein MIDI-Ausgang gewählt');
    this.output.send(Array.from(bytes));
  }

  onMessage(listener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onPortsChanged(listener) {
    this.portListeners.add(listener);
    return () => this.portListeners.delete(listener);
  }

  release() {
    this.select(null, null);
  }
}
