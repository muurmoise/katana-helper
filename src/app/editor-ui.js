// Editor controls: channel, amp type and model, knobs, effects with their detail
// parameters, undo and backup.

import { CHANNEL_NAMES } from '../lib/describe.js';
import { BLOCK_SPANS, decodeValue, effectParams, encodeValue, formatValue } from '../lib/effect-params.js';
import { AMP, AMP_KNOB, AMP_MODELS, COLORS, EFFECTS, KNOBS } from '../lib/patch.js';
import { fromBase128, toBase128 } from '../lib/sysex.js';
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

// ---------------------------------------------------------------- effect details

const OPEN_KEY = 'katana-helper:fx-open';

function loadOpenPanels() {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveOpenPanels(set) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...set]));
  } catch {
    // Storage blocked: panels just start closed next time.
  }
}

const readBytes = (state, p) => Array.from({ length: p.size ?? 1 }, (_, i) => state.get(toBase128(fromBase128(p.address) + i)));

/** One parameter: slider, list or switch. Returns { node, update() }. */
function paramControl(p, editor, state, related = []) {
  const id = `p-${p.address.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const write = (v) => editor.set(p.address, encodeValue(p, v), { related });
  const label = el('label', { htmlFor: id }, p.label);

  if (p.kind === 'range') {
    const input = el('input', { type: 'range', id, min: p.min, max: p.max, step: 1 });
    const out = el('output', { htmlFor: id }, '–');
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = formatValue(p, v);
      write(v);
    });
    return {
      node: el('div', { className: 'param' }, label, input, out),
      update() {
        const v = decodeValue(p, readBytes(state, p));
        if (busy(input)) return;
        if (v !== undefined) input.value = String(v);
        out.textContent = formatValue(p, v);
      },
    };
  }

  const select = el('select', { id });
  select.addEventListener('change', () => write(Number(select.value)));
  return {
    node: el('div', { className: 'param list' }, label, select),
    update() {
      if (!busy(select)) fillSelect(select, p.options, decodeValue(p, readBytes(state, p)));
    },
  };
}

/**
 * Detail panel of one effect: the effect knob of the amp panel, what the reverb knob
 * controls (reverb, delay 2), and the parameters of the active type. Rebuilt when type or
 * colour changes, otherwise only the values are updated.
 */
function effectPanel(fx, container, editor, state) {
  let key = null;
  let controls = [];

  const build = (type, color) => {
    container.textContent = '';
    controls = [];
    const top = el('div', { className: 'params top' });
    if (!fx.shares) {
      // 00 = off, 01–65 = 0–100. The amp moves the main parameter of the type along
      // (protocol.md 7.4), so read the whole block back afterwards.
      const knob = { label: 'Regler am Amp', address: fx.knob, kind: 'range', size: 1, min: 0, max: 101, show: (v) => (v === 0 ? 'aus' : String(v - 1)) };
      const spans = [BLOCK_SPANS[fx.key]];
      if (fx.key === 'delay' || fx.key === 'reverb') spans.push(BLOCK_SPANS.delay2);
      controls.push(paramControl(knob, editor, state, [fx.on, fx.led, ...spans]));
    }
    if (fx.layer && color !== undefined) {
      const layer = { label: 'Reverb-Regler steuert', address: fx.layer.slots[color], kind: 'list', size: 1, options: fx.layer.options };
      controls.push(paramControl(layer, editor, state));
    }
    top.append(...controls.map((c) => c.node));

    const params = effectParams(fx.key, type);
    const list = el('div', { className: 'params' });
    for (const p of params) {
      const c = paramControl(p, editor, state);
      controls.push(c);
      list.append(c.node);
    }
    const typeName = fx.types.find(([v]) => v === type)?.[1];
    const heading = el('h3', { className: 'fx-detail-title' }, typeName ? `${fx.label}: ${typeName}` : fx.label);
    container.append(top, heading);
    if (params.length) container.append(list);
    else container.append(el('p', { className: 'note' }, type === undefined ? 'Noch nicht gelesen.' : 'Für diesen Typ sind keine Regler bekannt.'));
  };

  return {
    render() {
      const type = state.get(fx.type);
      const color = state.get(fx.color);
      const k = `${type}|${color}`;
      if (k !== key) {
        key = k;
        build(type, color);
      }
      for (const c of controls) c.update();
    },
  };
}

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
  const openPanels = loadOpenPanels();
  for (const fx of EFFECTS) {
    const sw = el('input', { type: 'checkbox', role: 'switch', id: `fx-${fx.key}` });
    sw.addEventListener('change', () => editor.set(fx.on, sw.checked ? 1 : 0, { related: [fx.led] }));

    // Delay 2 has no button of its own; it follows the reverb colour.
    let colors = null;
    let colorBox;
    if (fx.shares) {
      colorBox = el('span', { className: 'fx-note' }, 'Farbe wie Reverb');
    } else {
      colorBox = el('div', { className: 'segmented colors', role: 'radiogroup', 'aria-label': `${fx.label} Farbe` });
      colors = segmented(
        colorBox,
        `color-${fx.key}`,
        COLORS.map((c, i) => [i, c]),
        (c) => editor.set(fx.color, c, { related: [fx.type, fx.led] }),
        { className: 'color' },
      );
    }

    const type = el('select', { 'aria-label': `${fx.label} Typ` });
    type.addEventListener('change', () => {
      const color = state.get(fx.color) ?? 0;
      editor.set(fx.type, Number(type.value), { related: [fx.slots[color] ?? fx.slots[0], fx.led] });
    });

    const detailId = `fx-detail-${fx.key}`;
    const toggle = el('button', { type: 'button', className: 'secondary small fx-toggle', 'aria-controls': detailId }, 'Regler');
    const detail = el('div', { className: 'fx-detail', id: detailId });
    const setOpen = (open) => {
      detail.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.classList.toggle('open', open);
      if (open) openPanels.add(fx.key);
      else openPanels.delete(fx.key);
      saveOpenPanels(openPanels);
    };
    toggle.addEventListener('click', () => setOpen(detail.hidden));
    setOpen(openPanels.has(fx.key));

    const row = el(
      'div',
      { className: 'fx' },
      el('label', { className: 'switch', htmlFor: sw.id }, sw, el('span', { className: 'fx-name' }, fx.label)),
      colorBox,
      type,
      toggle,
    );
    $('effects').append(el('div', { className: 'fx-item' }, row, detail));

    const panel = effectPanel(fx, detail, editor, state);
    renders.push(() => {
      const on = state.get(fx.on);
      sw.checked = on === 1;
      row.classList.toggle('off', on !== 1);
      detail.classList.toggle('off', on !== 1);
      const color = state.get(fx.color);
      colors?.set(color);
      row.dataset.color = String(color ?? '');
      if (!busy(type)) fillSelect(type, fx.types, state.get(fx.type));
      if (!detail.hidden) panel.render();
    });
    toggle.addEventListener('click', () => !detail.hidden && panel.render());
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
