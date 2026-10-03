import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SessionProbeResult } from './client';

/**
 * `probeSession()` (design D5): a forced `POST /api/v1/auth/refresh` that tells the console whether
 * the session still exists after the server ended a hub connection. It runs against the REAL auth
 * store, loaded from the same freshly reset module graph as `client`, so the impersonation test can
 * assert the store's own fields.
 */

vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: { getState: vi.fn(() => ({ activeTenantId: null })) },
}));

type AuthStoreModule = typeof import('@/core/auth/auth-store');

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;
const HELD_TOKEN = 'held-token';
const FRESH_TOKEN = 'fresh-token';

const refreshBody = {
  accessToken: FRESH_TOKEN,
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  permissions: ['users:user:view'],
  sessionIdleTimeoutMinutes: 20,
};

function response(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

interface FakeLockManager {
  request: ReturnType<typeof vi.fn>;
}

function installFakeLocks(): FakeLockManager {
  let chain: Promise<unknown> = Promise.resolve();
  const request = vi.fn(<T>(_name: string, cb: () => Promise<T>): Promise<T> => {
    const result = chain.then(() => cb());
    chain = result.catch(() => undefined);
    return result;
  });
  Object.defineProperty(globalThis.navigator, 'locks', { value: { request }, configurable: true });
  return { request };
}

function removeLocks(): void {
  Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
}

interface Loaded {
  probeSession: () => Promise<SessionProbeResult>;
  refreshAccessToken: () => Promise<boolean>;
  useAuthStore: AuthStoreModule['useAuthStore'];
  postSpy: ReturnType<typeof vi.spyOn>;
}

/** Loads `client`, the auth store and the channel spy from ONE freshly reset module graph. */
async function load(): Promise<Loaded> {
  const channelModule = await import('@/core/session/session-channel');
  const postSpy = vi
    .spyOn(channelModule.SessionChannel.prototype, 'post')
    .mockImplementation(() => {});
  const { useAuthStore } = await import('@/core/auth/auth-store');
  const { probeSession, refreshAccessToken } = await import('./client');
  return { probeSession, refreshAccessToken, useAuthStore, postSpy };
}

/** Signs a user in with a token that is still valid for 10 minutes. */
function signIn(useAuthStore: Loaded['useAuthStore']): void {
  useAuthStore
    .getState()
    .setAuth(HELD_TOKEN, Date.now() + 10 * 60_000, A_USER, 'tenant-1', ['old:perm'], {}, 15);
}

describe('probeSession', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    removeLocks();
  });

  it('probeSession_ShouldReturnActiveAndApplyTheToken_When200', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => response(200, refreshBody));
    vi.stubGlobal('fetch', fetchMock);
    const { probeSession, useAuthStore, postSpy } = await load();
    signIn(useAuthStore);

    await expect(probeSession()).resolves.toBe('active');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(FRESH_TOKEN);
    expect(state.tokenExpiry).toBe(new Date(refreshBody.expiresAt).getTime());
    expect(state.user).toEqual(A_USER);
    expect(state.tenantId).toBe('tenant-1');
    expect(state.permissions).toEqual(['users:user:view']);
    expect(state.sessionIdleTimeoutMinutes).toBe(20);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('refreshed');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('probeSession_ShouldHitTheNetwork_WhenTheHeldTokenIsStillValid', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => response(200, refreshBody));
    vi.stubGlobal('fetch', fetchMock);
    const { probeSession, refreshAccessToken, useAuthStore } = await load();
    signIn(useAuthStore);
    expect(useAuthStore.getState().isTokenExpired()).toBe(false);

    // The ordinary refresh short-circuits on a valid token; the probe must not.
    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(probeSession()).resolves.toBe('active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('probeSession_ShouldReturnEndedAndApplyNothing_When %i', async (status) => {
    installFakeLocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(status, { error: 'Account is not active.' })),
    );
    const { probeSession, useAuthStore, postSpy } = await load();
    signIn(useAuthStore);

    await expect(probeSession()).resolves.toBe('ended');

    expect(useAuthStore.getState().accessToken).toBe(HELD_TOKEN);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it.each([500, 502, 503])('probeSession_ShouldReturnUnknown_When %i', async (status) => {
    installFakeLocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(status)),
    );
    const { probeSession, useAuthStore, postSpy } = await load();
    signIn(useAuthStore);

    await expect(probeSession()).resolves.toBe('unknown');

    expect(useAuthStore.getState().accessToken).toBe(HELD_TOKEN);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('probeSession_ShouldReturnUnknown_WhenTheNetworkFails', async () => {
    installFakeLocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const { probeSession, useAuthStore, postSpy } = await load();
    signIn(useAuthStore);

    await expect(probeSession()).resolves.toBe('unknown');

    expect(useAuthStore.getState().accessToken).toBe(HELD_TOKEN);
    expect(useAuthStore.getState().user).toEqual(A_USER);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('probeSession_ShouldReturnUnknown_WhenA200BodyIsUnreadable', async () => {
    installFakeLocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError('Unexpected end of JSON input');
            },
          }) as unknown as Response,
      ),
    );
    const { probeSession, useAuthStore } = await load();
    signIn(useAuthStore);

    await expect(probeSession()).resolves.toBe('unknown');
    expect(useAuthStore.getState().accessToken).toBe(HELD_TOKEN);
  });

  it('probeSession_ShouldKeepTheImpersonation_When200DuringAnImpersonation', async () => {
    installFakeLocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(200, refreshBody)),
    );
    const { probeSession, useAuthStore, postSpy } = await load();
    signIn(useAuthStore);
    useAuthStore.getState().startImpersonation(
      {
        accessToken: 'impersonation-token',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        targetTenantId: 'tenant-target',
        targetTenantName: 'Target',
        readOnly: true,
      },
      HELD_TOKEN,
      'tenant-1',
    );
    const before = useAuthStore.getState();
    const impersonationBefore = before.impersonation;

    await expect(probeSession()).resolves.toBe('active');

    const after = useAuthStore.getState();
    expect(after.accessToken).toBe('impersonation-token');
    expect(after.tenantId).toBe('tenant-target');
    expect(after.impersonation).toEqual(impersonationBefore);
    expect(after.impersonation?.active).toBe(true);
    expect(after.tokenExpiry).toBe(before.tokenExpiry);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('probeSession_ShouldRunInsideTheRefreshLock_WhenWebLocksExist', async () => {
    const locks = installFakeLocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(200, refreshBody)),
    );
    const { probeSession, useAuthStore } = await load();
    signIn(useAuthStore);

    await probeSession();

    expect(locks.request).toHaveBeenCalledTimes(1);
    expect(locks.request).toHaveBeenCalledWith('verbara-refresh', expect.any(Function));
  });

  it('probeSession_ShouldStillProbe_WhenWebLocksAreMissing', async () => {
    removeLocks();
    const fetchMock = vi.fn(async () => response(401));
    vi.stubGlobal('fetch', fetchMock);
    const { probeSession, useAuthStore } = await load();
    signIn(useAuthStore);

    await expect(probeSession()).resolves.toBe('ended');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('probeSession_ShouldShareOneRequest_WhenCalledConcurrentlyInOneTab', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => response(200, refreshBody));
    vi.stubGlobal('fetch', fetchMock);
    const { probeSession, useAuthStore } = await load();
    signIn(useAuthStore);

    const results = await Promise.all([probeSession(), probeSession()]);

    expect(results).toEqual(['active', 'active']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('probeSession_ShouldWaitForAnInFlightRefresh_WhenWebLocksAreMissing', async () => {
    removeLocks();
    let releaseRefresh: (value: Response) => void = () => undefined;
    const calls: string[] = [];
    const fetchMock = vi.fn((): Promise<Response> => {
      calls.push(`fetch-${calls.length + 1}`);
      if (calls.length === 1) {
        return new Promise<Response>((resolve) => {
          releaseRefresh = resolve;
        });
      }
      return Promise.resolve(response(200, refreshBody));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { probeSession, refreshAccessToken, useAuthStore } = await load();
    signIn(useAuthStore);
    // An expired token makes the ordinary refresh go to the network.
    useAuthStore.setState({ tokenExpiry: Date.now() - 1000 });

    const refreshing = refreshAccessToken();
    const probing = probeSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseRefresh(response(200, refreshBody));
    await expect(refreshing).resolves.toBe(true);
    await expect(probing).resolves.toBe('active');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
