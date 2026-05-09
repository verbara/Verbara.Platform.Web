import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    minify: 'terser',
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
