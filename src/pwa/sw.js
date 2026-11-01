// Service worker for katana-helper. Emitted as sw.js by build/pwa-plugin.js, which puts
// `const KH = { version, precache }` in front of this file. Plain script, no imports.
//
// - install: put every file of this build into the cache "katana-helper-<version>".
// - activate: delete the caches of older versions.
// - fetch: pages and files of this build come from the cache, everything else from the
//   network. So the app keeps working offline, and a new build only takes over when the
//   page asks for it (update notice → SKIP_WAITING). Nothing updates silently.
/* global KH */

const PREFIX = 'katana-helper-';
const CACHE = PREFIX + KH.version;
const scope = () => new URL(self.registration.scope);
const urlOf = (path) => new URL(path, scope()).href;

// Navigations: the folder URL stands for its index.html.
function pageFor(url) {
  const base = scope().pathname;
  if (!url.pathname.startsWith(base) && url.pathname + '/' !== base) return null;
  let rest = url.pathname.slice(base.length);
  if (rest === '' || rest.endsWith('/')) rest += 'index.html';
  return KH.precache.includes(rest) ? urlOf(rest) : null;
}

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache, so the files really belong to this build.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(KH.precache.map((p) => new Request(urlOf(p), { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'VERSION') event.source?.postMessage({ type: 'VERSION', version: KH.version });
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope().origin) return;

  let target = null;
  if (request.mode === 'navigate') target = pageFor(url);
  else {
    const path = url.pathname.slice(scope().pathname.length);
    if (url.pathname.startsWith(scope().pathname) && KH.precache.includes(path)) target = urlOf(path);
  }
  if (!target) return; // not part of this build: browser default

  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(target))
      .then((hit) => hit ?? fetch(request)),
  );
});
