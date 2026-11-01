// Connection flow for the editor: open Web MIDI, find the Katana, identify it, switch on
// edit mode, read the basics. Also follows the amp when it is unplugged or comes back.
// No DOM here; the UI listens to onChange() and reads `state` and `info`.

import { KatanaClient } from './katana.js';
import { ADDR, hex } from './sysex.js';
import { isWebMidiSupported, pickKatanaPort } from './midi-transport.js';
import { asciiName, channelFromData, describe } from './describe.js';

/**
 * States:
 * unsupported – browser has no Web MIDI
 * idle        – not connected yet / disconnected by the user
 * connecting  – connection in progress
 * connected   – Katana answered, edit mode on
 * denied      – MIDI/SysEx permission refused
 * no-device   – no Katana port found
 * no-answer   – port found, but no identity reply
 * lost        – was connected, port disappeared
 * error       – anything else
 */
export const STATES = ['unsupported', 'idle', 'connecting', 'connected', 'denied', 'no-device', 'no-answer', 'lost', 'error'];

const emptyInfo = () => ({
  input: null,
  output: null,
  identity: null,
  panelName: null,
  patchName: null,
  channel: null,
  editMode: false,
  error: null,
});

export class Connection {
  constructor({ transport, logger, nav = globalThis.navigator, createClient, reconnectDelayMs = 500 }) {
    this.transport = transport;
    this.logger = logger;
    this.createClient = createClient ?? ((t) => new KatanaClient(t));
    this.reconnectDelayMs = reconnectDelayMs;
    this.client = null;
    this.state = isWebMidiSupported(nav) ? 'idle' : 'unsupported';
    this.info = emptyInfo();
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.portsHooked = false;
    this.offs = [];
    this.portStates = new Map();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(state, patch = {}) {
    this.state = state;
    Object.assign(this.info, patch);
    for (const l of this.listeners) l(this);
  }

  log(level, text, options) {
    this.logger?.add(level, text, options);
  }

  get ports() {
    return { inputs: this.transport.inputs, outputs: this.transport.outputs };
  }

  /** Connect. With inputId/outputId the user picked the ports by hand. */
  async connect({ inputId = null, outputId = null } = {}) {
    if (this.state === 'unsupported' || this.state === 'connecting') return;
    clearTimeout(this.reconnectTimer);
    this.set('connecting', { error: null });
    this.log('info', '===== Verbinden =====');

    try {
      await this.transport.open();
      this.log('ok', 'Web MIDI geöffnet, SysEx erlaubt');
    } catch (e) {
      const denied = e?.name === 'SecurityError' || e?.name === 'NotAllowedError';
      this.log('err', `Web MIDI: ${e?.name ?? 'Fehler'}: ${e?.message ?? e}`);
      this.set(denied ? 'denied' : 'error', { error: e?.message ?? String(e) });
      return;
    }
    this.hookPorts();
    this.logPorts();

    const sel = inputId && outputId ? this.transport.select(inputId, outputId) : this.transport.autoSelect();
    if (!sel?.input || !sel?.output) {
      this.log('warn', 'Kein Katana-Port gefunden');
      this.set('no-device', { input: null, output: null });
      return;
    }
    this.log('info', `Eingang "${sel.input.name}", Ausgang "${sel.output.name}"`);
    this.info.input = sel.input;
    this.info.output = sel.output;

    this.attachClient();
    try {
      const identity = await this.client.identify();
      this.info.identity = identity;
      if (identity.isKatanaMk2) this.log('ok', `Katana MkII erkannt, Version ${hex(identity.version)}`);
      else this.log('warn', `Unbekanntes Gerät: Hersteller ${hex([identity.manufacturer])}, Familie ${hex(identity.family)}`);

      await this.client.setEditMode(true);
      await this.readBasics();
      this.set('connected', { editMode: true });
      this.log('ok', 'Verbunden');
    } catch (e) {
      this.log('err', e.message);
      this.detachClient();
      this.set('no-answer', { error: e.message });
    }
  }

  async readBasics() {
    this.info.channel = await this.client.readChannel();
    this.info.patchName = await this.client.readName(ADDR.PATCH_NAME, 'RQ1 Patch-Name');
    this.info.panelName = await this.client.readName(ADDR.PANEL_NAME, 'RQ1 Name Panel-Speicher');
  }

  /** Re-read channel and names. */
  async refresh() {
    if (this.state !== 'connected') return;
    try {
      await this.readBasics();
      this.set('connected');
    } catch (e) {
      this.log('err', e.message);
    }
  }

  async disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.client && this.transport.ready) {
      try {
        await this.client.setEditMode(false);
      } catch (e) {
        this.log('warn', `Edit-Mode aus: ${e.message}`);
      }
    }
    this.detachClient();
    this.transport.release();
    this.log('info', 'Getrennt');
    this.set('idle', { ...emptyInfo() });
  }

  /** Call on pagehide: switch edit mode off right away. */
  pageHide() {
    this.client?.editModeOffNow();
  }

  attachClient() {
    this.detachClient();
    const client = this.createClient(this.transport);
    this.client = client;
    this.offs = [
      client.on('send', ({ bytes, label }) => this.log('out', label, { raw: hex(bytes) })),
      client.on('message', ({ msg, solicited }) => this.logIncoming(msg, solicited)),
      client.on('dt1', (msg) => this.track(msg)),
    ];
  }

  detachClient() {
    for (const off of this.offs ?? []) off();
    this.offs = [];
    this.client?.dispose();
    this.client = null;
  }

  logIncoming(msg, solicited) {
    const raw = hex(msg.bytes);
    const tag = solicited ? null : 'amp';
    if (msg.kind === 'dt1') {
      if (!msg.checksumOk) {
        this.log('err', `DT1 ${hex(msg.address)}: Checksumme falsch (erhalten ${hex([msg.checksum])}, erwartet ${hex([msg.expectedChecksum])})`, { raw, tag });
        return;
      }
      this.log('in', `${solicited ? '' : 'Amp: '}${describe(msg.address, msg.data)}  [${hex(msg.address)}]`, { raw, tag });
    } else if (msg.kind === 'identity-reply') {
      this.log('in', 'Identity Reply', { raw });
    } else {
      this.log('in', `${msg.kind}${msg.reason ? ` (${msg.reason})` : ''}`, { raw, tag });
    }
  }

  /** Keep `info` up to date with what the amp reports on its own. */
  track(msg) {
    if (msg.solicited || this.state !== 'connected') return;
    const at = (a) => hex(msg.address) === hex(a);
    if (at(ADDR.ACTIVE_CHANNEL)) {
      this.set('connected', { channel: channelFromData(msg.data) });
      // A channel change loads another patch; read its name once the amp has settled.
      setTimeout(() => this.refresh(), 300);
    } else if (at(ADDR.PATCH_NAME) && msg.data.length >= 16) {
      this.set('connected', { patchName: asciiName(msg.data.slice(0, 16)) });
    }
  }

  logPorts() {
    const { inputs, outputs } = this.ports;
    this.log('info', `Eingänge: ${inputs.map((p) => p.name).join(', ') || '–'}`);
    this.log('info', `Ausgänge: ${outputs.map((p) => p.name).join(', ') || '–'}`);
  }

  hookPorts() {
    if (this.portsHooked) return;
    this.portsHooked = true;
    for (const p of [...this.transport.inputs, ...this.transport.outputs]) this.portStates.set(p.id, p.state);
    this.transport.onPortsChanged(({ port }) => this.portsChanged(port));
  }

  portsChanged(port) {
    // Opening a port also fires statechange; only log real plug/unplug changes.
    if (port && this.portStates.get(port.id) !== port.state) {
      if (this.portStates.has(port.id)) this.log('info', `MIDI-Port ${port.name}: ${port.state}`);
      this.portStates.set(port.id, port.state);
    }
    if (this.state === 'connected' && !this.transport.ready) {
      this.detachClient();
      this.transport.release();
      this.log('warn', 'Verbindung zum Katana verloren');
      this.set('lost', { editMode: false });
      return;
    }
    // Reconnect when the Katana shows up again. Ports arrive one by one, so wait a moment.
    if (this.state === 'lost' || this.state === 'no-device') {
      const { inputs, outputs } = this.ports;
      if (pickKatanaPort(inputs) && pickKatanaPort(outputs)) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
      }
    } else {
      for (const l of this.listeners) l(this); // port lists changed
    }
  }
}
