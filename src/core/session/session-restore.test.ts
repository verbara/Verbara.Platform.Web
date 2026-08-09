import { useAuthStore } from '@/core/auth/auth-store';
import { restoreSession, resetSessionRestore } from './session-restore';

const refreshAccessToken = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock('@/core/api/client', () => ({ refreshAccessToken }));

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

/** Puts the store in the shape a reload leaves behind: a user, but no credentials. */
function rehydratedWithoutToken(): void {
  useAuthStore.setState({
    user: A_USER,
    tenantId: 'tenant-1',
    permissions: [],
    features: {},
    accessToken: null,
    tokenExpiry: null,
  });
}

describe('restoreSession', () => {
  beforeEach(() => {
    resetSessionRestore();
    refreshAccessToken.mockReset();
    useAuthStore.getState().logout();
  });

  it('should_NotIssueRefresh_WhenNoPersistedSession', async () => {
    await expect(restoreSession()).resolves.toBe(false);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should_MintToken_WhenRehydratedWithoutToken', async () => {
    rehydratedWithoutToken();
    refreshAccessToken.mockResolvedValue(true);

    await expect(restoreSession()).resolves.toBe(true);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should_IssueSingleRefresh_WhenCalledConcurrently', async () => {
    rehydratedWithoutToken();
    let release!: (value: boolean) => void;
    refreshAccessToken.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
    );

    // Several AuthGuard boundaries mounting in the same tick.
    const inFlight = [restoreSession(), restoreSession(), restoreSession()];
    release(true);

    await expect(Promise.all(inFlight)).resolves.toEqual([true, true, true]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should_ReuseVerdict_WhenCalledAfterSettling', async () => {
    rehydratedWithoutToken();
    refreshAccessToken.mockResolvedValue(true);

    await restoreSession();
    await expect(restoreSession()).resolves.toBe(true);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should_ResolveFalseWithoutRetrying_WhenRefreshFails', async () => {
    rehydratedWithoutToken();
    refreshAccessToken.mockResolvedValue(false);

    await expect(restoreSession()).resolves.toBe(false);
    // A failed restore is the verdict for this page load — re-mounting a redirecting guard must not
    // hammer the endpoint.
    await expect(restoreSession()).resolves.toBe(false);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should_InvalidateVerdict_WhenUserSignsInAfterFailedRestore', async () => {
    // The loop this guards against: restore fails, user lands on /login, signs in, then navigates to
    // a guarded route — which must not be judged by the previous session's verdict.
    rehydratedWithoutToken();
    refreshAccessToken.mockResolvedValue(false);
    await expect(restoreSession()).resolves.toBe(false);

    useAuthStore
      .getState()
      .setAuth('fresh-token', Date.now() + 3600_000, { ...A_USER, id: '2' }, 'tenant-1', [], {});

    await expect(restoreSession()).resolves.toBe(true);
  });

  it('should_SkipRefresh_WhenTokenAlreadyUsable', async () => {
    useAuthStore
      .getState()
      .setAuth('live-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});

    await expect(restoreSession()).resolves.toBe(true);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
