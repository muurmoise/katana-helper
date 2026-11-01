// Editor controls: channel, amp type and model, knobs, effects, undo and backup.

import { CHANNEL_NAMES } from '../lib/describe.js';
import { AMP, AMP_KNOB, AMP_MODELS, COLORS, EFFECTS, KNOBS } from '../lib/patch.js';
import { download, stamp } from './log-ui.js';

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

/** Radio buttons styled as a segmented control. Returns { set(value) }. */
function segmented(container, name, options, onPick, { className = '' } = {}) {
  const inputs = options.map(([value, label]) => {
    const input = el('input', { type: 'radio', name, value: String(value) });
    input.addEventListener('change', () => input.checked && onPick(value));
    container.append(el('label', { className: `seg ${className}`, dataset: { value: String(value) } }, input, el('span', {}, label)));
    return input;
  });
  return {
    set(value) {
      for (const input of inputs) input.checked = input.value === String(value);
    },
  };
}

function fillSelect(select, options, value) {
  if (select.options.length === 0) {
    for (const [v, label] of options) select.append(el('option', { value: String(v) }, label));
  }
  const known = options.some(([v]) => v === value);
  select.querySelector('option[data-unknown]')?.remove();
  if (value !== undefined && !known) {
    select.append(el('option', { value: String(value), dataset: { unknown: '1' } }, `unbekannt (${value})`));
  }
  if (value !== undefined) select.value = String(value);
}

// A slider the user is dragging or a select that is open should not jump.
const busy = (node) => node === document.activeElement && (node.matches(':active') || node.tagName === 'SELECT');

export function mountEditor(editor, connection) {
  const { state } = editor;
  const renders = [];

  // ---- channels
  const channels = segmented(
    $('channels'),
    'channel',
    CHANNEL_NAMES.map((n, i) => [i, n]),
    (n) => {
      if (editor.dirty && !confirm('Nicht gespeicherte Änderungen am aktuellen Klang gehen verloren. Trotzdem den Kanal wechseln?')) {
        channels.set(connection.info.channel);
        return;
      }
      editor.setChannel(n);
    },
  );
  renders.push(() => channels.set(connection.info.channel));

  // ---- amp type + model
  const ampType = segmented($('amp-type'), 'amp-type', AMP_KNOB, (v) =>
    editor.set(AMP.typeKnob, v, { related: [AMP.model, AMP.variationLed] }),
  );
  const model = $('amp-model');
  model.addEventListener('change', () =>
    editor.set(AMP.model, Number(model.value), { related: [AMP.typeKnob, AMP.variationLed] }),
  );
  renders.push(() => {
    ampType.set(state.get(AMP.typeKnob));
    if (!busy(model)) fillSelect(model, AMP_MODELS, state.get(AMP.model));
    $('variation').hidden = state.get(AMP.variationLed) !== 1;
  });

  // ---- knobs
  for (const k of KNOBS) {
    const id = `knob-${k.key}`;
    const input = el('input', { type: 'range', id, min: 0, max: 100, step: 1 });
    const out = el('output', { htmlFor: id }, '–');
    input.addEventListener('input', () => {
      out.textContent = input.value;
      editor.set(k.address, Number(input.value), { related: [k.preamp] });
    });
    $('knobs').append(el('div', { className: 'knob' }, el('label', { htmlFor: id }, k.label), input, out));
    renders.push(() => {
      const v = state.get(k.address);
      if (v === undefined || busy(input)) return;
      input.value = String(v);
      out.textContent = String(v);
    });
  }

  // ---- effects
  for (const fx of EFFECTS) {
    const sw = el('input', { type: 'checkbox', role: 'switch', id: `fx-${fx.key}` });
    sw.addEventListener('change', () => editor.set(fx.on, sw.checked ? 1 : 0, { related: [fx.led] }));

    const colorBox = el('div', { className: 'segmented colors', role: 'radiogroup', 'aria-label': `${fx.label} Farbe` });
    const colors = segmented(
      colorBox,
      `color-${fx.key}`,
      COLORS.map((c, i) => [i, c]),
      (c) => editor.set(fx.color, c, { related: [fx.type, fx.led] }),
      { className: 'color' },
    );

    const type = el('select', { 'aria-label': `${fx.label} Typ` });
    type.addEventListener('change', () => {
      const color = state.get(fx.color) ?? 0;
      editor.set(fx.type, Number(type.value), { related: [fx.slots[color] ?? fx.slots[0], fx.led] });
    });

    const row = el(
      'div',
      { className: 'fx' },
      el('label', { className: 'switch', htmlFor: sw.id }, sw, el('span', { className: 'fx-name' }, fx.label)),
      colorBox,
      type,
    );
    $('effects').append(row);

    renders.push(() => {
      const on = state.get(fx.on);
      sw.checked = on === 1;
      row.classList.toggle('off', on !== 1);
      const color = state.get(fx.color);
      colors.set(color);
      row.dataset.color = String(color ?? '');
      if (!busy(type)) fillSelect(type, fx.types, state.get(fx.type));
    });
  }

  // ---- session bar
  $('undo').onclick = () => editor.undo();
  $('reload').onclick = () => editor.load({ newBaseline: false });
  $('backup').onclick = () => {
    const text = editor.backupText();
    if (!text) return;
    const name = (editor.backup.patchName || 'patch').replace(/[^\w-]+/g, '_');
    download(text, 'application/json', `katana-backup-${name}-${stamp()}.json`);
  };

  const render = () => {
    const ready = editor.ready;
    $('editor').disabled = !ready;
    for (const r of renders) r();
    $('undo').disabled = !editor.dirty;
    $('backup').disabled = !editor.backup;
    $('session-text').textContent = !ready
      ? connection.state === 'connected'
        ? 'Patch wird gelesen …'
        : 'Nicht verbunden'
      : editor.dirty
        ? `${editor.changed.size} geänderte Werte im aktuellen Klang (nicht gespeichert)`
        : 'Keine Änderungen';
  };

  editor.onChange(render);
  state.subscribe(render);
  connection.onChange(render);
  render();
}
