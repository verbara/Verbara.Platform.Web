import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  publicDir: false,
  build: {
    target: 'es2020',
    minify: true,
    sourcemap: 'hidden',
    lib: {
      entry: resolve(__dirname, 'src/webchat/sdk/index.ts'),
      name: 'VerbaraWebChat',
      fileName: () => 'verbara-webchat.js',
      formats: ['iife'],
    },
    outDir: resolve(__dirname, 'public/webchat/v1'),
    emptyOutDir: true,
    rollupOptions: {
      output: { extend: true },
    },
  },
  resolve: {
    alias: { '@/webchat': resolve(__dirname, 'src/webchat') },
  },
});
