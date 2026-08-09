import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { refreshAccessToken } from './client';

/**
 * Guards the permission set across a token refresh.
 *
 * `/auth/refresh` serialises `permissions?.ToArray() ?? []`, so an RBAC lookup it could not resolve
 * arrives as an EMPTY ARRAY, not as an absent field — indistinguishable from "this user genuinely
 * has none". The client must read that as "the server did not tell us" and keep what it has;
 * otherwise every refresh strips the permission set the route guards depend on and the user lands
 * on /unauthorized. Observed live: login returns 57 permissions, refresh returns 0.
 */
const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

function refreshReturning(permissions: string[] | undefined) {
  return http.post('/api/v1/auth/refresh', () =>
    HttpResponse.json({
      accessToken: 'refreshed-token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      ...(permissions === undefined ? {} : { permissions }),
    }),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('refreshAccessToken permission handling', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore
      .getState()
      .setAuth('old-token', Date.now() - 1000, A_USER, 'tenant-1', ['users:user:view'], {});
  });

  it('should_KeepExistingPermissions_WhenServerReturnsEmptyArray', async () => {
    server.use(refreshReturning([]));

    await expect(refreshAccessToken()).resolves.toBe(true);

    expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
    expect(useAuthStore.getState().permissions).toEqual(['users:user:view']);
  });

  it('should_KeepExistingPermissions_WhenServerOmitsTheField', async () => {
    server.use(refreshReturning(undefined));

    await expect(refreshAccessToken()).resolves.toBe(true);

    expect(useAuthStore.getState().permissions).toEqual(['users:user:view']);
  });

  it('should_AdoptServerPermissions_WhenServerReturnsThem', async () => {
    server.use(refreshReturning(['queues:queue:view', 'campaigns:campaign:view']));

    await expect(refreshAccessToken()).resolves.toBe(true);

    // A non-empty set IS authoritative — this is how a genuine permission change propagates.
    expect(useAuthStore.getState().permissions).toEqual([
      'queues:queue:view',
      'campaigns:campaign:view',
    ]);
  });
});
