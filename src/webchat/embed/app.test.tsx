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
