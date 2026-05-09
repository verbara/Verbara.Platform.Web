import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBubble, type BubbleHandle } from './bubble';

let handle: BubbleHandle | null = null;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  handle?.destroy();
  handle = null;
});

describe('bubble', () => {
  it('CreatesShadowRoot_AndButtonElement', () => {
    handle = createBubble({ position: 'bottom-right', primaryColor: '#0d9488', onToggle: vi.fn() });
    const host = document.querySelector('[data-verbara-webchat-bubble]');
    expect(host).toBeTruthy();
    expect((host as HTMLElement).shadowRoot).toBeTruthy();
  });

  it('CallsOnToggle_WhenClicked', () => {
    const onToggle = vi.fn();
    handle = createBubble({ position: 'bottom-right', primaryColor: '#0d9488', onToggle });
    const host = document.querySelector('[data-verbara-webchat-bubble]') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('button')!;
    btn.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('SetsUnreadBadge_WhenSetUnreadCalled', () => {
    handle = createBubble({ position: 'bottom-right', primaryColor: '#0d9488', onToggle: vi.fn() });
    handle.setUnreadCount(3);
    const host = document.querySelector('[data-verbara-webchat-bubble]') as HTMLElement;
    const badge = host.shadowRoot!.querySelector('[data-badge]');
    expect(badge?.textContent).toContain('3');
  });

  it('Destroy_RemovesElement', () => {
    handle = createBubble({ position: 'bottom-right', primaryColor: '#0d9488', onToggle: vi.fn() });
    handle.destroy();
    expect(document.querySelector('[data-verbara-webchat-bubble]')).toBeNull();
    handle = null;
  });

  it('PositionLeft_AppliesLeftCss', () => {
    handle = createBubble({ position: 'bottom-left', primaryColor: '#0d9488', onToggle: vi.fn() });
    const host = document.querySelector('[data-verbara-webchat-bubble]') as HTMLElement;
    expect(host.style.left).toBeTruthy();
    expect(host.style.right).toBe('');
  });
});
