// "System (global)": Line Out Air Feel switch. Settings here apply to all channels and are
// not part of a patch, so they sit outside the editor fieldset.

import { AIR_FEEL_NAMES } from '../lib/system.js';

const $ = (id) => document.getElementById(id);

const HELP = {
  REC: 'Nah mikrofoniert, wie bei einer Aufnahme',
  LIVE: 'Amp im Raum, wie live',
  BLEND: 'Mischung aus REC und LIVE',
};

export function mountSystem(system, connection) {
  const set = $('air-feel-set');
  const status = $('air-feel-status');
  const error = $('air-feel-error');

  const inputs = AIR_FEEL_NAMES.map((name) => {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'air-feel';
    input.value = name;
    input.addEventListener('change', () => input.checked && system.setAirFeel(name));
    const text = document.createElement('span');
    text.textContent = name;
    const label = document.createElement('label');
    label.className = 'seg';
    label.title = HELP[name];
    label.append(input, text);
    $('air-feel').append(label);
    return input;
  });

  function render() {
    const connected = connection.state === 'connected';
    set.disabled = !system.ready;
    set.setAttribute('aria-busy', String(system.busy || !!system.loading));
    for (const input of inputs) input.checked = input.value === system.airFeel;

    status.textContent = !connected
      ? 'Erst den Amp verbinden.'
      : system.loading
        ? 'Lese Einstellung …'
        : system.busy
          ? `Schalte auf ${system.airFeel} …`
          : system.airFeel
            ? HELP[system.airFeel]
            : '';
    $('air-feel-custom').hidden = !(connected && system.lineOutCustom);
    error.hidden = !system.error;
    error.textContent = system.error ?? '';
  }

  system.onChange(render);
  connection.onChange(render);
  render();
}
