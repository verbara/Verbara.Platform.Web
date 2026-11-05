import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(async () => {
  await globalThis.window.VerbaraWebChat?.destroy();
  vi.resetModules();
  Object.defineProperty(document, 'currentScript', { configurable: true, value: null });
  document.body.innerHTML = '';
});

describe('the script tag', () => {
  it('AutoInit_ShouldReadNoToken_FromTheTagsAttributes', async () => {
    const script = document.createElement('script');
    script.src = 'https://console.customer.com/webchat/v1/verbara-webchat.js';
    script.dataset['tenantId'] = 'tenant-1';
    script.dataset['identityToken'] = 'aaa.bbb.ccc';
    script.dataset['token'] = 'aaa.bbb.ccc';
    Object.defineProperty(document, 'currentScript', { configurable: true, value: script });

    await import('./index');
    globalThis.window.VerbaraWebChat.open();
    const frame = document.querySelector<HTMLIFrameElement>('iframe[data-verbara-webchat-iframe]')!;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://console.customer.com',
        source: frame.contentWindow,
        data: { source: 'verbara-webchat-iframe', type: 'ready' },
      }),
    );

    const config = post.mock.calls
      .map(([msg]) => msg as { type: string; payload?: unknown })
      .find((msg) => msg.type === 'init-config');
    expect(config?.payload).toMatchObject({ tenantId: 'tenant-1' });
    expect(JSON.stringify(config?.payload)).not.toContain('aaa.bbb.ccc');
    expect(frame.src).not.toContain('aaa.bbb.ccc');
  });
});
