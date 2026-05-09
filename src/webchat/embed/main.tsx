import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initWebchatI18n } from './i18n-init';
import { initWebchatSentry } from './sentry-init';

initWebchatSentry();

const params = new URLSearchParams(window.location.search);
const locale = params.get('locale') ?? undefined;
const apiBase = '/api/v1';

await initWebchatI18n('/locales', locale);

// Phase D will replace this with the real chat-widget.tsx mount
function Placeholder() {
  return (
    <div style={{ padding: 16 }}>
      <p>Verbara WebChat — initializing…</p>
    </div>
  );
}

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);

// Notify SDK we're ready (handshake)
const targetOrigin = window.location.origin;
window.parent.postMessage({ source: 'verbara-webchat-iframe', type: 'ready' }, targetOrigin);

void apiBase; // unused for now; consumed in Phase D
