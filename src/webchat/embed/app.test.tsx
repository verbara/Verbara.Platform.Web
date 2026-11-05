import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

// The token lives in this frame's memory: a refresh replaces it and leaves the running widget alone.
describe('App — the identity token', () => {
  const visitor = { name: 'Ana', email: 'ana@x.com' };

  function hostMessage(type: string, payload: unknown) {
    return new MessageEvent('message', {
      origin: HOST,
      data: { source: 'verbara-webchat-host', type, payload },
    });
  }

  function config(extra: Record<string, unknown>) {
    return {
      tenantId: 't1',
      visitorId: 'v1',
      pageContext: { url: `${HOST}/cart`, title: 'Cart', referrer: '' },
      ...extra,
    };
  }

  function mounted() {
    localStorage.clear();
    window.history.replaceState(null, '', `/?tenantId=t1&hostOrigin=${encodeURIComponent(HOST)}`);
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    const sockets: Array<{ url: string; closed: boolean }> = [];
    class Socket {
      readyState = 0;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
      closed = false;
      constructor(readonly url: string) {
        sockets.push(this);
      }
      send() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('WebSocket', Socket);
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({ sessionId: 's1', wsUrl: 'wss://x/ws/s1', identityLevel: 'Verified' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    render(<App />);
    return { post, sockets, bodies };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('App_ShouldPassTheToken_ToTheSessionCreate', async () => {
    const { bodies } = mounted();
    act(() => {
      window.dispatchEvent(hostMessage('init-config', config({ visitor, identityToken: 'T1' })));
    });
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!['identityToken']).toBe('T1');
  });

  it('App_ShouldUseTheTokenSetVisitorBrought_ForTheNextSessionCreate', async () => {
    const { bodies } = mounted();
    act(() => {
      window.dispatchEvent(hostMessage('init-config', config({ identityToken: 'T1' })));
      window.dispatchEvent(hostMessage('set-visitor', { identityToken: 'T2' }));
    });
    fireEvent.change(screen.getByLabelText(/preChat\.name|name/i), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/preChat\.email|email/i), {
      target: { value: 'ana@x.com' },
    });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!['identityToken']).toBe('T2');
  });

  it('App_ShouldKeepTheLiveSocket_AndSendNoSessionCreate_WhenATokenIsRefreshed', async () => {
    const { bodies, sockets } = mounted();
    act(() => {
      window.dispatchEvent(hostMessage('init-config', config({ visitor, identityToken: 'T1' })));
    });
    await waitFor(() => expect(sockets).toHaveLength(1));

    act(() => {
      window.dispatchEvent(hostMessage('set-visitor', { identityToken: 'T2' }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.closed).toBe(false);
    expect(bodies).toHaveLength(1);
  });

  it('App_ShouldSendNoToken_AfterSetVisitorSaysTheCustomerSignedOut', async () => {
    const { bodies } = mounted();
    act(() => {
      window.dispatchEvent(hostMessage('init-config', config({ identityToken: 'T1' })));
      window.dispatchEvent(hostMessage('set-visitor', { identityToken: null }));
    });
    fireEvent.change(screen.getByLabelText(/preChat\.name|name/i), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/preChat\.email|email/i), {
      target: { value: 'ana@x.com' },
    });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('identityToken');
  });

  it('App_ShouldKeepTheToken_WhenSetVisitorOmitsIt', async () => {
    const { bodies } = mounted();
    act(() => {
      window.dispatchEvent(hostMessage('init-config', config({ identityToken: 'T1' })));
      window.dispatchEvent(hostMessage('set-visitor', { name: 'Ana' }));
    });
    fireEvent.change(screen.getByLabelText(/preChat\.name|name/i), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/preChat\.email|email/i), {
      target: { value: 'ana@x.com' },
    });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!['identityToken']).toBe('T1');
  });

  it('App_ShouldReportTheSessionOutcome_ToTheHost_WithoutTheToken', async () => {
    const { bodies, post } = mounted();
    act(() => {
      window.dispatchEvent(hostMessage('init-config', config({ visitor, identityToken: 'T1' })));
    });
    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        {
          source: 'verbara-webchat-iframe',
          type: 'session-identity',
          payload: { identityLevel: 'Verified' },
        },
        HOST,
      ),
    );
  });
});
