import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Mutable fake of the auth store's relevant slice. Each test seeds the fields
 * `doRefresh` reads (`user` + `tenantId` for the `setAuth` guard) and the
 * `isTokenExpired` predicate the lock-acquisition "already fresh" skip checks.
 */
interface FakeAuthState {
  accessToken: string | null;
  tokenExpiry: number | null;
  user: { id: string; email: string } | null;
  tenantId: string | null;
  permissions: string[];
  features: Record<string, boolean>;
  sessionIdleTimeoutMinutes: number | null;
  isTokenExpired: () => boolean;
  setAuth: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}

let fakeAuthState: FakeAuthState;

function makeFreshAuthState(overrides: Partial<FakeAuthState> = {}): FakeAuthState {
  return {
    accessToken: 'old-token',
    tokenExpiry: Date.now() - 1000, // expired by default
    user: { id: 'u1', email: 'test@example.com' },
    tenantId: 'tenant-1',
    permissions: ['users:user:view'],
    features: {},
    sessionIdleTimeoutMinutes: null,
    isTokenExpired: () => true,
    setAuth: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => fakeAuthState),
  },
}));

vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: {
    getState: vi.fn(() => ({ activeTenantId: null })),
  },
}));

/** A minimal stand-in for `navigator.locks` that runs callbacks serially. */
interface FakeLockManager {
  request: ReturnType<typeof vi.fn>;
}

function installFakeLocks(): FakeLockManager {
  let chain: Promise<unknown> = Promise.resolve();
  const request = vi.fn(<T>(_name: string, cb: () => Promise<T>): Promise<T> => {
    // Serialize: each request waits for the previous one to settle, mirroring
    // the exclusivity guarantee of the real Web Locks API.
    const result = chain.then(() => cb());
    chain = result.catch(() => undefined);
    return result;
  });
  const manager: FakeLockManager = { request };
  Object.defineProperty(globalThis.navigator, 'locks', {
    value: manager,
    configurable: true,
  });
  return manager;
}

function removeLocks(): void {
  Object.defineProperty(globalThis.navigator, 'locks', {
    value: undefined,
    configurable: true,
  });
}

/** Build a `Response`-like object good enough for `doRefresh`'s usage. */
function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

const refreshBody = {
  accessToken: 'new-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  permissions: ['users:user:view'],
  sessionIdleTimeoutMinutes: 15,
};

/**
 * Loads `client` + the SAME `session-channel` module instance from the freshly
 * reset module graph, and installs a `post` spy on that instance's prototype.
 * `vi.resetModules()` gives each test a distinct graph, so the spy must target
 * the prototype the just-imported `client` actually references — spying on a
 * top-level static import would miss it.
 */
async function loadClientWithChannelSpy(): Promise<{
  refreshAccessToken: () => Promise<boolean>;
  postSpy: ReturnType<typeof vi.spyOn>;
}> {
  const channelModule = await import('@/core/session/session-channel');
  const postSpy = vi
    .spyOn(channelModule.SessionChannel.prototype, 'post')
    .mockImplementation(() => {});
  const { refreshAccessToken } = await import('./client');
  return { refreshAccessToken, postSpy };
}

describe('refreshAccessToken — cross-tab serialization', () => {
  beforeEach(() => {
    vi.resetModules();
    fakeAuthState = makeFreshAuthState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    removeLocks();
  });

  it('should_IssueSingleFetch_WhenTwoConcurrentCalls', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => jsonResponse(refreshBody));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken } = await loadClientWithChannelSpy();
    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('should_RunInsideLocksRequest_WhenNavigatorLocksAvailable', async () => {
    const locks = installFakeLocks();
    const fetchMock = vi.fn(async () => jsonResponse(refreshBody));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken } = await loadClientWithChannelSpy();
    const result = await refreshAccessToken();

    expect(result).toBe(true);
    expect(locks.request).toHaveBeenCalledTimes(1);
    expect(locks.request).toHaveBeenCalledWith('verbara-refresh', expect.any(Function));

    vi.unstubAllGlobals();
  });

  it('should_SkipFetchAndReturnTrue_WhenAlreadyFreshAtLockAcquisition', async () => {
    installFakeLocks();
    // Token is no longer expired by the time the lock is acquired — another tab
    // refreshed while we waited. The lock body must short-circuit.
    fakeAuthState = makeFreshAuthState({ isTokenExpired: () => false });
    const fetchMock = vi.fn(async () => jsonResponse(refreshBody));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken, postSpy } = await loadClientWithChannelSpy();
    const result = await refreshAccessToken();

    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('should_RefreshViaDoRefresh_WhenNavigatorLocksUndefined', async () => {
    removeLocks();
    const fetchMock = vi.fn(async () => jsonResponse(refreshBody));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken } = await loadClientWithChannelSpy();
    const result = await refreshAccessToken();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('should_ReturnFalse_WhenNavigatorLocksUndefinedAndRefreshNotOk', async () => {
    removeLocks();
    const fetchMock = vi.fn(async () => jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken } = await loadClientWithChannelSpy();
    const result = await refreshAccessToken();

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('should_PostRefreshedMessage_WhenRefreshSucceeds', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => jsonResponse(refreshBody));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken, postSpy } = await loadClientWithChannelSpy();
    await refreshAccessToken();

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('refreshed');

    vi.unstubAllGlobals();
  });

  it('should_NotPostRefreshed_WhenRefreshFails', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken, postSpy } = await loadClientWithChannelSpy();
    const result = await refreshAccessToken();

    expect(result).toBe(false);
    expect(postSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('should_CallSetAuthWithFreshTokenAndIdleTimeout_WhenRefreshSucceeds', async () => {
    installFakeLocks();
    const fetchMock = vi.fn(async () => jsonResponse(refreshBody));
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessToken } = await loadClientWithChannelSpy();
    await refreshAccessToken();

    expect(fakeAuthState.setAuth).toHaveBeenCalledTimes(1);
    const args = fakeAuthState.setAuth.mock.calls[0];
    expect(args?.[0]).toBe('new-token'); // accessToken
    expect(args?.[4]).toEqual(['users:user:view']); // permissions
    expect(args?.[6]).toBe(15); // sessionIdleTimeoutMinutes preserved

    vi.unstubAllGlobals();
  });
});
