export interface IframeLoaderConfig {
  src: string;
  position?: 'bottom-right' | 'bottom-left';
}

export interface IframeLoaderHandle {
  show(): void;
  hide(): void;
  isVisible(): boolean;
  getIframe(): HTMLIFrameElement | null;
  destroy(): void;
}

const Z_INDEX = 2147483646;

export function createIframeLoader(config: IframeLoaderConfig): IframeLoaderHandle {
  let iframe: HTMLIFrameElement | null = null;

  function ensureIframe(): HTMLIFrameElement {
    if (iframe) return iframe;
    iframe = document.createElement('iframe');
    iframe.dataset['verbaraWebchatIframe'] = '';
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-same-origin');
    iframe.title = 'Chat widget';
    iframe.src = config.src;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '88px';
    if ((config.position ?? 'bottom-right') === 'bottom-right') iframe.style.right = '20px';
    else iframe.style.left = '20px';
    iframe.style.width = '380px';
    iframe.style.height = '600px';
    iframe.style.maxHeight = 'calc(100vh - 100px)';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    iframe.style.zIndex = String(Z_INDEX);
    iframe.style.display = 'none';
    iframe.style.colorScheme = 'normal';

    // Mobile breakpoint: full-screen takeover ≤ 600px
    if (typeof globalThis.matchMedia === 'function') {
      const mq = globalThis.matchMedia('(max-width: 600px)');
      const applyMobile = () => {
        if (!iframe) return;
        if (mq.matches) {
          iframe.style.bottom = '0';
          iframe.style.right = '0';
          iframe.style.left = '0';
          iframe.style.top = '0';
          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          iframe.style.maxHeight = '100vh';
          iframe.style.borderRadius = '0';
        }
      };
      applyMobile();
      mq.addEventListener('change', applyMobile);
    }

    document.body.appendChild(iframe);
    return iframe;
  }

  return {
    show() {
      const f = ensureIframe();
      f.style.display = 'block';
    },
    hide() {
      if (iframe) iframe.style.display = 'none';
    },
    isVisible() {
      return iframe?.style.display !== 'none' && iframe !== null;
    },
    getIframe() {
      return iframe;
    },
    destroy() {
      iframe?.remove();
      iframe = null;
    },
  };
}
