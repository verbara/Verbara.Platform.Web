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
    // Rationale, measured pre/post sizes and the chunk-size budget acceptance
    // are recorded in the 2026-05-03 bundle-baseline research note.
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
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            // Shared by vendor-ui and vendor-i18n, and a dependency of recharts and
            // @xyflow/react. Without a group of its own it sticks to the first heavy
            // group that reaches it, and that chunk enters the first load (ADR-0014).
            {
              name: 'vendor-sync-store',
              test: /[\\/]node_modules[\\/]use-sync-external-store[\\/]/,
            },
            // includeDependenciesRecursively: false on vendor-charts and vendor-pdf keeps
            // them out of the first load: the default also captures what they import,
            // shared code included, and every route then downloads charts and PDF
            // (ADR-0014).
            {
              name: 'vendor-charts',
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              includeDependenciesRecursively: false,
            },
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
            // With the flag off this list must name what jspdf and html2canvas import.
            // One left out lands in a chunk that imports vendor-pdf back, and that cycle
            // throws at module init, on the first PDF export and not on any route load.
            {
              name: 'vendor-pdf',
              test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable|html2canvas|raf|css-line-break|text-segmentation|fflate|atob|fast-png|iobuffer|pako|performance-now|@babel[\\/]runtime)[\\/]/,
              includeDependenciesRecursively: false,
            },
            {
              name: 'vendor-phone',
              test: /[\\/]node_modules[\\/]libphonenumber-js[\\/]/,
            },
          ],
        },
      },
    },
  },
});
