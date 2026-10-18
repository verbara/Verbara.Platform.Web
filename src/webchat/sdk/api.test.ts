import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebChatApi as createApi, type WebChatApi, type WebChatApiOptions } from './api';

// Every api a test creates is destroyed after it, so no bridge from an earlier test answers a later test's messages.
const created: WebChatApi[] = [];
function createWebChatApi(options?: WebChatApiOptions): WebChatApi {
  const api = createApi(options);
  created.push(api);
  return api;
}
afterEach(() => {
  for (const api of created.splice(0)) api.destroy();
});

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('WebChatApi', () => {
  it('Init_WithoutTenantId_Throws', () => {
    const api = createWebChatApi();
    // @ts-expect-error — runtime guard test
    expect(() => api.init({})).toThrow(/tenantId/);
  });

  it('Init_RendersBubble', () => {
    const api = createWebChatApi();
    api.init({ tenantId: 'tenant-1' });
    expect(document.querySelector('[data-verbara-webchat-bubble]')).toBeTruthy();
  });

  it('Open_LoadsIframe_AndEmitsOpenEvent', () => {
    const api = createWebChatApi();
    api.init({ tenantId: 'tenant-1' });
    const onOpen = vi.fn();
    api.on('open', onOpen);
    api.open();
    expect(document.querySelector('iframe[data-verbara-webchat-iframe]')).toBeTruthy();
    expect(onOpen).toHaveBeenCalled();
  });

  it('SendMessage_BeforeReady_QueuesUntilReady', () => {
    const api = createWebChatApi();
    api.init({ tenantId: 'tenant-1' });
    api.sendMessage('hello'); // queued — bridge target not yet available
    api.open();
    // No throw; queue flushes when iframe ready
    expect(document.querySelector('iframe[data-verbara-webchat-iframe]')).toBeTruthy();
  });

  it('Destroy_RemovesAllElementsAndListeners', () => {
    const api = createWebChatApi();
    api.init({ tenantId: 'tenant-1' });
    api.open();
    api.destroy();
    expect(document.querySelector('[data-verbara-webchat-bubble]')).toBeNull();
    expect(document.querySelector('iframe[data-verbara-webchat-iframe]')).toBeNull();
  });

  it('On_AndOff_RegisterAndRemoveHandlers', () => {
    const api = createWebChatApi();
    api.init({ tenantId: 'tenant-1' });
    const handler = vi.fn();
    api.on('open', handler);
    api.off('open', handler);
    api.open();
    expect(handler).not.toHaveBeenCalled();
  });

  describe('embedded on a site of another domain (#426)', () => {
    const SDK = 'https://console.customer.com/webchat/v1/verbara-webchat.js';
    const EMBED = 'https://console.customer.com';

    function openedIframe(): HTMLIFrameElement {
      return document.querySelector('iframe[data-verbara-webchat-iframe]') as HTMLIFrameElement;
    }

    it('Init_ShouldLoadTheFrameFromTheScriptsOrigin_WithTheHostOriginParam', () => {
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1', locale: 'pt-BR' });
      api.open();
      const src = new URL(openedIframe().src);
      expect(src.origin).toBe(EMBED);
      expect(src.pathname).toBe('/webchat/embed/');
      expect(src.searchParams.get('tenantId')).toBe('tenant-1');
      expect(src.searchParams.get('locale')).toBe('pt-BR');
      expect(src.searchParams.get('hostOrigin')).toBe(globalThis.location.origin);
    });

    it('Open_ShouldPostToTheEmbedOrigin_NeverToTheHostPage', () => {
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      const frameWindow = openedIframe().contentWindow!;
      const post = vi.spyOn(frameWindow, 'postMessage').mockImplementation(() => {});
      api.close();
      expect(post).toHaveBeenCalledWith(
        { source: 'verbara-webchat-host', type: 'close', payload: undefined },
        EMBED,
      );
      expect(post.mock.calls.every(([, origin]) => origin === EMBED)).toBe(true);
    });

    it('Bridge_ShouldAcceptReadyOnlyFromTheEmbedOrigin', () => {
      const api = createWebChatApi({ scriptSrc: SDK });
      const onReady = vi.fn();
      api.on('ready', onReady);
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(openedIframe().contentWindow!, 'postMessage').mockImplementation(() => {});

      const ready = { source: 'verbara-webchat-iframe', type: 'ready' };
      window.dispatchEvent(
        new MessageEvent('message', { data: ready, origin: globalThis.location.origin }),
      );
      expect(onReady).not.toHaveBeenCalled();

      window.dispatchEvent(new MessageEvent('message', { data: ready, origin: EMBED }));
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });
});
