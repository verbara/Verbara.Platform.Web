import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { App } from './app';

const HOST = 'https://shop.example.com';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

function initConfig(origin: string) {
  return new MessageEvent('message', {
    origin,
    data: {
      source: 'verbara-webchat-host',
      type: 'init-config',
      payload: {
        tenantId: 't1',
        visitorId: 'v1',
        pageContext: { url: `${HOST}/cart`, title: 'Cart', referrer: '' },
      },
    },
  });
}

describe('App — embedded on a site of another domain (#426)', () => {
  it('App_ShouldAnnounceReadyToThePinnedHostOrigin', () => {
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    render(<App />);
    expect(post).toHaveBeenCalledWith(
      { source: 'verbara-webchat-iframe', type: 'ready', payload: undefined },
      HOST,
    );
  });

  it('App_ShouldTakeConfigOnlyFromThePinnedHostOrigin', () => {
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    render(<App />);

    act(() => {
      window.dispatchEvent(initConfig(window.location.origin));
      window.dispatchEvent(initConfig('https://evil.example'));
    });
    expect(screen.getByTestId('webchat-embed-loading')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(initConfig(HOST));
    });
    expect(screen.queryByTestId('webchat-embed-loading')).toBeNull();
  });
});

// destroy() on the host page clears the conversation the widget kept in this frame's storage: the host cannot reach
// this origin's storage, so it asks over the bridge and waits for the answer.
describe('App — forgetting the visitor when the host page destroys the widget', () => {
  function forget(origin: string, tenantId = 't1') {
    return new MessageEvent('message', {
      origin,
      data: { source: 'verbara-webchat-host', type: 'forget-visitor', payload: { tenantId } },
    });
  }

  function seed() {
    localStorage.clear();
    const session = JSON.stringify({
      sessionId: 's1',
      wsUrl: 'wss://x/ws/s1',
      visitorId: 'v1',
      createdAt: 1,
      lastActiveAt: 1,
    });
    localStorage.setItem('verbara-webchat-messages:t1', '[]');
    localStorage.setItem('verbara-webchat-messages:t1:v1', '[{"id":"m1"}]');
    localStorage.setItem('verbara-webchat-messages:t1:v0', '[{"id":"m0"}]');
    localStorage.setItem('verbara-webchat-session:t1', session);
    localStorage.setItem('verbara-webchat-queue:t1', '[{"id":"q0"}]');
    localStorage.setItem('verbara-webchat-queue:t1:v1', '[{"id":"q1"}]');
    localStorage.setItem('verbara-webchat-queue:t1:v0', '[{"id":"q2"}]');
    localStorage.setItem('verbara-webchat-messages:t2:v9', '[{"id":"other"}]');
    localStorage.setItem('verbara-webchat-session:t2', session);
    localStorage.setItem('verbara-webchat-queue:t2:v9', '[{"id":"q3"}]');
  }

  it('App_ShouldClearTheTenantsConversation_AndAnswer_WhenTheHostAsks', () => {
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    seed();
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    render(<App />);

    act(() => {
      window.dispatchEvent(forget(HOST));
    });

    for (const key of [
      'verbara-webchat-messages:t1',
      'verbara-webchat-messages:t1:v1',
      'verbara-webchat-messages:t1:v0',
      'verbara-webchat-session:t1',
      'verbara-webchat-queue:t1',
      'verbara-webchat-queue:t1:v1',
      'verbara-webchat-queue:t1:v0',
    ]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem('verbara-webchat-messages:t2:v9')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-session:t2')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-queue:t2:v9')).not.toBeNull();
    expect(post).toHaveBeenCalledWith(
      { source: 'verbara-webchat-iframe', type: 'visitor-forgotten', payload: { tenantId: 't1' } },
      HOST,
    );
  });

  it('App_ShouldIgnoreTheRequest_FromAnyOtherOrigin', () => {
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    seed();
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    render(<App />);

    act(() => {
      window.dispatchEvent(forget(window.location.origin));
      window.dispatchEvent(forget('https://evil.example'));
    });

    expect(localStorage.getItem('verbara-webchat-messages:t1:v1')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-session:t1')).not.toBeNull();
    expect(
      post.mock.calls.some(([msg]) => (msg as { type: string }).type === 'visitor-forgotten'),
    ).toBe(false);
  });

  it('App_ShouldCloseTheChat_BeforeClearing', () => {
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    seed();
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    render(<App />);
    act(() => {
      window.dispatchEvent(initConfig(HOST));
    });
    expect(screen.queryByTestId('webchat-embed-loading')).toBeNull();

    act(() => {
      window.dispatchEvent(forget(HOST));
    });

    expect(screen.getByTestId('webchat-embed-loading')).toBeInTheDocument();
    expect(localStorage.getItem('verbara-webchat-messages:t1:v1')).toBeNull();
  });

  it('App_ShouldIgnoreTheRequest_WithoutATenant', () => {
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    seed();
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    render(<App />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST,
          data: { source: 'verbara-webchat-host', type: 'forget-visitor', payload: {} },
        }),
      );
    });

    expect(localStorage.getItem('verbara-webchat-messages:t1:v1')).not.toBeNull();
    expect(
      post.mock.calls.some(([msg]) => (msg as { type: string }).type === 'visitor-forgotten'),
    ).toBe(false);
  });
});
