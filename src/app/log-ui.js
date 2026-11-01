// Debug log view: rows, filters, copy and save.

import { timestamp } from '../lib/log.js';

const $ = (id) => document.getElementById(id);
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

export function mountLog(logger) {
  const logEl = $('log');

  logger.subscribe((event) => {
    if (event.type === 'clear') {
      logEl.textContent = '';
      return;
    }
    logEl.append(row(event.entry));
    while (logEl.childElementCount > MAX_ROWS) logEl.firstElementChild.remove();
    if ($('opt-follow').checked) logEl.scrollTop = logEl.scrollHeight;
  });

  const applyOptions = () => {
    logEl.classList.toggle('show-raw', $('opt-raw').checked);
    logEl.classList.toggle('hide-amp', !$('opt-amp').checked);
  };
  $('opt-raw').onchange = applyOptions;
  $('opt-amp').onchange = applyOptions;
  applyOptions();

  const text = () =>
    [`katana-helper Debug-Log, ${new Date().toISOString()}`, `Browser: ${navigator.userAgent}`, `Seite: ${location.href}`, '']
      .join('\n') + logger.toText();

  $('log-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text());
      logger.add('ok', `Log kopiert (${logger.entries.length} Einträge)`);
    } catch (e) {
      logger.add('err', `Kopieren fehlgeschlagen: ${e.message}. Bitte „Als Datei“ nehmen.`);
    }
  };
  $('log-save').onclick = () => download(text(), 'text/plain', `katana-log-${stamp()}.txt`);
  $('log-clear').onclick = () => logger.clear();

  // Remember whether the debug panel was open.
  const debug = $('debug');
  try {
    debug.open = localStorage.getItem('katana-debug-open') === '1';
  } catch {
    // storage blocked; panel stays closed
  }
  debug.addEventListener('toggle', () => {
    try {
      localStorage.setItem('katana-debug-open', debug.open ? '1' : '0');
    } catch {
      // ignore
    }
    if (debug.open) logEl.scrollTop = logEl.scrollHeight;
  });
}

export function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function download(content, type, filename) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
