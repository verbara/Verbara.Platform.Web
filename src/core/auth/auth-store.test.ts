import { useAuthStore } from './auth-store';

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
});
