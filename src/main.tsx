import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { ErrorBoundary } from '@/core/error-boundary';
import { initSentry } from '@/core/observability/sentry';
import { initWebVitals } from '@/core/observability/web-vitals';
import './core/i18n/i18n';
import './index.css';

initSentry();
initWebVitals();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
