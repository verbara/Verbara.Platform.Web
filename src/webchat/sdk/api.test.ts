import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebChatApi } from './api';

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
});
