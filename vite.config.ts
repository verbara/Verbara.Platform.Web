import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;

const enableSentryUpload = Boolean(sentryAuthToken && sentryOrg && sentryProject);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    enableSentryUpload &&
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        telemetry: false,
        sourcemaps: { assets: ['./dist/**/*.js', './dist/**/*.js.map'] },
      }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: { '/api/v1': 'http://localhost:5000' },
  },
  build: {
    sourcemap: 'hidden',
    // Track 2B — Performance budget. Pull the heaviest dependencies into
    // named long-lived vendor chunks so they cache across page transitions
    // and the per-page bundles only carry domain code.
    // See docs/research/2026-05-03-bundle-baseline.md for the rationale,
    // measured pre/post sizes, and the chunk-size budget acceptance.
    //
    // Bumped from default 500 kB. Only justified offender is vendor-grid
    // (ag-grid-community, ~1.1 MB raw / 306 kB gzip). ag-grid is loaded
    // lazily via React.lazy on the pages that need it (cdr-page,
    // users-page) so it does not hit first paint. Splitting ag-grid
    // further is a consumer-level refactor tracked separately.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
            },
            { name: 'vendor-charts', test: /[\\/]node_modules[\\/]recharts[\\/]/ },
            { name: 'vendor-grid', test: /[\\/]node_modules[\\/]ag-grid/ },
            { name: 'vendor-flow', test: /[\\/]node_modules[\\/]@xyflow[\\/]/ },
            {
              name: 'vendor-i18n',
              test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|i18next-http-backend)[\\/]/,
            },
            { name: 'vendor-tanstack', test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-sentry', test: /[\\/]node_modules[\\/]@sentry[\\/]/ },
            {
              name: 'vendor-form',
              test: /[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
            },
            {
              name: 'vendor-ui',
              test: /[\\/]node_modules[\\/](@base-ui|lucide-react|class-variance-authority|clsx|tailwind-merge|cmdk|sonner|next-themes|tw-animate-css)[\\/]/,
            },
            { name: 'vendor-date', test: /[\\/]node_modules[\\/]date-fns[\\/]/ },
            {
              name: 'vendor-media',
              test: /[\\/]node_modules[\\/](wavesurfer\.js|@wavesurfer)[\\/]/,
            },
            { name: 'vendor-dnd', test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/ },
            { name: 'vendor-realtime', test: /[\\/]node_modules[\\/]@microsoft[\\/]signalr[\\/]/ },
            {
              name: 'vendor-pdf',
              test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable|html2canvas|raf|css-line-break|text-segmentation|fflate|atob)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
