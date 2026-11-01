import { describe, expect, it, vi } from 'vitest';
import { manifest, serviceWorkerSource } from '../../build/pwa-plugin.js';

const SCOPE = 'https://muurmoise.github.io/katana-helper/';
const PRECACHE = ['assets/main-abc.js', 'assets/main-abc.css', 'icons/icon.svg', 'index.html', 'manifest.webmanifest', 'probe/index.html'];

class FakeRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.cache = init.cache;
  }
}

/** Run sw.js against fake worker globals. */
function worker({ version = '1.0.0+aaa', existing = [] } = {}) {
  const stores = new Map(existing.map((name) => [name, new Map()]));
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          for (const r of requests) store.set(r.url, { body: `cached ${r.url}`, cache: r.cache });
        },
        async match(url) {
          return store.get(url);
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  const handlers = {};
  const self = {
    registration: { scope: SCOPE },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(),
    addEventListener: (type, fn) => (handlers[type] = fn),
  };
  const fetch = vi.fn(async (request) => ({ body: `network ${request.url}` }));
  const code = serviceWorkerSource({ version, precache: PRECACHE });
  new Function('self', 'caches', 'fetch', 'Request', code)(self, caches, fetch, FakeRequest);

  const run = async (type, event) => {
    let waited;
    let response;
    handlers[type]({ ...event, waitUntil: (p) => (waited = p), respondWith: (p) => (response = p) });
    await waited;
    return response === undefined ? undefined : await response;
  };
  const get = (url, mode = 'no-cors') => run('fetch', { request: { method: 'GET', url, mode } });
  return { stores, self, fetch, run, get };
}

describe('service worker', () => {
  it('caches every file of the build under its version, bypassing the HTTP cache', async () => {
    const w = worker();
    await w.run('install', {});
    const store = w.stores.get('katana-helper-1.0.0+aaa');
    expect([...store.keys()]).toEqual(PRECACHE.map((p) => SCOPE + p));
    expect([...store.values()].every((e) => e.cache === 'reload')).toBe(true);
  });

  it('removes caches of older versions only', async () => {
    const w = worker({ existing: ['katana-helper-0.9.0+old', 'something-else'] });
    await w.run('install', {});
    await w.run('activate', {});
    expect([...w.stores.keys()].sort()).toEqual(['katana-helper-1.0.0+aaa', 'something-else']);
    expect(w.self.clients.claim).toHaveBeenCalled();
  });

  it('serves pages from the cache', async () => {
    const w = worker();
    await w.run('install', {});
    expect((await w.get(SCOPE, 'navigate')).body).toBe(`cached ${SCOPE}index.html`);
    expect((await w.get(`${SCOPE}?x=1`, 'navigate')).body).toBe(`cached ${SCOPE}index.html`);
    expect((await w.get(SCOPE.slice(0, -1), 'navigate')).body).toBe(`cached ${SCOPE}index.html`);
    expect((await w.get(`${SCOPE}probe/`, 'navigate')).body).toBe(`cached ${SCOPE}probe/index.html`);
    expect(await w.get(`${SCOPE}nope/`, 'navigate')).toBeUndefined();
    expect(await w.get('https://muurmoise.github.io/other/', 'navigate')).toBeUndefined();
  });

  it('serves files of the build from the cache and leaves the rest alone', async () => {
    const w = worker();
    await w.run('install', {});
    expect((await w.get(`${SCOPE}assets/main-abc.js`)).body).toBe(`cached ${SCOPE}assets/main-abc.js`);
    expect(await w.get(`${SCOPE}assets/main-new.js`)).toBeUndefined();
    expect(await w.get('https://cdn.example.com/x.js')).toBeUndefined();
    expect(await w.run('fetch', { request: { method: 'POST', url: `${SCOPE}index.html`, mode: 'cors' } })).toBeUndefined();
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the network when the cache misses', async () => {
    const w = worker(); // not installed: cache empty
    expect((await w.get(`${SCOPE}assets/main-abc.js`)).body).toBe(`network ${SCOPE}assets/main-abc.js`);
  });

  it('only takes over when the page asks (SKIP_WAITING) and reports its version', async () => {
    const w = worker();
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    await w.run('message', { data: { type: 'SKIP_WAITING' } });
    expect(w.self.skipWaiting).toHaveBeenCalledTimes(1);
    const source = { postMessage: vi.fn() };
    await w.run('message', { data: { type: 'VERSION' }, source });
    expect(source.postMessage).toHaveBeenCalledWith({ type: 'VERSION', version: '1.0.0+aaa' });
  });
});

describe('manifest', () => {
  it('uses the base path for start, scope and icons', () => {
    const m = manifest('/katana-helper/');
    expect(m).toMatchObject({ start_url: '/katana-helper/', scope: '/katana-helper/', id: '/katana-helper/', display: 'standalone', lang: 'de' });
    expect(m.icons.map((i) => i.src)).toContain('/katana-helper/icons/icon-512.png');
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    expect(manifest('/').start_url).toBe('/');
  });
});
