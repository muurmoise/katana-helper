import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { pwa } from './build/pwa-plugin.js';

// GitHub Pages serves the site under /katana-helper/. Other hosts (e.g. Cloudflare Pages at
// the domain root) set BASE_PATH=/ when building.
const base = process.env.BASE_PATH ?? '/katana-helper/';

// Version shown in the app and used to name the service worker cache:
// package version + commit, e.g. "0.5.0+d24dc27". APP_VERSION overrides it (tests).
function appVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));
  // GitHub Actions and Cloudflare Pages name the commit; locally ask git.
  let commit = (process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA)?.slice(0, 7);
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      commit = 'local';
    }
  }
  return `${pkg.version}+${commit}`;
}

const version = appVersion();

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [pwa({ version })],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        probe: resolve(import.meta.dirname, 'probe/index.html'),
      },
    },
  },
});
