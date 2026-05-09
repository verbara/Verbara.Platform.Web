import { describe, it, expect, vi } from 'vitest';
import { createPostMessageBridge } from './postmessage-bridge';

describe('postmessage-bridge', () => {
  it('PostsToTargetWindow_WithExpectedShape', () => {
    const target = { postMessage: vi.fn() } as unknown as Window;
    const bridge = createPostMessageBridge({
      target: () => target,
      targetOrigin: 'https://example.com',
      expectedSourceOrigin: 'https://example.com',
    });
    bridge.send('open', { foo: 'bar' });
    expect(target.postMessage).toHaveBeenCalledWith(
      { source: 'verbara-webchat-host', type: 'open', payload: { foo: 'bar' } },
      'https://example.com',
    );
  });

  it('OnMessage_FilterByOrigin_AndExpectedSource', () => {
    const handler = vi.fn();
    const bridge = createPostMessageBridge({
      target: () => null,
      targetOrigin: 'https://example.com',
      expectedSourceOrigin: 'https://example.com',
    });
    bridge.on('ready', handler);

    // Wrong origin — should be ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'verbara-webchat-iframe', type: 'ready' },
        origin: 'https://evil.com',
      }),
    );
    expect(handler).not.toHaveBeenCalled();

    // Wrong source tag — should be ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'something-else', type: 'ready' },
        origin: 'https://example.com',
      }),
    );
    expect(handler).not.toHaveBeenCalled();

    // Correct — should fire
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'verbara-webchat-iframe', type: 'ready', payload: { v: 1 } },
        origin: 'https://example.com',
      }),
    );
    expect(handler).toHaveBeenCalledWith({ v: 1 });

    bridge.destroy();
  });

  it('Destroy_RemovesEventListener', () => {
    const handler = vi.fn();
    const bridge = createPostMessageBridge({
      target: () => null,
      targetOrigin: 'https://example.com',
      expectedSourceOrigin: 'https://example.com',
    });
    bridge.on('ready', handler);
    bridge.destroy();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'verbara-webchat-iframe', type: 'ready' },
        origin: 'https://example.com',
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
