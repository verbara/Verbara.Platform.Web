/**
 * Renders the app's real router (`src/router.tsx`), because what is under test is the route table:
 * `/profile/security` sits under `AuthGuard` and no `PermissionGuard`, and `/admin/security` keeps
 * its admin guard. The shell's chrome is stubbed; it is not what these routes decide.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/core/auth/auth-store';
import type { PasswordPolicy } from '@/core/api/hooks/use-auth-admin';
import type { Me } from '@/core/api/hooks/use-me';
import { createLocaleI18n } from '@/test/locale-i18n';
import { server } from '@/test/msw-server';

vi.mock('@/core/hooks/use-sse', () => ({ useSSE: vi.fn() }));
vi.mock('@/core/session/session-manager', () => ({ SessionManager: () => null }));
vi.mock('@/core/auth/impersonation-banner', () => ({ ImpersonationBanner: () => null }));
vi.mock('@/core/auth/recovery-codes-banner', () => ({ RecoveryCodesBanner: () => null }));
vi.mock('@/shell/rail', () => ({ Rail: () => null }));
vi.mock('@/shell/command-palette', () => ({ CommandPalette: () => null }));

// The theme store reads `matchMedia` when it is imported, and jsdom does not implement it.
vi.hoisted(() => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
});

/** The Agent role template, `RoleTemplateSeeder.cs`: these four and nothing else. */
const AGENT_PERMISSIONS = [
  'contacts:conversation:handle',
  'contacts:conversation:transfer',
  'contacts:contact:view',
  'reporting:realtime:view',
];

const ME: Me = {
  id: 'u-1',
  email: 'user@example.test',
  displayName: 'Test User',
  role: 'agent',
  status: 'Active',
  mfaEnabled: false,
  mfaConfirmedAt: null,
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: null,
  lastLoginAt: null,
  authProvider: 'local',
  externalId: null,
  oidcSubject: null,
};

const PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
};

/**
 * The first render of a route imports its lazy page, which on a loaded runner outlasts the 1 s
 * default of `findBy*` and `waitFor` (2005 ms, in a full suite run on this tree).
 */
const LAZY_ROUTE = { timeout: 15_000 };

function signIn(role: string, permissions: string[]) {
  useAuthStore
    .getState()
    .setAuth(
      'token',
      Date.now() + 3_600_000,
      { id: ME.id, email: ME.email, displayName: ME.displayName, role },
      'tenant-1',
      permissions,
      {},
    );
}

async function renderAppAt(entry: string) {
  // The app's router is a browser router built once, at import, from `window.location`.
  const { router } = await import('@/router');
  await act(() => router.navigate(entry));
  const i18n = await createLocaleI18n('en-US');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  sessionStorage.clear();
  server.use(
    http.get('/api/v1/users/me', () => HttpResponse.json(ME)),
    http.get('/api/v1/auth/sessions', () => HttpResponse.json([])),
    http.get('/api/v1/auth/password-policy', () => HttpResponse.json(PASSWORD_POLICY)),
    http.post('/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.getState().logout();
});

describe('the /profile/security route', () => {
  // These import the whole app router, every route and module; see reset-password-without-session.test.tsx.
  it('route_ShouldRenderThePage_WhenTheUserHoldsOnlyTheAgentPermissions', async () => {
    signIn('agent', AGENT_PERMISSIONS);

    const router = await renderAppAt('/profile/security');

    expect(await screen.findByTestId('security-page', {}, LAZY_ROUTE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile/security');
  }, 20_000);

  it('route_ShouldRenderThePage_WhenTheUserHoldsNoPermissionAtAll', async () => {
    signIn('api', []);

    const router = await renderAppAt('/profile/security');

    expect(await screen.findByTestId('security-page', {}, LAZY_ROUTE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile/security');
  }, 20_000);

  it('route_ShouldSendToSignIn_WhenThereIsNoSession', async () => {
    const router = await renderAppAt('/profile/security');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), LAZY_ROUTE);
    expect(screen.queryByTestId('security-page')).not.toBeInTheDocument();
  }, 20_000);
});

describe('the /admin/security route', () => {
  it('route_ShouldKeepRenderingThePage_WhenTheUserIsAnAdmin', async () => {
    signIn('admin', ['users:user:view']);

    const router = await renderAppAt('/admin/security');

    expect(await screen.findByTestId('security-page', {}, LAZY_ROUTE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/security');
  }, 20_000);

  it('route_ShouldKeepItsGuard_WhenTheUserHoldsOnlyTheAgentPermissions', async () => {
    signIn('agent', AGENT_PERMISSIONS);

    const router = await renderAppAt('/admin/security');

    await waitFor(() => expect(router.state.location.pathname).toBe('/unauthorized'), LAZY_ROUTE);
    expect(screen.queryByTestId('security-page')).not.toBeInTheDocument();
  }, 20_000);
});
