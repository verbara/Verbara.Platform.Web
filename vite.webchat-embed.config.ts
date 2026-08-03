import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Without an explicit root, Rollup keeps the entry's source path in the output and the page
  // lands at `public/webchat/embed/src/webchat/embed/index.html`. The widget's public contract —
  // and `nginx.conf`'s `try_files $uri /webchat/embed/index.html` — expects it at the outDir root.
  root: resolve(__dirname, 'src/webchat/embed'),
  // The page is served from /webchat/embed/, so asset URLs must carry that prefix — with only
  // `root` set they would be emitted as `/assets/…` and 404 against the app's own asset folder.
  base: '/webchat/embed/',
  build: {
    target: 'es2020',
    minify: true,
    sourcemap: 'hidden',
    outDir: resolve(__dirname, 'public/webchat/embed'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/webchat/embed/index.html'),
    },
  },
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/webchat': resolve(__dirname, 'src/webchat'),
    },
  },
});
