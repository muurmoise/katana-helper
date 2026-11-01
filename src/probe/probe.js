// Device probe: can this browser reach the Katana MkII over WebUSB or Web MIDI?
// Sends only read requests (RQ1), the identity request and edit mode on/off.

import {
  ADDR,
  ascii,
  buildEditMode,
  buildRQ1,
  fromBase128,
  hex,
  IDENTITY_REQUEST,
  parseSysex,
  PATCH_DUMP_SIZE,
  sameAddress,
} from '../lib/sysex.js';
import { packSysex, UsbMidiReceiver } from '../lib/usbmidi.js';

const ROLAND_VENDOR_ID = 0x0582;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- log

const logEl = $('log');
const logLines = [];

function timestamp() {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** kind: info | ok | err | warn | in | out | raw */
function log(kind, text) {
  const tag = { info: '  ', ok: 'OK', err: '!!', warn: '?!', in: '<-', out: '->', raw: '  ' }[kind] ?? '  ';
  const line = `${timestamp()} ${tag} ${text}`;
  logLines.push(line);
  const span = document.createElement('span');
  span.className = kind;
  span.textContent = line + '\n';
  logEl.append(span);
  logEl.scrollTop = logEl.scrollHeight;
}

function errorText(e) {
  return e && e.name ? `${e.name}: ${e.message}` : String(e);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

$('log-clear').onclick = () => {
  logLines.length = 0;
  logEl.textContent = '';
};

$('log-copy').onclick = async () => {
  const text = logLines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    log('ok', `Log kopiert (${logLines.length} Zeilen)`);
  } catch {
    // Fallback for browsers without clipboard permission
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    log(ok ? 'ok' : 'err', ok ? 'Log kopiert (Fallback)' : 'Kopieren fehlgeschlagen, bitte "Als Datei" nutzen');
  }
};

$('log-save').onclick = () => {
  const blob = new Blob([logLines.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `katana-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------------------------------------------------------------- environment

function showEnvironment() {
  const hasUsb = 'usb' in navigator;
  const hasMidi = typeof navigator.requestMIDIAccess === 'function';
  const uaData = navigator.userAgentData;
  const brands = uaData ? uaData.brands.map((b) => `${b.brand} ${b.version}`).join(', ') : '–';
  const rows = [
    ['User-Agent', navigator.userAgent, null],
    ['Browser', brands, null],
    ['Plattform', uaData ? `${uaData.platform}${uaData.mobile ? ' (mobil)' : ''}` : navigator.platform, null],
    ['Sicherer Kontext', window.isSecureContext ? 'ja' : 'nein', window.isSecureContext],
    ['navigator.usb', hasUsb ? 'vorhanden' : 'fehlt', hasUsb],
    ['navigator.requestMIDIAccess', hasMidi ? 'vorhanden' : 'fehlt', hasMidi],
    ['Seite', location.href, null],
  ];
  const dl = $('env');
  for (const [k, v, good] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    if (good !== null) dd.className = good ? 'yes' : 'no';
    dl.append(dt, dd);
    log('info', `${k}: ${v}`);
  }
  const noApi = 'Dieser Browser kann das nicht (Safari und Firefox fehlt es). Bitte die Seite in Google Chrome öffnen.';
  if (!hasUsb) {
    $('usb-choose').disabled = true;
    setStatus('usb-status', `WebUSB fehlt. ${noApi}`, true);
  }
  if (!hasMidi) {
    $('midi-open').disabled = true;
    setStatus('midi-status', `Web MIDI fehlt. ${noApi}`, true);
  }
}

function setStatus(id, text, bad = false) {
  const el = $(id);
  el.textContent = text;
  el.hidden = false;
  el.className = bad ? 'hint no' : 'hint';
}

// ---------------------------------------------------------------- incoming messages

const KNOWN = [
  { addr: ADDR.PANEL_NAME, name: 'Name 10 00 00 00 (Panel-Speicher?)', show: (d) => `"${ascii(d).trimEnd()}"` },
  { addr: ADDR.ACTIVE_CHANNEL, name: 'Aktiver Kanal', show: showChannel },
  { addr: ADDR.PATCH_NAME, name: 'Patch-Anfang (Name)', show: (d) => `"${ascii(d.slice(0, 16)).trimEnd()}"` },
  { addr: ADDR.AMP_TYPE_KNOB, name: 'AMP-TYPE-Schalter', show: (d) => ['Acoustic', 'Clean', 'Crunch', 'Lead', 'Brown'][d[0]] ?? d[0] },
  { addr: ADDR.GAIN, name: 'Gain', show: (d) => `${d[0]} (0–100)` },
  { addr: ADDR.EDIT_MODE, name: 'Edit-Mode', show: (d) => (d[0] ? 'an' : 'aus') },
];

function showChannel(d) {
  const v = d.length >= 2 ? d[1] : d[0];
  const names = ['Panel', 'A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
  return `${names[v] ?? '?'} (Wert ${hex(d)})`;
}

let waiters = [];

/** Resolves with the first parsed message matching `match`, or null after `ms`. */
function waitFor(match, ms) {
  return new Promise((resolve) => {
    const w = { match, resolve };
    waiters.push(w);
    setTimeout(() => {
      if (waiters.includes(w)) {
        waiters = waiters.filter((x) => x !== w);
        resolve(null);
      }
    }, ms);
  });
}

let collector = null; // collects DT1 replies while reading a patch dump

function handleIncoming(source, bytes, incomplete = false) {
  const msg = parseSysex(bytes);
  if (incomplete) log('warn', `${source} unvollständige SysEx (${bytes.length} B): ${hex(bytes)}`);

  if (msg.kind === 'identity-reply') {
    log('in', `${source} Identity Reply: ${hex(bytes)}`);
    log('ok', `  Hersteller ${hex([msg.manufacturer])}, Familie ${hex(msg.family)}, Modell ${hex(msg.member)}, Version ${hex(msg.version)}`);
  } else if (msg.kind === 'dt1') {
    const known = KNOWN.find((k) => sameAddress(k.addr, msg.address));
    const label = known ? `${known.name} = ${known.show(msg.data)}` : `${msg.data.length} Datenbytes`;
    log('in', `${source} DT1 ${hex(msg.address)}: ${label}`);
    log('in', `  ${hex(bytes)}`);
    log(msg.checksumOk ? 'ok' : 'err', msg.checksumOk
      ? `  Checksumme ${hex([msg.checksum])} korrekt`
      : `  Checksumme FALSCH: erhalten ${hex([msg.checksum])}, erwartet ${hex([msg.expectedChecksum])}`);
    if (collector) collector.push(msg);
  } else {
    log('in', `${source} ${msg.kind}${msg.reason ? ` (${msg.reason})` : ''}: ${hex(bytes)}`);
  }

  for (const w of [...waiters]) {
    if (w.match(msg)) {
      waiters = waiters.filter((x) => x !== w);
      w.resolve(msg);
    }
  }
}

// ---------------------------------------------------------------- shared test sequence

const isReplyTo = (address) => (m) => m.kind === 'dt1' && sameAddress(m.address, address);

async function request(send, name, address, size) {
  log('out', `RQ1 ${name}: ${hex(buildRQ1(address, size))}`);
  await send(buildRQ1(address, size));
  const reply = await waitFor(isReplyTo(address), 1500);
  if (!reply) log('err', `  keine Antwort auf "${name}" nach 1500 ms`);
  return !!reply;
}

async function runSequence(send, label) {
  log('info', `===== Test-Sequenz über ${label} =====`);
  const results = [];

  log('out', `Identity Request: ${hex(IDENTITY_REQUEST)}`);
  await send(Uint8Array.from(IDENTITY_REQUEST));
  const id = await waitFor((m) => m.kind === 'identity-reply', 1500);
  if (!id) log('err', '  keine Identity Reply nach 1500 ms');
  results.push(['Identity', !!id]);

  log('out', `Edit-Mode an: ${hex(buildEditMode(true))}`);
  await send(buildEditMode(true));
  await sleep(150);

  results.push(['Name 10 00 00 00', await request(send, 'Name 10 00 00 00', ADDR.PANEL_NAME, 16)]);
  results.push(['Aktiver Kanal', await request(send, 'Aktiver Kanal', ADDR.ACTIVE_CHANNEL, 2)]);
  results.push(['Patch-Name', await request(send, 'Patch-Name', ADDR.PATCH_NAME, 16)]);
  results.push(['Gain', await request(send, 'Gain', ADDR.GAIN, 1)]);

  const summary = results.map(([n, ok]) => `${n} ${ok ? 'ja' : 'NEIN'}`).join(', ');
  const allOk = results.every(([, ok]) => ok);
  log(allOk ? 'ok' : 'warn', `Ergebnis ${label}: ${summary}`);
  log('info', 'Tipp: Jetzt am Amp einen Regler drehen. Mit Edit-Mode sollten DT1-Meldungen kommen.');
}

async function readPatch(send, label) {
  log('info', `===== Patch auslesen über ${label} (Backup) =====`);
  log('out', `Edit-Mode an: ${hex(buildEditMode(true))}`);
  await send(buildEditMode(true));
  await sleep(150);
  collector = [];
  const rq = buildRQ1(ADDR.PATCH, PATCH_DUMP_SIZE);
  log('out', `RQ1 Patch 60 00 00 00, 1920 B: ${hex(rq)}`);
  await send(rq);
  // Replies come as several DT1 messages; wait until 1 s passes without a new one.
  let count = -1;
  for (let i = 0; i < 10 && collector.length !== count; i++) {
    count = collector.length;
    await sleep(1000);
  }
  const parts = collector.filter((m) => m.address[0] === 0x60);
  collector = null;
  const bytes = parts.reduce((n, m) => n + m.data.length, 0);
  const bad = parts.filter((m) => !m.checksumOk).length;
  if (parts.length === 0) {
    log('err', 'Backup: keine Antwort');
    return;
  }
  log(bad ? 'warn' : 'ok', `Backup: ${parts.length} Nachrichten, ${bytes} Datenbytes, ${bad} mit falscher Checksumme`);
  for (const m of parts) {
    log('info', `  BACKUP ${hex(m.address)} (+${fromBase128(m.address) - fromBase128(ADDR.PATCH)}): ${hex(m.data)}`);
  }
}

// ---------------------------------------------------------------- WebUSB

const usb = { device: null, choice: null, receiving: false, receiver: null };

const DIRECTION = { in: 'IN', out: 'OUT' };

function logDescriptors(device) {
  log('info', `Gerät: ${device.manufacturerName ?? '?'} / ${device.productName ?? '?'}`);
  log('info', `  VID ${hex16(device.vendorId)}, PID ${hex16(device.productId)}, USB ${device.usbVersionMajor}.${device.usbVersionMinor}${device.usbVersionSubminor}, Geräteversion ${device.deviceVersionMajor}.${device.deviceVersionMinor}.${device.deviceVersionSubminor}`);
  log('info', `  Geräteklasse ${hex8(device.deviceClass)}/${hex8(device.deviceSubclass)}/${hex8(device.deviceProtocol)}, Seriennummer ${device.serialNumber ?? '–'}`);
  log('info', `  Aktive Konfiguration: ${device.configuration ? device.configuration.configurationValue : 'keine'}`);
  for (const cfg of device.configurations) {
    log('info', `  Konfiguration ${cfg.configurationValue} "${cfg.configurationName ?? ''}", ${cfg.interfaces.length} Interfaces`);
    for (const intf of cfg.interfaces) {
      log('info', `    Interface ${intf.interfaceNumber}${intf.claimed ? ' (belegt)' : ''}, ${intf.alternates.length} Alternate Settings`);
      for (const alt of intf.alternates) {
        log('info', `      Alt ${alt.alternateSetting}: Klasse ${hex8(alt.interfaceClass)}/${hex8(alt.interfaceSubclass)}/${hex8(alt.interfaceProtocol)} ${className(alt.interfaceClass)} "${alt.interfaceName ?? ''}"`);
        for (const ep of alt.endpoints) {
          const addr = ep.endpointNumber | (ep.direction === 'in' ? 0x80 : 0);
          log('info', `        Endpoint ${ep.endpointNumber} (${hex8(addr)}) ${DIRECTION[ep.direction]} ${ep.type}, ${ep.packetSize} B`);
        }
      }
    }
  }
}

const hex8 = (n) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
const hex16 = (n) => '0x' + n.toString(16).toUpperCase().padStart(4, '0');

function className(c) {
  return { 0x01: '(Audio)', 0x02: '(CDC)', 0x03: '(HID)', 0xff: '(herstellerspezifisch)' }[c] ?? '';
}

/** Pick the vendor-specific interface with an IN and an OUT bulk/interrupt endpoint. */
function findInterface(device) {
  const candidates = [];
  for (const cfg of device.configurations) {
    for (const intf of cfg.interfaces) {
      for (const alt of intf.alternates) {
        if (alt.interfaceClass !== 0xff) continue;
        const usable = (dir) =>
          alt.endpoints.filter((e) => e.direction === dir && (e.type === 'bulk' || e.type === 'interrupt'));
        const ins = usable('in');
        const outs = usable('out');
        if (!ins.length || !outs.length) continue;
        const pick = (list) => list.find((e) => e.type === 'bulk') ?? list[0];
        const inEp = pick(ins);
        const outEp = pick(outs);
        // Prefer bulk endpoints and alternate setting 0 (ktnacontrol: interface 3, alt 0, OUT 0x03, IN 0x84).
        const score = (inEp.type === 'bulk' ? 2 : 0) + (outEp.type === 'bulk' ? 2 : 0) + (alt.alternateSetting === 0 ? 1 : 0);
        candidates.push({ cfg, intf, alt, inEp, outEp, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    log('info', `  Kandidat: Konfiguration ${c.cfg.configurationValue}, Interface ${c.intf.interfaceNumber}, Alt ${c.alt.alternateSetting}, IN ${c.inEp.endpointNumber} ${c.inEp.type}, OUT ${c.outEp.endpointNumber} ${c.outEp.type}`);
  }
  return candidates[0] ?? null;
}

async function step(name, fn) {
  try {
    const result = await fn();
    log('ok', `${name}: erfolgreich`);
    return { ok: true, result };
  } catch (e) {
    log('err', `${name}: ${errorText(e)}`);
    return { ok: false };
  }
}

function setUsbButtons({ chosen = !!usb.device, connected = usb.receiving } = {}) {
  $('usb-connect').disabled = !chosen || connected;
  $('usb-sequence').disabled = !connected;
  $('usb-backup').disabled = !connected;
  $('usb-release').disabled = !chosen;
}

async function useDevice(device) {
  usb.device = device;
  logDescriptors(device);
  usb.choice = findInterface(device);
  if (!usb.choice) {
    log('err', 'Kein herstellerspezifisches Interface mit IN- und OUT-Endpoint gefunden');
  } else {
    const c = usb.choice;
    log('ok', `Gewählt: Interface ${c.intf.interfaceNumber}, Alt ${c.alt.alternateSetting}, IN-Endpoint ${c.inEp.endpointNumber}, OUT-Endpoint ${c.outEp.endpointNumber}`);
  }
  setUsbButtons({ chosen: !!usb.choice, connected: false });
}

$('usb-choose').onclick = async () => {
  log('info', '===== WebUSB: Gerät wählen =====');
  try {
    const device = await navigator.usb.requestDevice({ filters: [{ vendorId: ROLAND_VENDOR_ID }] });
    await useDevice(device);
  } catch (e) {
    log('err', `requestDevice: ${errorText(e)}`);
  }
};

$('usb-connect').onclick = async () => {
  const { device, choice } = usb;
  if (!device || !choice) return;
  log('info', '===== WebUSB: Verbinden =====');
  if (!(await step('open()', () => device.open())).ok) return;

  const wanted = choice.cfg.configurationValue;
  if (!device.configuration || device.configuration.configurationValue !== wanted) {
    if (!(await step(`selectConfiguration(${wanted})`, () => device.selectConfiguration(wanted))).ok) return;
  } else {
    log('info', `Konfiguration ${wanted} ist schon aktiv`);
  }

  const n = choice.intf.interfaceNumber;
  if (!(await step(`claimInterface(${n})`, () => device.claimInterface(n))).ok) return;

  const intf = device.configuration.interfaces.find((i) => i.interfaceNumber === n);
  const current = intf?.alternate?.alternateSetting;
  const alt = choice.alt.alternateSetting;
  if (current !== alt) {
    if (!(await step(`selectAlternateInterface(${n}, ${alt})`, () => device.selectAlternateInterface(n, alt))).ok) return;
  } else {
    log('info', `Alternate Setting ${alt} ist schon aktiv`);
  }

  startReceiving();
  setUsbButtons({ chosen: true, connected: true });
  log('ok', 'Bereit. Jetzt "Test-Sequenz senden".');
};

async function startReceiving() {
  const { device, choice } = usb;
  usb.receiving = true;
  usb.receiver = new UsbMidiReceiver();
  const ep = choice.inEp;
  const size = Math.max(ep.packetSize, 64);
  log('info', `Empfangsschleife gestartet (transferIn Endpoint ${ep.endpointNumber}, ${size} B)`);
  while (usb.receiving) {
    try {
      const r = await device.transferIn(ep.endpointNumber, size);
      if (r.status === 'stall') {
        log('warn', 'transferIn: stall, clearHalt()');
        await device.clearHalt('in', ep.endpointNumber);
        continue;
      }
      if (r.status === 'babble') log('warn', 'transferIn: babble (mehr Daten als erwartet)');
      if (!r.data || r.data.byteLength === 0) continue;
      const raw = new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      if ($('usb-raw').checked) log('raw', `USB <- ${raw.length} B: ${hex(raw)}`);
      for (const m of usb.receiver.push(raw)) {
        if (m.sysex) handleIncoming('USB', m.bytes, m.incomplete);
        else log('in', `USB MIDI: ${hex(m.bytes)}`);
      }
    } catch (e) {
      if (usb.receiving) log('err', `transferIn: ${errorText(e)}`);
      break;
    }
  }
  usb.receiving = false;
  log('info', 'Empfangsschleife beendet');
  setUsbButtons();
}

async function usbSend(message) {
  const packed = packSysex(message);
  if ($('usb-raw').checked) log('raw', `USB -> ${packed.length} B: ${hex(packed)}`);
  const r = await usb.device.transferOut(usb.choice.outEp.endpointNumber, packed);
  if (r.status !== 'ok' || r.bytesWritten !== packed.length) {
    log('warn', `transferOut: Status ${r.status}, ${r.bytesWritten} von ${packed.length} B geschrieben`);
  }
}

async function guarded(name, fn) {
  try {
    await fn();
  } catch (e) {
    log('err', `${name}: ${errorText(e)}`);
  }
}

$('usb-sequence').onclick = () => guarded('USB-Test-Sequenz', () => runSequence(usbSend, 'WebUSB'));
$('usb-backup').onclick = () => guarded('USB-Backup', () => readPatch(usbSend, 'WebUSB'));

$('usb-release').onclick = async () => {
  const { device, choice } = usb;
  if (!device) return;
  log('info', '===== WebUSB: Edit-Mode aus und freigeben =====');
  if (device.opened && usb.receiving) {
    await step('Edit-Mode aus senden', () => usbSend(buildEditMode(false)));
    await sleep(100);
  }
  usb.receiving = false;
  if (device.opened && choice) {
    await step(`releaseInterface(${choice.intf.interfaceNumber})`, () => device.releaseInterface(choice.intf.interfaceNumber));
  }
  if (device.opened) await step('close()', () => device.close());
  setUsbButtons({ chosen: true, connected: false });
};

if ('usb' in navigator) {
  navigator.usb.addEventListener('disconnect', (e) => {
    log('warn', `USB-Gerät getrennt: ${e.device.productName ?? hex16(e.device.productId)}`);
    if (e.device === usb.device) {
      usb.receiving = false;
      usb.device = null;
      setUsbButtons({ chosen: false, connected: false });
    }
  });
  navigator.usb.addEventListener('connect', (e) => {
    log('info', `USB-Gerät angeschlossen: ${e.device.productName ?? hex16(e.device.productId)}`);
  });
}

// ---------------------------------------------------------------- Web MIDI

const midi = { access: null, input: null, output: null };

function portLabel(p) {
  return `${p.name} (${p.manufacturer || 'ohne Hersteller'}, ${p.state}/${p.connection})`;
}

function fillSelect(select, ports) {
  select.textContent = '';
  for (const p of ports) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.append(opt);
  }
  // Prefer the main port over "KATANA DAW CTRL", which carries no SysEx.
  const katana =
    ports.find((p) => /katana/i.test(p.name) && !/daw/i.test(p.name)) ??
    ports.find((p) => /katana/i.test(p.name));
  if (katana) select.value = katana.id;
  select.disabled = ports.length === 0;
}

function bindPorts() {
  const { access } = midi;
  if (midi.input) midi.input.onmidimessage = null;
  midi.input = access.inputs.get($('midi-in').value) ?? null;
  midi.output = access.outputs.get($('midi-out').value) ?? null;
  if (midi.input) {
    midi.input.onmidimessage = (e) => {
      const data = Array.from(e.data);
      if (data[0] === 0xf0) handleIncoming('MIDI', data);
      else if (data[0] < 0xf8) log('in', `MIDI: ${hex(data)}`); // skip clock/active sensing
    };
  }
  const ready = !!(midi.input && midi.output);
  $('midi-sequence').disabled = !ready;
  $('midi-backup').disabled = !ready;
  $('midi-editoff').disabled = !midi.output;
  log('info', `Web MIDI: Eingang ${midi.input ? `"${midi.input.name}"` : '–'}, Ausgang ${midi.output ? `"${midi.output.name}"` : '–'}`);
}

function listPorts() {
  const ins = [...midi.access.inputs.values()];
  const outs = [...midi.access.outputs.values()];
  log('info', `Eingänge: ${ins.length}`);
  for (const p of ins) log('info', `  IN  ${portLabel(p)}`);
  log('info', `Ausgänge: ${outs.length}`);
  for (const p of outs) log('info', `  OUT ${portLabel(p)}`);
  const found = [...ins, ...outs].some((p) => /katana/i.test(p.name));
  log(found ? 'ok' : 'warn', found ? 'Katana-Port gefunden' : 'Kein Port mit "KATANA" im Namen gefunden');
  if (ins.length === 0 && outs.length === 0) {
    setStatus('midi-status', 'Keine MIDI-Ports gefunden. Treiber installiert? Amp an und per USB verbunden?', true);
  } else if (!found) {
    setStatus('midi-status', 'Kein Katana-Port dabei. Bitte Eingang und Ausgang von Hand wählen.', true);
  } else {
    setStatus('midi-status', 'Katana gefunden. Weiter mit „2. Test-Sequenz senden“.');
  }
  fillSelect($('midi-in'), ins);
  fillSelect($('midi-out'), outs);
  bindPorts();
}

$('midi-open').onclick = async () => {
  log('info', '===== Web MIDI öffnen (sysex: true) =====');
  try {
    midi.access = await navigator.requestMIDIAccess({ sysex: true });
    log('ok', `requestMIDIAccess: erfolgreich, sysexEnabled = ${midi.access.sysexEnabled}`);
    midi.access.onstatechange = (e) => {
      log('info', `MIDI-Port geändert: ${e.port.type} ${portLabel(e.port)}`);
      listPorts();
    };
    listPorts();
  } catch (e) {
    log('err', `requestMIDIAccess: ${errorText(e)}`);
    setStatus(
      'midi-status',
      'Zugriff verweigert. In Chrome links in der Adressleiste auf das Symbol tippen und „MIDI-Geräte steuern“ erlauben, dann Seite neu laden.',
      true,
    );
  }
};

$('midi-in').onchange = bindPorts;
$('midi-out').onchange = bindPorts;

async function midiSend(message) {
  midi.output.send(Array.from(message));
}

$('midi-sequence').onclick = () => guarded('MIDI-Test-Sequenz', () => runSequence(midiSend, 'Web MIDI'));
$('midi-backup').onclick = () => guarded('MIDI-Backup', () => readPatch(midiSend, 'Web MIDI'));
$('midi-editoff').onclick = () =>
  guarded('Edit-Mode aus', async () => {
    log('out', `Edit-Mode aus: ${hex(buildEditMode(false))}`);
    await midiSend(buildEditMode(false));
  });

// ---------------------------------------------------------------- start

showEnvironment();
if ('usb' in navigator) {
  navigator.usb.getDevices().then(
    (list) => {
      if (!list.length) return;
      log('info', `Bereits freigegebene USB-Geräte: ${list.map((d) => d.productName ?? hex16(d.productId)).join(', ')}`);
      const roland = list.find((d) => d.vendorId === ROLAND_VENDOR_ID);
      if (roland) useDevice(roland);
    },
    (e) => log('warn', `getDevices: ${errorText(e)}`),
  );
}
