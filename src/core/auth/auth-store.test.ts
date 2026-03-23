import { useAuthStore } from './auth-store';

describe('AuthStore', () => {
  beforeEach(() => useAuthStore.getState().logout());

  it('should_StoreApiKey_WhenSetAuthCalled', () => {
    useAuthStore.getState().setAuth(
      'key-123',
      { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
      'tenant-1',
      { conversations: true, dialer: false },
    );
    expect(useAuthStore.getState().apiKey).toBe('key-123');
    expect(useAuthStore.getState().tenantId).toBe('tenant-1');
  });

  it('should_ClearState_WhenLogoutCalled', () => {
    useAuthStore.getState().setAuth(
      'key-123',
      { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' },
      'tenant-1',
      {},
    );
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().apiKey).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().features).toEqual({});
  });

  it('should_ReturnTrue_WhenFeatureEnabled', () => {
    useAuthStore.getState().setAuth(
      'key',
      { id: '1', email: '', displayName: 'T', role: 'admin' },
      't1',
      { conversations: true, dialer: false },
    );
    expect(useAuthStore.getState().hasFeature('conversations')).toBe(true);
    expect(useAuthStore.getState().hasFeature('dialer')).toBe(false);
    expect(useAuthStore.getState().hasFeature('unknown')).toBe(false);
  });
});
