// Editor UI, phase 1: connection, device info, debug log.

import { Connection } from './lib/connection.js';
import { CHANNEL_NAMES } from './lib/describe.js';
import { Logger, timestamp } from './lib/log.js';
import { WebMidiTransport, midiPermission } from './lib/midi-transport.js';
import { hex } from './lib/sysex.js';

const $ = (id) => document.getElementById(id);

const logger = new Logger();
const connection = new Connection({ transport: new WebMidiTransport(), logger });

// ------------------------------------------------------------------ status + device info

const STATUS = {
  unsupported: 'Kein Web MIDI',
  idle: 'Nicht verbunden',
  connecting: 'Verbinde …',
  connected: 'Verbunden',
  denied: 'Zugriff verweigert',
  'no-device': 'Katana nicht gefunden',
  'no-answer': 'Keine Antwort',
  lost: 'Verbindung verloren',
  error: 'Fehler',
};

const HINTS = {
  unsupported: [
    'Dieser Browser kann kein Web MIDI. Bitte die Seite in Google Chrome öffnen (Safari und Firefox gehen nicht).',
    true,
  ],
  idle: ['Katana einschalten, per USB anschließen und auf „Verbinden“ klicken.', false],
  connecting: ['', false],
  connected: ['', false],
  denied: [
    'Chrome hat den MIDI-Zugriff blockiert. Links in der Adressleiste auf das Symbol klicken, „MIDI-Geräte steuern“ erlauben und die Seite neu laden.',
    true,
  ],
  'no-device': [
    'Kein Port „KATANA“ gefunden. Ist der Amp an und per USB verbunden? Ist der BOSS-KATANA-Treiber installiert? Sobald der Amp auftaucht, verbindet die Seite von selbst.',
    true,
  ],
  'no-answer': [
    'Der Port ist da, aber der Amp antwortet nicht. BOSS Tone Studio schließen, Amp aus- und einschalten, dann erneut verbinden. Sonst den Port von Hand wählen.',
    true,
  ],
  lost: ['Der Katana ist nicht mehr erreichbar. Sobald er wieder da ist, verbindet die Seite von selbst.', true],
  error: ['Unerwarteter Fehler, Details im Log.', true],
};

function render() {
  const { state, info } = connection;
  const status = $('status');
  status.textContent = STATUS[state];
  status.dataset.state = state;

  const [hint, bad] = HINTS[state];
  $('hint').textContent = hint;
  $('hint').classList.toggle('bad', bad);

  const connected = state === 'connected';
  $('connect').hidden = connected;
  $('connect').disabled = state === 'unsupported' || state === 'connecting';
  $('connect').textContent = state === 'idle' ? 'Verbinden' : 'Erneut verbinden';
  $('disconnect').hidden = !connected && state !== 'lost';
  $('refresh').disabled = !connected;
  $('manual-connect').disabled = state === 'unsupported' || state === 'connecting';

  const id = info.identity;
  $('f-device').textContent = id ? (id.isKatanaMk2 ? 'BOSS Katana MkII' : 'unbekanntes Gerät') : '–';
  $('f-version').textContent = id ? hex(id.version) : '–';
  $('f-channel').textContent = info.channel == null ? '–' : (CHANNEL_NAMES[info.channel] ?? `? (${info.channel})`);
  $('f-patch').textContent = info.patchName ?? '–';
  $('f-panel').textContent = info.panelName ?? '–';
  $('f-edit').textContent = connected ? (info.editMode ? 'an' : 'aus') : '–';
  $('f-ports').textContent = info.input ? `${info.input.name} / ${info.output.name}` : '–';

  fillPorts();
}

function fillPorts() {
  const { inputs, outputs } = connection.ports;
  const fill = (select, ports, current) => {
    const keep = select.value;
    select.textContent = '';
    for (const p of ports) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.state === 'connected' ? p.name : `${p.name} (getrennt)`;
      select.append(opt);
    }
    const want = current?.id ?? keep;
    if (ports.some((p) => p.id === want)) select.value = want;
    select.disabled = ports.length === 0;
  };
  fill($('in-port'), inputs, connection.info.input);
  fill($('out-port'), outputs, connection.info.output);
  if (inputs.length === 0 && connection.state !== 'unsupported') {
    $('in-port').innerHTML = '<option>erst verbinden</option>';
    $('out-port').innerHTML = '<option>erst verbinden</option>';
  }
}

connection.onChange(render);

$('connect').onclick = () => connection.connect();
$('disconnect').onclick = () => connection.disconnect();
$('refresh').onclick = () => connection.refresh();
$('manual-connect').onclick = () => {
  const inputId = $('in-port').value;
  const outputId = $('out-port').value;
  if (connection.ports.inputs.length === 0) connection.connect();
  else connection.connect({ inputId, outputId });
};

// Switch edit mode off when the tab closes, so the amp is not left in remote mode.
window.addEventListener('pagehide', () => connection.pageHide());

// ------------------------------------------------------------------ debug log

const logEl = $('log');
const MAX_ROWS = 2000;

function row(entry) {
  const el = document.createElement('span');
  el.className = `e ${entry.level}`;
  if (entry.tag) el.dataset.tag = entry.tag;
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = `${timestamp(entry.time)} `;
  el.append(t, entry.text);
  if (entry.raw) {
    const raw = document.createElement('span');
    raw.className = 'raw';
    raw.textContent = entry.raw;
    el.append(raw);
  }
  return el;
}

logger.subscribe((event) => {
  if (event.type === 'clear') {
    logEl.textContent = '';
    return;
  }
  logEl.append(row(event.entry));
  while (logEl.childElementCount > MAX_ROWS) logEl.firstElementChild.remove();
  if ($('opt-follow').checked) logEl.scrollTop = logEl.scrollHeight;
});

const applyLogOptions = () => {
  logEl.classList.toggle('show-raw', $('opt-raw').checked);
  logEl.classList.toggle('hide-amp', !$('opt-amp').checked);
};
$('opt-raw').onchange = applyLogOptions;
$('opt-amp').onchange = applyLogOptions;
applyLogOptions();

function logText() {
  const head = [
    `katana-helper Debug-Log, ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Seite: ${location.href}`,
    '',
  ];
  return head.join('\n') + logger.toText();
}

$('log-copy').onclick = async () => {
  const text = logText();
  try {
    await navigator.clipboard.writeText(text);
    logger.add('ok', `Log kopiert (${logger.entries.length} Einträge)`);
  } catch (e) {
    logger.add('err', `Kopieren fehlgeschlagen: ${e.message}. Bitte „Als Datei“ nehmen.`);
  }
};

$('log-save').onclick = () => {
  const blob = new Blob([logText()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `katana-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('log-clear').onclick = () => logger.clear();

// ------------------------------------------------------------------ start

logger.add('info', `Browser: ${navigator.userAgent}`);
render();

if (connection.state !== 'unsupported') {
  // Connect right away if Chrome already allowed MIDI for this page; otherwise wait for
  // the click, because the permission prompt should not appear unasked.
  midiPermission().then((state) => {
    logger.add('info', `MIDI-Berechtigung: ${state}`);
    if (state === 'granted') connection.connect();
  });
} else {
  logger.add('err', 'Web MIDI fehlt in diesem Browser');
}
