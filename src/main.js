// Editor app: connection status, editor controls, debug panel.

import { mountEditor } from './app/editor-ui.js';
import { mountLog } from './app/log-ui.js';
import { mountPatches } from './app/patches-ui.js';
import { Connection } from './lib/connection.js';
import { CHANNEL_NAMES } from './lib/describe.js';
import { Editor } from './lib/editor.js';
import { PatchLibrary, indexedDbBackend, memoryBackend } from './lib/library.js';
import { PatchManager } from './lib/manager.js';
import { Logger } from './lib/log.js';
import { WebMidiTransport, midiPermission } from './lib/midi-transport.js';
import { hex } from './lib/sysex.js';
import { isInstalled, registerServiceWorker, watchInstall } from './pwa/register.js';

const $ = (id) => document.getElementById(id);

const logger = new Logger();
const connection = new Connection({ transport: new WebMidiTransport(), logger });
const editor = new Editor(connection);

// IndexedDB keeps the library across reloads. Without it (blocked storage) the library
// still works, but only until the page is reloaded.
async function openLibrary() {
  try {
    const backend = indexedDbBackend();
    await backend.all();
    return new PatchLibrary(backend);
  } catch (e) {
    logger.add('warn', `Browser-Speicher nicht verfügbar (${e?.message ?? e}). Bibliothek nur bis zum Neuladen.`);
    return new PatchLibrary(memoryBackend());
  }
}
const library = await openLibrary();
const manager = new PatchManager({ connection, editor, library });

// ------------------------------------------------------------------ status

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
  unsupported:
    'Dieser Browser kann kein Web MIDI. Bitte die Seite in Google Chrome öffnen (Safari und Firefox gehen nicht).',
  idle: 'Katana einschalten, per USB anschließen und auf „Verbinden“ klicken.',
  connecting: '',
  connected: '',
  denied:
    'Chrome hat den MIDI-Zugriff blockiert. Links in der Adressleiste auf das Symbol klicken, „MIDI-Geräte steuern“ erlauben und die Seite neu laden.',
  'no-device':
    'Kein Port „KATANA“ gefunden. Ist der Amp an und per USB verbunden? Ist der BOSS-KATANA-Treiber installiert? Sobald der Amp auftaucht, verbindet die Seite von selbst.',
  'no-answer':
    'Der Port ist da, aber der Amp antwortet nicht. BOSS Tone Studio schließen, Amp aus- und einschalten, dann erneut verbinden. Sonst unter „Debug“ den Port von Hand wählen.',
  lost: 'Der Katana ist nicht mehr erreichbar. Sobald er wieder da ist, verbindet die Seite von selbst.',
  error: 'Unerwarteter Fehler, Details unter „Debug“.',
};

function render() {
  const { state, info } = connection;
  const status = $('status');
  status.textContent = STATUS[state];
  status.dataset.state = state;

  const hint = $('hint');
  hint.textContent = HINTS[state];
  hint.dataset.tone = state === 'idle' ? 'info' : 'bad';

  const connected = state === 'connected';
  $('connect').hidden = connected;
  $('connect').disabled = state === 'unsupported' || state === 'connecting';
  $('connect').textContent = state === 'idle' ? 'Verbinden' : 'Erneut verbinden';
  $('disconnect').hidden = !connected && state !== 'lost';
  $('manual-connect').disabled = state === 'unsupported' || state === 'connecting';

  const channel = info.channel == null ? null : (CHANNEL_NAMES[info.channel] ?? `? (${info.channel})`);
  $('patch-title').textContent = connected && channel ? `${channel} · ${info.patchName ?? ''}` : '';

  const id = info.identity;
  $('f-device').textContent = id ? (id.isKatanaMk2 ? 'BOSS Katana MkII' : 'unbekanntes Gerät') : '–';
  $('f-version').textContent = id ? hex(id.version) : '–';
  $('f-channel').textContent = channel ?? '–';
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
    if (ports.length === 0) {
      select.append(new Option('erst verbinden', ''));
      select.disabled = true;
      return;
    }
    for (const p of ports) select.append(new Option(p.state === 'connected' ? p.name : `${p.name} (getrennt)`, p.id));
    const want = current?.id ?? keep;
    if (ports.some((p) => p.id === want)) select.value = want;
    select.disabled = false;
  };
  fill($('in-port'), inputs, connection.info.input);
  fill($('out-port'), outputs, connection.info.output);
}

connection.onChange(render);

$('connect').onclick = () => connection.connect();
$('disconnect').onclick = () => connection.disconnect();
$('manual-connect').onclick = () => {
  if (connection.ports.inputs.length === 0) connection.connect();
  else connection.connect({ inputId: $('in-port').value, outputId: $('out-port').value });
};

// Switch edit mode off when the tab closes, so the amp is not left in remote mode.
window.addEventListener('pagehide', () => connection.pageHide());

// ------------------------------------------------------------------ app version, update, install

const VERSION = __APP_VERSION__;
$('app-version').textContent = `Version ${VERSION}${isInstalled() ? ' · als App' : ''}`;
$('f-app').textContent = VERSION;

function showUpdate(apply) {
  $('update').hidden = false;
  $('update-later').onclick = () => ($('update').hidden = true);
  $('update-apply').onclick = () => {
    if (
      editor.dirty &&
      !confirm(
        'Die Seite lädt neu. Der aktuelle Klang bleibt im Amp, aber „Änderungen zurücknehmen“ kennt danach den alten Stand nicht mehr. Trotzdem aktualisieren?',
      )
    ) {
      return;
    }
    if (manager.busy) {
      alert(`Bitte warten: ${manager.busy}`);
      return;
    }
    $('update-apply').disabled = true;
    apply();
  };
}

const install = watchInstall({ onChange: (available) => ($('install').hidden = !available) });
$('install').onclick = async () => {
  if (await install()) logger.add('ok', 'katana-helper als App installiert');
};

// The service worker only exists in the built app; during development nothing is cached.
if (import.meta.env.PROD) {
  registerServiceWorker({
    base: import.meta.env.BASE_URL,
    onUpdate: showUpdate,
    log: (level, text) => logger.add(level, text),
  });
}

// ------------------------------------------------------------------ start

mountLog(logger);
mountEditor(editor, connection);
mountPatches({ manager, library, editor, connection });
logger.add('info', `katana-helper ${VERSION}${isInstalled() ? ' (als App)' : ''}, Browser: ${navigator.userAgent}`);
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
