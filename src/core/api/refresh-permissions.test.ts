import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { refreshAccessToken } from './client';

/**
 * Guards the permission set across a token refresh (design D4 of `agent-assist-works-end-to-end`).
 *
 * An omitted `permissions` field means "the server did not say" and keeps the stored list. An
 * explicit array, the empty one included, is the server's answer and replaces it: Platform applies
 * the role-default fallback on refresh since `v2.23.0` (#213, `EffectivePermissions`), so `[]` no
 * longer stands for an unresolvable lookup, and Platform #597 filters `features:agent-assist:manage`
 * out of the body for any caller outside the Platform tenant. Keeping the stored list on `[]` left
 * such a session holding Features > Agent Assist until sign-out. Login already stores
 * `data.permissions ?? []`, so refresh now agrees with login. What the empty list does to the
 * sidebar and the feature route is in `src/admin/features/agent-assist-gate.test.tsx` (src/core may
 * not import a feature domain, ADR-0014).
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

  it('should_ReplaceStoredPermissions_WhenServerReturnsEmptyArray', async () => {
    server.use(refreshReturning([]));

    await expect(refreshAccessToken()).resolves.toBe(true);

    expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
    // An explicit empty list is the server's answer, as it is at login.
    expect(useAuthStore.getState().permissions).toEqual([]);
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
