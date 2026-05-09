import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initWebchatI18n } from './i18n-init';
import { initWebchatSentry } from './sentry-init';
import { App } from './app';
import { setupTitleFlash, setSoundEnabled } from './notifications';

initWebchatSentry();
setupTitleFlash();

const params = new URLSearchParams(window.location.search);
const locale = params.get('locale') ?? undefined;

await initWebchatI18n('/locales', locale);

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setSoundEnabled(false);
