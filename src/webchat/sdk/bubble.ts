export interface BubbleConfig {
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;
  onToggle: () => void;
  ariaLabel?: string;
}

export interface BubbleHandle {
  setUnreadCount(n: number): void;
  setOpen(open: boolean): void;
  destroy(): void;
}

const Z_INDEX = 2147483647;

export function createBubble(config: BubbleConfig): BubbleHandle {
  const host = document.createElement('div');
  host.setAttribute('data-verbara-webchat-bubble', '');
  host.style.position = 'fixed';
  host.style.bottom = '20px';
  if (config.position === 'bottom-right') host.style.right = '20px';
  else host.style.left = '20px';
  host.style.zIndex = String(Z_INDEX);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .btn {
        all: unset;
        cursor: pointer;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: ${config.primaryColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        position: relative;
        transition: transform 0.15s;
      }
      .btn:hover { transform: scale(1.05); }
      .btn:focus-visible { outline: 2px solid #0070f3; outline-offset: 2px; }
      .icon { width: 24px; height: 24px; fill: white; }
      .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ef4444;
        color: white;
        font: 600 11px/1 system-ui;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
      }
      @media (prefers-reduced-motion: reduce) {
        .btn, .btn:hover { transition: none; transform: none; }
      }
    </style>
    <button class="btn" aria-label="${config.ariaLabel ?? 'Open chat'}">
      <svg class="icon" viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.5 4.7 3.8 6.2L5 21l3.8-2C9.7 19.7 10.8 20 12 20c5.5 0 10-3.6 10-8s-4.5-9-10-9z"/></svg>
      <span class="badge" data-badge style="display:none"></span>
    </button>
  `;

  const button = shadow.querySelector('button')!;
  const badge = shadow.querySelector('[data-badge]') as HTMLElement;

  button.addEventListener('click', config.onToggle);

  document.body.appendChild(host);

  return {
    setUnreadCount(n: number) {
      if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    },
    setOpen(open: boolean) {
      button.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    },
    destroy() {
      host.remove();
    },
  };
}
