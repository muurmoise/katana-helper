// Build-only Vite plugin for the PWA (no extra dependencies):
// - emits manifest.webmanifest for the configured base path,
// - emits sw.js = src/pwa/sw.js with the version and the list of files to precache,
// - adds the manifest link and theme colours to the main page.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

export function manifest(base) {
  return {
    id: base,
    name: 'katana-helper',
    short_name: 'Katana',
    description: 'Editor für den BOSS Katana-100 MkII (Web MIDI)',
    lang: 'de',
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: '#141413',
    theme_color: '#1c1c1a',
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${base}icons/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}

/** All files below `dir`, as paths relative to it with forward slashes. */
function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    let names = [];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const name of names) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (!name.startsWith('.')) out.push(relative(dir, path).split('\\').join('/'));
    }
  };
  walk(dir);
  return out;
}

/** Source of the emitted sw.js: settings line + src/pwa/sw.js. */
export function serviceWorkerSource({ version, precache }) {
  const body = readFileSync(join(root, 'src/pwa/sw.js'), 'utf8');
  return `const KH = ${JSON.stringify({ version, precache })};\n${body}`;
}

export function pwa({ version }) {
  let config;
  return {
    name: 'katana-helper-pwa',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    transformIndexHtml(html, ctx) {
      if (!ctx.path.endsWith('/index.html') || ctx.path.includes('/probe/')) return html;
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${config.base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#f4f4f1', media: '(prefers-color-scheme: light)' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#141413', media: '(prefers-color-scheme: dark)' }, injectTo: 'head' },
      ];
    },
    // After everything is written: list the output folder, so HTML pages, assets and
    // public files all end up in the precache list.
    closeBundle() {
      const out = resolve(config.root, config.build.outDir);
      writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify(manifest(config.base), null, 2));
      const precache = listFiles(out)
        .filter((f) => !f.endsWith('.map') && f !== 'sw.js')
        .sort();
      writeFileSync(join(out, 'sw.js'), serviceWorkerSource({ version, precache }));
      config.logger.info(`pwa: sw.js ${version}, ${precache.length} Dateien im Cache`);
    },
  };
}
