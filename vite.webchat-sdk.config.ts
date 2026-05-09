import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      mangle: { properties: { regex: /^_/ } },
    },
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
