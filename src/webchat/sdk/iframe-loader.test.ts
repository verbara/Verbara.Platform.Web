import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createIframeLoader, type IframeLoaderHandle } from './iframe-loader';

let handle: IframeLoaderHandle | null = null;

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  handle?.destroy();
  handle = null;
});

describe('iframe-loader', () => {
  it('CreateIframeLoader_DoesNotCreateIframe_BeforeShowCalled', () => {
    handle = createIframeLoader({ src: '/webchat/embed/?tenantId=t1' });
    expect(document.querySelector('iframe[data-verbara-webchat-iframe]')).toBeNull();
  });

  it('Show_CreatesIframeWithCorrectSrcAndSandbox', () => {
    handle = createIframeLoader({ src: '/webchat/embed/?tenantId=t1' });
    handle.show();
    const iframe = document.querySelector(
      'iframe[data-verbara-webchat-iframe]',
    ) as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('/webchat/embed/?tenantId=t1');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-same-origin');
  });

  it('Hide_DoesNotRemoveIframe_OnlyHidesVia(display)', () => {
    handle = createIframeLoader({ src: '/x' });
    handle.show();
    handle.hide();
    const iframe = document.querySelector('iframe[data-verbara-webchat-iframe]') as HTMLElement;
    expect(iframe).toBeTruthy();
    expect(iframe.style.display).toBe('none');
  });

  it('Destroy_RemovesIframe', () => {
    handle = createIframeLoader({ src: '/x' });
    handle.show();
    handle.destroy();
    expect(document.querySelector('iframe[data-verbara-webchat-iframe]')).toBeNull();
    handle = null;
  });
});
