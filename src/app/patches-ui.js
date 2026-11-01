// Patches section: channels in the amp, the library, and the save dialog.

import { CHANNEL_NAMES } from '../lib/describe.js';
import { patchFromState, patchName } from '../lib/patch.js';
import { download, stamp } from './log-ui.js';

const $ = (id) => document.getElementById(id);

function button(label, onClick, { className = 'secondary small', disabled = false, title = '' } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.disabled = disabled;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

const fileName = (text) => (text || 'patch').replace(/[^\w-]+/g, '_');
const when = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

export function mountPatches({ manager, library, editor, connection }) {
  let entries = [];

  const status = (text, bad = false) => {
    const el = $('patches-status');
    el.textContent = text;
    el.classList.toggle('bad', bad);
  };

  /** Run a manager action, show the result or the error. */
  const run = async (fn, okText) => {
    try {
      const result = await fn();
      if (okText) status(typeof okText === 'function' ? okText(result) : okText);
      return result;
    } catch (e) {
      status(e.message, true);
      connection.log('err', e.message);
      return null;
    }
  };

  // ---- channels in the amp
  function renderChannels() {
    const list = $('channel-list');
    list.textContent = '';
    const ready = editor.ready && !manager.busy;
    for (let n = 0; n <= 8; n++) {
      const li = document.createElement('li');
      li.className = 'channel-row';
      if (connection.state === 'connected' && connection.info.channel === n) li.classList.add('current');
      const label = document.createElement('span');
      label.className = 'ch-label';
      label.textContent = CHANNEL_NAMES[n];
      const name = document.createElement('span');
      name.className = 'ch-name';
      name.textContent = manager.channelNames?.[n] ?? '–';
      li.append(label, name);
      li.append(
        button('Sichern', () => run(() => manager.storeChannel(n), (e) => `${CHANNEL_NAMES[n]} gesichert: „${e.name}“`), {
          disabled: !ready,
          title: `${CHANNEL_NAMES[n]} in die Bibliothek kopieren`,
        }),
      );
      if (n > 0) {
        li.append(
          button('Speichern …', () => openSave({ channel: n }), {
            disabled: !ready,
            title: `Aktuellen Klang in ${CHANNEL_NAMES[n]} speichern`,
          }),
        );
      } else {
        li.append(document.createElement('span'));
      }
      list.append(li);
    }
  }

  // ---- library
  async function reloadLibrary() {
    entries = await library.list();
    renderLibrary();
  }

  function renderLibrary() {
    const list = $('library-list');
    list.textContent = '';
    const showBackups = $('lib-show-backups').checked;
    const shown = entries.filter((e) => showBackups || e.kind !== 'backup');
    if (shown.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = entries.length ? 'Nur Auto-Backups vorhanden.' : 'Noch keine Patches. „Sichern“ oder „Importieren“ legt welche an.';
      list.append(li);
      return;
    }
    const ready = editor.ready && !manager.busy;
    for (const e of shown) {
      const li = document.createElement('li');
      li.className = `lib-row${e.kind === 'backup' ? ' backup' : ''}`;

      const text = document.createElement('div');
      text.className = 'lib-text';
      const title = document.createElement('span');
      title.className = 'lib-name';
      title.textContent = e.name || '(ohne Namen)';
      const meta = document.createElement('span');
      meta.className = 'lib-meta';
      meta.textContent = [e.kind === 'backup' ? 'Auto-Backup' : null, e.origin, when(e.createdAt)].filter(Boolean).join(' · ');
      if (e.note) meta.title = e.note;
      text.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'lib-actions';
      actions.append(
        button('Laden', () => run(() => manager.loadEntry(e.id), (r) => (r.ok ? `„${e.name}“ geladen (nicht gespeichert)` : `„${e.name}“ geladen, mit Abweichungen, siehe Debug`)), {
          disabled: !ready,
          title: 'In den aktuellen Klang laden. Kein Kanal wird verändert.',
        }),
        button('In Kanal …', () => openSave({ entry: e }), { disabled: !ready }),
        menu(e),
      );
      li.append(text, actions);
      list.append(li);
    }
  }

  function menu(e) {
    const details = document.createElement('details');
    details.className = 'menu';
    const summary = document.createElement('summary');
    summary.textContent = '⋯';
    summary.setAttribute('aria-label', `Weitere Aktionen für ${e.name}`);
    const box = document.createElement('div');
    box.className = 'menu-box';
    const close = () => (details.open = false);
    box.append(
      button('Umbenennen', async () => {
        close();
        const name = prompt('Neuer Name (höchstens 16 Zeichen, ohne Umlaute):', e.name);
        if (name != null && name.trim()) await run(() => library.rename(e.id, name.trim()), 'Umbenannt');
      }),
      button('Exportieren', async () => {
        close();
        download(await library.exportJson([e.id]), 'application/json', `katana-patch-${fileName(e.name)}.json`);
      }),
    );
    if (e.kind === 'backup') {
      box.append(button('Als Patch behalten', () => (close(), run(() => library.keep(e.id), 'Als Patch behalten'))));
    }
    box.append(
      button('Löschen', async () => {
        close();
        if (confirm(`„${e.name}“ (${e.origin}, ${when(e.createdAt)}) aus der Bibliothek löschen?`)) {
          await run(() => library.remove(e.id), 'Gelöscht');
        }
      }),
    );
    details.append(summary, box);
    return details;
  }

  $('lib-store-current').onclick = () => run(() => manager.storeCurrent(), (e) => `Aktueller Klang gesichert: „${e.name}“`);
  $('lib-export-all').onclick = async () => {
    download(await library.exportJson(), 'application/json', `katana-bibliothek-${stamp()}.json`);
  };
  $('lib-import').onchange = async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    await run(async () => library.importJson(await file.text()), (n) => `${n} ${n === 1 ? 'Patch' : 'Patches'} importiert`);
  };
  $('lib-show-backups').onchange = renderLibrary;

  // ---- save dialog
  const dialog = $('save-dialog');
  const select = $('save-channel');
  for (let n = 1; n <= 8; n++) select.append(new Option(CHANNEL_NAMES[n], String(n)));
  let pending = null;

  function updateWarning() {
    const n = Number(select.value);
    const old = manager.channelNames?.[n] ?? '?';
    $('save-warning').textContent = `Überschreibt ${CHANNEL_NAMES[n]} „${old}“ dauerhaft. Vorher sichert katana-helper ${CHANNEL_NAMES[n]} automatisch in die Bibliothek.`;
    $('save-confirm').textContent = `In ${CHANNEL_NAMES[n]} speichern`;
  }
  select.onchange = updateWarning;

  function openSave({ channel = null, entry = null }) {
    pending = { entry };
    const current = connection.info.channel;
    select.value = String(channel ?? (current >= 1 && current <= 8 ? current : 1));
    $('save-name').value = entry ? entry.name : patchName(patchFromState(editor.state));
    $('save-what').textContent = entry
      ? `Lädt „${entry.name}“ aus der Bibliothek in den Amp und speichert es dann im gewählten Kanal.`
      : 'Speichert den aktuellen Klang im gewählten Kanal.';
    updateWarning();
    dialog.showModal();
  }

  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save' || !pending) return;
    const n = Number(select.value);
    const name = $('save-name').value.trim() || null;
    const { entry } = pending;
    pending = null;
    await run(
      () => (entry ? manager.writeEntryToChannel(entry.id, n, { name }) : manager.saveToChannel(n, { name })),
      (r) => (r.ok ? `In ${CHANNEL_NAMES[n]} gespeichert und geprüft` : `In ${CHANNEL_NAMES[n]} gespeichert, aber mit Abweichungen. Backup liegt in der Bibliothek.`),
    );
  });

  // ---- wiring
  const renderAll = () => {
    renderChannels();
    renderLibrary();
    $('lib-store-current').disabled = !editor.ready || !!manager.busy;
    if (manager.busy) status(`${manager.busy} …`);
  };
  // Knob moves make the editor emit often; rebuild the lists only when something they show
  // changes, so an open menu stays open.
  let lastKey = '';
  const maybeRender = () => {
    const key = [editor.ready, manager.busy, connection.state, connection.info.channel].join('|');
    if (key === lastKey) return;
    lastKey = key;
    renderAll();
  };
  manager.onChange(renderAll);
  editor.onChange(maybeRender);
  connection.onChange(maybeRender);
  library.onChange(reloadLibrary);
  $('library-kind').textContent = library.backend.kind === 'indexeddb' ? '' : '(nur bis zum Neuladen, Browser-Speicher nicht verfügbar)';
  reloadLibrary();
  renderAll();
}
