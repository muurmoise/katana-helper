// Page side of the service worker: register it, notice when a new build is waiting, and
// switch to it only when the user says so.

/**
 * Register `${base}sw.js`. onUpdate(apply) is called once a new version is installed and
 * waiting; calling apply() activates it and reloads the page.
 * Returns the registration, or null without service worker support.
 */
export async function registerServiceWorker({
  base,
  onUpdate,
  log = () => {},
  nav = globalThis.navigator,
  win = globalThis.window,
  checkEveryMs = 60 * 60 * 1000,
}) {
  const sw = nav?.serviceWorker;
  if (!sw) return null;

  let applying = false;
  sw.addEventListener('controllerchange', () => {
    // Only reload when the user asked for the update, not on the very first install.
    if (applying) win.location.reload();
  });

  let reg;
  try {
    reg = await sw.register(`${base}sw.js`, { scope: base });
  } catch (e) {
    log('warn', `Offline-Speicher nicht verfügbar: ${e?.message ?? e}`);
    return null;
  }

  let announced = null;
  const announce = (worker) => {
    if (!worker || worker === announced || !sw.controller) return; // first install: nothing to replace
    announced = worker;
    log('info', 'Neue Version von katana-helper ist bereit');
    onUpdate(() => {
      applying = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  const watch = (worker) => {
    if (!worker) return;
    if (worker.state === 'installed') announce(worker);
    else worker.addEventListener('statechange', () => worker.state === 'installed' && announce(worker));
  };

  watch(reg.waiting);
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));

  // Look for a new build now and then, and whenever the tab comes back.
  const check = () => reg.update().catch(() => {});
  if (checkEveryMs) win.setInterval(check, checkEveryMs);
  win.document?.addEventListener('visibilitychange', () => win.document.visibilityState === 'visible' && check());
  return reg;
}

/** "Als App installieren": Chrome hands out the install prompt via beforeinstallprompt. */
export function watchInstall({ win = globalThis.window, onChange }) {
  let prompt = null;
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e;
    onChange(true);
  });
  win.addEventListener('appinstalled', () => {
    prompt = null;
    onChange(false);
  });
  return async () => {
    if (!prompt) return false;
    const p = prompt;
    prompt = null;
    onChange(false);
    await p.prompt();
    const choice = await p.userChoice;
    return choice?.outcome === 'accepted';
  };
}

/** Running as installed app (own window) rather than in a browser tab. */
export const isInstalled = (win = globalThis.window) => !!win.matchMedia?.('(display-mode: standalone)').matches;
