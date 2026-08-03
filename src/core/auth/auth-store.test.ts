import { useAuthStore } from './auth-store';

const PERSIST_KEY = 'verbara-auth';

/** The raw persisted entry, as any script on the origin would read it. */
function readPersistedEntry(): { state?: Record<string, unknown>; version?: number } | null {
  const raw = sessionStorage.getItem(PERSIST_KEY);
  return raw === null ? null : JSON.parse(raw);
}

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

describe('AuthStore', () => {
  beforeEach(() => useAuthStore.getState().logout());

  it('should_StoreAccessToken_WhenSetAuthCalled', () => {
    useAuthStore
      .getState()
      .setAuth(
        'token-123',
        Date.now() + 3600_000,
        { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
        'tenant-1',
        ['users.read', 'users.write'],
        { conversations: true, dialer: false },
      );
    expect(useAuthStore.getState().accessToken).toBe('token-123');
    expect(useAuthStore.getState().tenantId).toBe('tenant-1');
    expect(useAuthStore.getState().permissions).toEqual(['users.read', 'users.write']);
  });

  it('should_ClearState_WhenLogoutCalled', () => {
    useAuthStore
      .getState()
      .setAuth(
        'token-123',
        Date.now() + 3600_000,
        { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
        'tenant-1',
        ['users.read'],
        {},
      );
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().features).toEqual({});
    expect(useAuthStore.getState().permissions).toEqual([]);
    expect(useAuthStore.getState().mfaPending).toBeNull();
  });

  it('should_CheckPermissions_WhenHasPermissionCalled', () => {
    useAuthStore
      .getState()
      .setAuth(
        'token',
        Date.now() + 3600_000,
        { id: '1', email: '', displayName: 'T', role: 'admin' },
        't1',
        ['users.read', 'cdr.read'],
        {},
      );
    expect(useAuthStore.getState().hasPermission('users.read')).toBe(true);
    expect(useAuthStore.getState().hasPermission('users.delete')).toBe(false);
  });

  it('should_ReturnExpired_WhenTokenPastExpiry', () => {
    useAuthStore.getState().setAuth(
      'token',
      Date.now() - 1000, // expired
      { id: '1', email: '', displayName: 'T', role: 'admin' },
      't1',
      [],
      {},
    );
    expect(useAuthStore.getState().isTokenExpired()).toBe(true);
  });

  it('should_ReturnNotExpired_WhenTokenValid', () => {
    useAuthStore.getState().setAuth(
      'token',
      Date.now() + 3600_000, // 1 hour from now
      { id: '1', email: '', displayName: 'T', role: 'admin' },
      't1',
      [],
      {},
    );
    expect(useAuthStore.getState().isTokenExpired()).toBe(false);
  });

  it('should_ManageMfaPending_WhenSetAndCleared', () => {
    useAuthStore.getState().setMfaPending('mfa-token-123', 'user@example.com');
    expect(useAuthStore.getState().mfaPending).toEqual({
      mfaToken: 'mfa-token-123',
      email: 'user@example.com',
    });

    useAuthStore.getState().clearMfaPending();
    expect(useAuthStore.getState().mfaPending).toBeNull();
  });

  it('should_ClearMfaPending_WhenSetAuthCalled', () => {
    useAuthStore.getState().setMfaPending('mfa-token-123', 'user@example.com');
    useAuthStore
      .getState()
      .setAuth(
        'token',
        Date.now() + 3600_000,
        { id: '1', email: 'user@example.com', displayName: 'T', role: 'admin' },
        't1',
        [],
        {},
      );
    expect(useAuthStore.getState().mfaPending).toBeNull();
  });

  it('should_StoreSessionIdleTimeout_WhenSetAuthCalledWithValue', () => {
    useAuthStore
      .getState()
      .setAuth(
        'token',
        Date.now() + 3600_000,
        { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
        'tenant-1',
        ['users.read'],
        {},
        45,
      );
    expect(useAuthStore.getState().sessionIdleTimeoutMinutes).toBe(45);
  });

  it('should_ClearSessionIdleTimeout_WhenLogoutCalled', () => {
    useAuthStore
      .getState()
      .setAuth(
        'token',
        Date.now() + 3600_000,
        { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
        'tenant-1',
        ['users.read'],
        {},
        45,
      );
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().sessionIdleTimeoutMinutes).toBeNull();
  });

  it('should_PreserveSessionIdleTimeout_WhenSetAuthCalledWithoutValue', () => {
    useAuthStore
      .getState()
      .setAuth(
        'token',
        Date.now() + 3600_000,
        { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
        'tenant-1',
        ['users.read'],
        {},
        45,
      );
    // Re-auth (e.g. token refresh) omitting the idle timeout must keep the prior value.
    useAuthStore
      .getState()
      .setAuth(
        'token-refreshed',
        Date.now() + 3600_000,
        { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
        'tenant-1',
        ['users.read'],
        {},
      );
    expect(useAuthStore.getState().sessionIdleTimeoutMinutes).toBe(45);
  });

  describe('persistence', () => {
    it('should_OmitCredentials_WhenSetAuthPersists', () => {
      useAuthStore
        .getState()
        .setAuth('token-123', Date.now() + 3600_000, A_USER, 'tenant-1', ['users.read'], {
          dialer: true,
        });

      const entry = readPersistedEntry();
      expect(entry?.state).toBeDefined();
      // Non-secret session facts survive — the restore path rebuilds from user + tenantId +
      // features, so dropping these would break it.
      expect(entry?.state).toMatchObject({
        user: A_USER,
        tenantId: 'tenant-1',
        permissions: ['users.read'],
        features: { dialer: true },
      });
      // Credentials never reach storage.
      expect(entry?.state).not.toHaveProperty('accessToken');
      expect(entry?.state).not.toHaveProperty('tokenExpiry');
      expect(entry?.state).not.toHaveProperty('mfaPending');
      expect(entry?.state).not.toHaveProperty('impersonation');
      // Belt and braces: the token value must not appear anywhere in the serialised blob.
      expect(sessionStorage.getItem(PERSIST_KEY)).not.toContain('token-123');
    });

    it('should_OmitMfaToken_WhenMfaPendingPersists', () => {
      useAuthStore.getState().setMfaPending('mfa-token-123', 'user@example.com');

      expect(readPersistedEntry()?.state).not.toHaveProperty('mfaPending');
      expect(sessionStorage.getItem(PERSIST_KEY)).not.toContain('mfa-token-123');
    });

    it('should_OmitOriginalToken_WhenImpersonationPersists', () => {
      useAuthStore
        .getState()
        .setAuth('operator-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});
      useAuthStore.getState().startImpersonation(
        {
          accessToken: 'impersonated-token',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          targetTenantId: 'tenant-9',
          targetTenantName: 'ACME',
        },
        'operator-token',
        'tenant-1',
      );

      expect(readPersistedEntry()?.state).not.toHaveProperty('impersonation');
      const raw = sessionStorage.getItem(PERSIST_KEY);
      expect(raw).not.toContain('operator-token');
      expect(raw).not.toContain('impersonated-token');
    });

    it('should_StripSecrets_WhenMigratingLegacyV0Entry', async () => {
      // A v0 entry as the previous build wrote it: the whole state, credentials included.
      sessionStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            accessToken: 'legacy-token',
            tokenExpiry: Date.now() + 3600_000,
            user: A_USER,
            tenantId: 'tenant-1',
            permissions: ['users.read'],
            features: { dialer: true },
            rememberMe: false,
            mfaPending: { mfaToken: 'legacy-mfa', email: 'a@b.com' },
            impersonation: null,
            sessionIdleTimeoutMinutes: 45,
          },
          version: 0,
        }),
      );

      await useAuthStore.persist.rehydrate();

      // In memory: the legacy credential is gone, the session identity survives so the restore
      // path can mint a fresh token from the refresh cookie.
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().tokenExpiry).toBeNull();
      expect(useAuthStore.getState().mfaPending).toBeNull();
      expect(useAuthStore.getState().user).toEqual(A_USER);
      expect(useAuthStore.getState().tenantId).toBe('tenant-1');
      expect(useAuthStore.getState().features).toEqual({ dialer: true });
      expect(useAuthStore.getState().sessionIdleTimeoutMinutes).toBe(45);
      expect(useAuthStore.getState().hasSession()).toBe(true);
    });

    it('should_ReportNoSession_WhenNothingPersisted', () => {
      sessionStorage.clear();
      expect(useAuthStore.getState().hasSession()).toBe(false);
    });
  });

  it('should_RestoreOperatorToken_WhenImpersonationEndedInSameSession', () => {
    useAuthStore
      .getState()
      .setAuth('operator-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});
    useAuthStore.getState().startImpersonation(
      {
        accessToken: 'impersonated-token',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        targetTenantId: 'tenant-9',
        targetTenantName: 'ACME',
      },
      'operator-token',
      'tenant-1',
    );
    expect(useAuthStore.getState().accessToken).toBe('impersonated-token');

    // In-memory `originalToken` is untouched by the persistence change, so ending impersonation
    // inside one page session still works without a network round-trip.
    useAuthStore.getState().endImpersonation();
    expect(useAuthStore.getState().accessToken).toBe('operator-token');
    expect(useAuthStore.getState().tenantId).toBe('tenant-1');
    expect(useAuthStore.getState().impersonation).toBeNull();
  });
});
