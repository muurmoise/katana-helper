import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages serves the site under /katana-helper/.
export default defineConfig({
  base: '/katana-helper/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        probe: resolve(import.meta.dirname, 'probe/index.html'),
      },
    },
  },
});
