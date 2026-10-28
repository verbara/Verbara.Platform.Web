vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 80, size: 80 })),
    getTotalSize: () => count * 80,
    scrollToIndex: () => {},
    measureElement: () => {},
  }),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next, { type i18n } from 'i18next';
import enWebchat from '../../../public/locales/en-US/webchat.json';
import esWebchat from '../../../public/locales/es-419/webchat.json';
import ptWebchat from '../../../public/locales/pt-BR/webchat.json';
import { App } from './app';
import { WidgetFrame } from './widget-frame';
import type { InitConfigPayload } from './chat-widget';

// The "Powered by Verbara" line (console-verbara-attribution, design D7). jsdom does no layout, so the
// viewport scenario is asserted here as WidgetFrame's class contract; the end-to-end check measures the boxes.

type Locale = 'en-US' | 'es-419' | 'pt-BR';
const LOCALES: readonly Locale[] = ['en-US', 'es-419', 'pt-BR'];
const HOST = 'https://shop.example.com';

class FakeWebSocket {
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  constructor(readonly url: string) {}
  send() {}
  close() {
    this.readyState = 3;
  }
}

/** No fallback language: a key missing from the active locale renders raw and fails the assertion. */
async function createWebchatI18n(lng: Locale): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    fallbackLng: false,
    resources: {
      'en-US': { webchat: enWebchat },
      'es-419': { webchat: esWebchat },
      'pt-BR': { webchat: ptWebchat },
    },
    ns: ['webchat'],
    defaultNS: 'webchat',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

async function renderApp(lng: Locale = 'en-US') {
  const instance = await createWebchatI18n(lng);
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
}

function postInitConfig(payload: Partial<InitConfigPayload>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: HOST,
        data: {
          source: 'verbara-webchat-host',
          type: 'init-config',
          payload: {
            tenantId: 't1',
            visitorId: 'v1',
            pageContext: { url: `${HOST}/cart`, title: 'Cart', referrer: '' },
            ...payload,
          },
        },
      }),
    );
  });
}

const VISITOR = { name: 'Jane', email: 'jane@example.com' };

const CSAT = {
  responseToken: 'tok',
  surveyId: 's1',
  questionId: 'q1',
  channel: 'webchat',
  queueName: 'support',
  conversationId: 'c1',
};

function poweredBy() {
  return screen.getByTestId('webchat-powered-by');
}

beforeEach(() => {
  window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
  vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  globalThis.WebSocket = FakeWebSocket as never;
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ sessionId: 's1', wsUrl: 'wss://x/ws/y' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as never;
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  document.documentElement.style.removeProperty('--vw-primary');
  document.documentElement.style.removeProperty('--vw-font');
  vi.restoreAllMocks();
});

describe('WidgetFrame — the line stays inside the widget viewport', () => {
  it('WidgetFrame_ShouldKeepTheLineInAShrinkFreeLastFooter_WhenAnyStateRenders', async () => {
    await renderApp();
    const footer = poweredBy().parentElement as HTMLElement;
    const root = footer.parentElement as HTMLElement;
    const content = root.firstElementChild as HTMLElement;

    expect(root).toHaveClass('flex', 'h-full', 'flex-col');
    expect(root.lastElementChild).toBe(footer);
    expect(footer).toHaveClass('shrink-0');
    expect(content).not.toBe(footer);
    expect(content).toHaveClass('flex', 'flex-col', 'flex-1', 'min-h-0', 'overflow-y-auto');
    expect(content).toContainElement(screen.getByTestId('webchat-embed-loading'));
  });

  it('WidgetFrame_ShouldFillTheContentRegion_WhenTheLoadingStateRenders', async () => {
    await renderApp();
    const loading = screen.getByTestId('webchat-embed-loading');
    expect(loading).not.toHaveClass('h-screen');
    expect(loading).toHaveClass('h-full');
  });
});

describe('WidgetFrame — every widget state shows the line', () => {
  it('App_ShouldShowTheLineAndKeepTheLoadingMarker_WhenNoInitConfigHasArrived', async () => {
    await renderApp();
    expect(screen.getByTestId('webchat-embed-loading')).toBeInTheDocument();
    expect(poweredBy()).toHaveTextContent('Powered by Verbara');
  });

  it('App_ShouldShowTheLine_WhenThePreChatFormRenders', async () => {
    await renderApp();
    postInitConfig({});
    expect(screen.queryByTestId('webchat-embed-loading')).toBeNull();
    expect(screen.getByRole('button', { name: enWebchat.preChat.submit })).toBeInTheDocument();
    expect(poweredBy()).toHaveTextContent('Powered by Verbara');
  });

  it('App_ShouldShowTheLine_WhenTheConversationRenders', async () => {
    await renderApp();
    postInitConfig({ visitor: VISITOR });
    expect(screen.getByTestId('webchat-sound-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('webchat-csat-panel')).toBeNull();
    expect(poweredBy()).toHaveTextContent('Powered by Verbara');
  });

  it('App_ShouldShowTheLine_WhenTheSurveyRenders', async () => {
    await renderApp();
    postInitConfig({ visitor: VISITOR, csat: CSAT });
    expect(screen.getByTestId('webchat-csat-panel')).toBeInTheDocument();
    expect(poweredBy()).toHaveTextContent('Powered by Verbara');
  });

  it('App_ShouldKeepTheLineVisible_WhenTheWidgetIsThemed', async () => {
    await renderApp();
    postInitConfig({ theme: { primaryColor: '#ff0000', fontFamily: 'Comic Sans MS' } });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('#ff0000');
    expect(poweredBy()).toBeVisible();
    expect(poweredBy()).toHaveTextContent('Powered by Verbara');
  });
});

describe('WidgetFrame — the line in each locale', () => {
  const FILES: Record<Locale, typeof enWebchat> = {
    'en-US': enWebchat,
    'es-419': esWebchat,
    'pt-BR': ptWebchat,
  };

  it.each(LOCALES)('App_ShouldShowPoweredByVerbara_WhenTheLocaleIs %s', async (lng) => {
    await renderApp(lng);
    expect(FILES[lng].branding.poweredBy).toBe('Powered by Verbara');
    expect(poweredBy()).toHaveTextContent(/^Powered by Verbara$/);
  });
});

describe('WidgetFrame — no locale bundle rewords the line', () => {
  // "No runtime input removes the attribution": the widget loads its bundle over HTTP at runtime, so a
  // missing bundle must not show a raw key and an edited one must not reword the line.
  async function renderFrameWith(webchat: Record<string, unknown>) {
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'en-US',
      fallbackLng: false,
      resources: { 'en-US': { webchat } },
      ns: ['webchat'],
      defaultNS: 'webchat',
      react: { useSuspense: false },
    });
    render(
      <I18nextProvider i18n={instance}>
        <WidgetFrame>
          <div />
        </WidgetFrame>
      </I18nextProvider>,
    );
  }

  it('WidgetFrame_ShouldShowPoweredByVerbara_WhenNoLocaleBundleIsLoaded', async () => {
    await renderFrameWith({});
    expect(poweredBy()).toHaveTextContent(/^Powered by Verbara$/);
  });

  it('WidgetFrame_ShouldShowPoweredByVerbara_WhenTheBundleRewordsTheLine', async () => {
    await renderFrameWith({ branding: { poweredBy: 'Powered by Acme' } });
    expect(poweredBy()).toHaveTextContent(/^Powered by Verbara$/);
  });
});
