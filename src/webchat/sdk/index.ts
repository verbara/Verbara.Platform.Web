// SDK entrypoint — exposes VerbaraWebChat global.
import { createWebChatApi } from './api';
import { findSdkScriptSrc } from './embed-origin';

// Read while this script first runs: `document.currentScript` is null afterwards.
const script = document.currentScript as HTMLScriptElement | null;
const api = createWebChatApi({ scriptSrc: findSdkScriptSrc(document, script) });

declare global {
  interface Window {
    VerbaraWebChat: typeof api;
  }
}

globalThis.window.VerbaraWebChat = api;

// Auto-init from data-* attributes if present.
if (script?.dataset['tenantId']) {
  const themeRaw = script.dataset['theme'];
  let theme: { primaryColor?: string; fontFamily?: string } | undefined;
  if (themeRaw) {
    try {
      theme = JSON.parse(themeRaw) as typeof theme;
    } catch {
      // ignore — leave theme undefined
    }
  }
  api.init({
    tenantId: script.dataset['tenantId'],
    apiBase: script.dataset['apiBase'],
    locale: (script.dataset['locale'] ?? 'auto') as 'auto' | 'en-US' | 'es-419' | 'pt-BR',
    position: (script.dataset['position'] ?? 'bottom-right') as 'bottom-right' | 'bottom-left',
    greeting: script.dataset['greeting'],
    theme,
  });
}

export default api;
