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
  for (const api of created.splice(0)) void api.destroy();
  vi.useRealTimers();
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

  it('Destroy_RemovesAllElementsAndListeners', async () => {
    const api = createWebChatApi({ forgetTimeoutMs: 50 });
    api.init({ tenantId: 'tenant-1' });
    api.open();
    const done = api.destroy();
    expect(document.querySelector('[data-verbara-webchat-bubble]')).toBeNull();
    await done;
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

  // destroy() clears the conversation the widget kept in the browser: the frame's storage is on the embed origin,
  // so the SDK asks the frame to clear it and removes the frame only after it answers or the wait runs out.
  describe('destroy() clears the conversation the widget kept', () => {
    const SDK = 'https://console.customer.com/webchat/v1/verbara-webchat.js';
    const EMBED = 'https://console.customer.com';
    const forgetRequest = {
      source: 'verbara-webchat-host',
      type: 'forget-visitor',
      payload: { tenantId: 'tenant-1' },
    };

    function frame(): HTMLIFrameElement | null {
      return document.querySelector('iframe[data-verbara-webchat-iframe]');
    }

    function answer(origin: string, tenantId = 'tenant-1') {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin,
          data: {
            source: 'verbara-webchat-iframe',
            type: 'visitor-forgotten',
            payload: { tenantId },
          },
        }),
      );
    }

    it('Destroy_ShouldAskTheFrameToForget_AndRemoveItOnlyAfterItAnswers', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      const post = vi.spyOn(frame()!.contentWindow!, 'postMessage').mockImplementation(() => {});
      const settled = vi.fn();

      void api.destroy().then(settled);
      await vi.advanceTimersByTimeAsync(0);

      expect(post).toHaveBeenCalledWith(forgetRequest, EMBED);
      expect(frame()).not.toBeNull();
      expect(frame()!.style.display).toBe('none');
      expect(document.querySelector('[data-verbara-webchat-bubble]')).toBeNull();
      expect(settled).not.toHaveBeenCalled();

      answer(EMBED);
      await vi.advanceTimersByTimeAsync(0);

      expect(settled).toHaveBeenCalledTimes(1);
      expect(frame()).toBeNull();
    });

    it('Destroy_ShouldIgnoreAnAnswerFromAnotherOrigin', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(frame()!.contentWindow!, 'postMessage').mockImplementation(() => {});
      const settled = vi.fn();

      void api.destroy().then(settled);
      answer(globalThis.location.origin);
      answer(EMBED, 'tenant-2');
      await vi.advanceTimersByTimeAsync(100);

      expect(settled).not.toHaveBeenCalled();
      expect(frame()).not.toBeNull();
    });

    it('Destroy_ShouldRepeatTheRequest_UntilTheFrameAnswers', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      const post = vi.spyOn(frame()!.contentWindow!, 'postMessage').mockImplementation(() => {});

      void api.destroy();
      await vi.advanceTimersByTimeAsync(350);

      const requests = post.mock.calls.filter(
        ([msg]) => (msg as { type: string }).type === 'forget-visitor',
      );
      expect(requests.length).toBeGreaterThanOrEqual(3);
    });

    it('Destroy_ShouldRemoveTheFrame_WhenItDoesNotAnswerInTime', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(frame()!.contentWindow!, 'postMessage').mockImplementation(() => {});
      const settled = vi.fn();

      void api.destroy().then(settled);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(frame()).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toHaveBeenCalledTimes(1);
      expect(frame()).toBeNull();
    });

    it('Destroy_ShouldLoadTheFrameHidden_WhenTheWidgetWasNeverOpened', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      expect(frame()).toBeNull();

      void api.destroy();

      const loaded = frame();
      expect(loaded).not.toBeNull();
      expect(loaded!.style.display).toBe('none');
      const post = vi.spyOn(loaded!.contentWindow!, 'postMessage').mockImplementation(() => {});
      await vi.advanceTimersByTimeAsync(100);
      expect(post).toHaveBeenCalledWith(forgetRequest, EMBED);

      answer(EMBED);
      await vi.advanceTimersByTimeAsync(0);
      expect(frame()).toBeNull();
    });

    it('Destroy_ShouldForgetTheVisitorOnTheHostPage_AtOnce', () => {
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1', visitor: { name: 'Jane', email: 'jane@x.com' } });
      localStorage.setItem('verbara-webchat-visitor:tenant-1', 'v1');

      void api.destroy();

      expect(localStorage.getItem('verbara-webchat-visitor:tenant-1')).toBeNull();
      expect(localStorage.getItem('verbara-webchat-profile:tenant-1')).toBeNull();
    });

    it('Destroy_ShouldResolveAtOnce_WhenNotInitialized', async () => {
      const api = createWebChatApi({ scriptSrc: SDK });
      await expect(api.destroy()).resolves.toBeUndefined();
    });

    it('Init_ShouldStartAFreshWidget_WhileThePreviousFrameIsStillForgetting', () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(frame()!.contentWindow!, 'postMessage').mockImplementation(() => {});

      api.init({ tenantId: 'tenant-1' });

      expect(document.querySelectorAll('[data-verbara-webchat-bubble]')).toHaveLength(1);
    });
  });
});
