import { describe, expect, it, vi } from 'vitest';
import { isInstalled, registerServiceWorker, watchInstall } from './register.js';

class Emitter {
  constructor() {
    this.handlers = {};
  }
  addEventListener(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  }
  emit(type, event = {}) {
    for (const fn of this.handlers[type] ?? []) fn(event);
  }
}

class FakeWorker extends Emitter {
  constructor(state) {
    super();
    this.state = state;
    this.postMessage = vi.fn();
  }
  setState(state) {
    this.state = state;
    this.emit('statechange');
  }
}

function browser({ controller = {}, waiting = null, fail = false } = {}) {
  const reg = new Emitter();
  reg.waiting = waiting;
  reg.installing = null;
  reg.update = vi.fn(async () => {});
  const sw = new Emitter();
  sw.controller = controller;
  sw.register = vi.fn(async () => {
    if (fail) throw new Error('blocked');
    return reg;
  });
  const doc = new Emitter();
  doc.visibilityState = 'visible';
  const win = new Emitter();
  Object.assign(win, { location: { reload: vi.fn() }, setInterval: vi.fn(), document: doc });
  return { reg, sw, win, doc, nav: { serviceWorker: sw } };
}

describe('registerServiceWorker', () => {
  it('registers sw.js under the base path', async () => {
    const b = browser();
    await registerServiceWorker({ base: '/katana-helper/', onUpdate: () => {}, nav: b.nav, win: b.win });
    expect(b.sw.register).toHaveBeenCalledWith('/katana-helper/sw.js', { scope: '/katana-helper/' });
    expect(b.win.setInterval).toHaveBeenCalled();
  });

  it('does nothing without service worker support', async () => {
    expect(await registerServiceWorker({ base: '/', onUpdate: () => {}, nav: {}, win: {} })).toBeNull();
  });

  it('logs and carries on when registering fails', async () => {
    const b = browser({ fail: true });
    const log = vi.fn();
    expect(await registerServiceWorker({ base: '/', onUpdate: () => {}, log, nav: b.nav, win: b.win })).toBeNull();
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('blocked'));
  });

  it('announces a version that is already waiting, and applies it only on request', async () => {
    const waiting = new FakeWorker('installed');
    const b = browser({ waiting });
    const onUpdate = vi.fn();
    await registerServiceWorker({ base: '/', onUpdate, nav: b.nav, win: b.win });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).not.toHaveBeenCalled();

    onUpdate.mock.calls[0][0](); // user clicks "Aktualisieren"
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    b.sw.emit('controllerchange');
    expect(b.win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('announces a version found later, once it is installed', async () => {
    const b = browser();
    const onUpdate = vi.fn();
    await registerServiceWorker({ base: '/', onUpdate, nav: b.nav, win: b.win });
    const next = new FakeWorker('installing');
    b.reg.installing = next;
    b.reg.emit('updatefound');
    expect(onUpdate).not.toHaveBeenCalled();
    next.setState('installed');
    next.setState('installed');
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on the very first install and does not reload by itself', async () => {
    const b = browser({ controller: null });
    const onUpdate = vi.fn();
    await registerServiceWorker({ base: '/', onUpdate, nav: b.nav, win: b.win });
    const first = new FakeWorker('installing');
    b.reg.installing = first;
    b.reg.emit('updatefound');
    first.setState('installed');
    b.sw.emit('controllerchange'); // clients.claim() of the first worker
    expect(onUpdate).not.toHaveBeenCalled();
    expect(b.win.location.reload).not.toHaveBeenCalled();
  });

  it('checks for a new version when the tab comes back', async () => {
    const b = browser();
    await registerServiceWorker({ base: '/', onUpdate: () => {}, nav: b.nav, win: b.win });
    b.doc.emit('visibilitychange');
    expect(b.reg.update).toHaveBeenCalled();
  });
});

describe('watchInstall', () => {
  it('offers the install prompt Chrome hands out', async () => {
    const win = new Emitter();
    const onChange = vi.fn();
    const install = watchInstall({ win, onChange });
    expect(await install()).toBe(false);

    const event = { preventDefault: vi.fn(), prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    win.emit('beforeinstallprompt', event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(await install()).toBe(true);
    expect(event.prompt).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('knows when it runs as installed app', () => {
    expect(isInstalled({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isInstalled({})).toBe(false);
  });
});
