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
      const source = openedIframe().contentWindow;
      window.dispatchEvent(
        new MessageEvent('message', { data: ready, origin: globalThis.location.origin, source }),
      );
      expect(onReady).not.toHaveBeenCalled();

      window.dispatchEvent(new MessageEvent('message', { data: ready, origin: EMBED, source }));
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
          source: frame()?.contentWindow ?? null,
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

  // A frame still forgetting clears the tenant's storage, which the next frame of the same origin shares: the next
  // widget's frame is created only once the previous one is gone, and each host bridge listens to its own frame only.
  describe('the next widget waits for the previous frame to forget', () => {
    const SDK = 'https://console.customer.com/webchat/v1/verbara-webchat.js';
    const EMBED = 'https://console.customer.com';

    function frames(): HTMLIFrameElement[] {
      return [
        ...document.querySelectorAll<HTMLIFrameElement>('iframe[data-verbara-webchat-iframe]'),
      ];
    }

    function fromFrame(frameEl: HTMLIFrameElement, type: string, payload?: unknown) {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: EMBED,
          source: frameEl.contentWindow,
          data: { source: 'verbara-webchat-iframe', type, payload },
        }),
      );
    }

    it('Open_ShouldNotCreateTheNextFrame_UntilThePreviousFrameHasForgotten', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      const old = frames()[0]!;
      vi.spyOn(old.contentWindow!, 'postMessage').mockImplementation(() => {});

      void api.destroy();
      api.init({ tenantId: 'tenant-1' });
      api.open();
      await vi.advanceTimersByTimeAsync(0);

      expect(frames()).toEqual([old]);

      fromFrame(old, 'visitor-forgotten', { tenantId: 'tenant-1' });
      await vi.advanceTimersByTimeAsync(0);

      const next = frames();
      expect(next).toHaveLength(1);
      expect(next[0]).not.toBe(old);
      expect(next[0]!.style.display).toBe('block');
    });

    it('Init_ShouldDeferTheNextFrame_WhenItReinitializesAnOpenWidget', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK, forgetTimeoutMs: 500 });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(frames()[0]!.contentWindow!, 'postMessage').mockImplementation(() => {});

      api.init({ tenantId: 'tenant-1' });
      api.open();
      await vi.advanceTimersByTimeAsync(499);
      expect(frames()).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(frames()).toHaveLength(1);
      expect(frames()[0]!.style.display).toBe('block');
    });

    it('Open_ShouldNotShowTheNextFrame_WhenClosedBeforeThePreviousFrameIsGone', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK, forgetTimeoutMs: 100 });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(frames()[0]!.contentWindow!, 'postMessage').mockImplementation(() => {});

      void api.destroy();
      api.init({ tenantId: 'tenant-1' });
      api.open();
      api.close();
      await vi.advanceTimersByTimeAsync(100);

      expect(frames()).toHaveLength(0);
    });

    it('Destroy_ShouldWaitForThePreviousFrame_BeforeLoadingItsOwn', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK, forgetTimeoutMs: 100 });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      const old = frames()[0]!;
      vi.spyOn(old.contentWindow!, 'postMessage').mockImplementation(() => {});

      const first = api.destroy();
      api.init({ tenantId: 'tenant-2' });
      const settled = vi.fn();
      void api.destroy().then(settled);
      expect(frames()).toEqual([old]);

      const firstSettled = vi.fn();
      void first.then(firstSettled);
      await vi.advanceTimersByTimeAsync(100);
      expect(firstSettled).toHaveBeenCalledTimes(1);
      const second = frames();
      expect(second).toHaveLength(1);
      expect(second[0]).not.toBe(old);
      expect(new URL(second[0]!.src).searchParams.get('tenantId')).toBe('tenant-2');
      expect(settled).not.toHaveBeenCalled();

      fromFrame(second[0]!, 'visitor-forgotten', { tenantId: 'tenant-2' });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toHaveBeenCalledTimes(1);
      expect(frames()).toHaveLength(0);
    });

    it('Destroy_ShouldResolveAfterThePreviousFrame_WhenNotInitializedAgain', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK, forgetTimeoutMs: 100 });
      api.init({ tenantId: 'tenant-1' });
      api.open();
      vi.spyOn(frames()[0]!.contentWindow!, 'postMessage').mockImplementation(() => {});
      void api.destroy();
      const settled = vi.fn();

      void api.destroy().then(settled);
      await vi.advanceTimersByTimeAsync(99);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toHaveBeenCalledTimes(1);
    });

    it('Bridge_ShouldIgnoreMessagesFromAnotherFrame_OfTheSameOrigin', async () => {
      vi.useFakeTimers();
      const api = createWebChatApi({ scriptSrc: SDK });
      const onReady = vi.fn();
      api.on('ready', onReady);
      api.init({ tenantId: 'tenant-1' });
      api.open();
      const own = frames()[0]!;
      const post = vi.spyOn(own.contentWindow!, 'postMessage').mockImplementation(() => {});
      const stranger = document.createElement('iframe');
      document.body.appendChild(stranger);

      fromFrame(stranger, 'ready');
      expect(onReady).not.toHaveBeenCalled();
      expect(
        post.mock.calls.some(([msg]) => (msg as { type: string }).type === 'init-config'),
      ).toBe(false);

      fromFrame(own, 'ready');
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });
});
