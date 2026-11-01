/**
 * Renders the app's real router (`src/router.tsx`), because the bug is a walk through the route table:
 * `/` redirects to `/admin`, whose permission guard sends an Agent back to `/unauthorized`. The role
 * comes from the real auth store and the guards are the real ones. The shell's chrome and the three
 * layouts are stubbed; none of them decides where the user lands, and the real operations layout
 * would only add its `wallboard` redirect.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/core/auth/auth-store';
import { createLocaleI18n } from '@/test/locale-i18n';
import { server } from '@/test/msw-server';

vi.mock('@/core/hooks/use-sse', () => ({ useSSE: vi.fn() }));
vi.mock('@/core/session/session-manager', () => ({ SessionManager: () => null }));
vi.mock('@/core/auth/impersonation-banner', () => ({ ImpersonationBanner: () => null }));
vi.mock('@/core/auth/recovery-codes-banner', () => ({ RecoveryCodesBanner: () => null }));
vi.mock('@/shell/branding-sync', () => ({ BrandingSync: () => null }));
vi.mock('@/shell/rail', () => ({ Rail: () => null }));
vi.mock('@/shell/command-palette', () => ({ CommandPalette: () => null }));
vi.mock('@/pages/admin/admin-layout', () => ({
  default: () => <div data-testid="admin-layout" />,
}));
vi.mock('@/pages/operations/operations-layout', () => ({
  default: () => <div data-testid="operations-layout" />,
}));
vi.mock('@/pages/agent/agent-layout', () => ({
  default: () => <div data-testid="agent-layout" />,
}));

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

/** Opens `/operations` and nothing under `/admin`, so "go home" cannot pass through it by chance. */
const SUPERVISOR_PERMISSIONS = ['contacts:conversation:monitor'];

/** The first render of a route imports its lazy page, which outlasts the 1 s default on a loaded runner. */
const LAZY_ROUTE = { timeout: 15_000 };

/** The route table answers on its own: only a lazy page takes long, and it is awaited apart. */
const SETTLES = { timeout: 3_000 };

/** `LAZY_ROUTE` and `SETTLES` over vitest's 5 s default, so a failure names the location. */
const TEST_BUDGET = 25_000;

function signIn(role: string, permissions: string[]) {
  useAuthStore
    .getState()
    .setAuth(
      'token',
      Date.now() + 3_600_000,
      { id: 'u-1', email: 'user@example.test', displayName: 'Test User', role },
      'tenant-1',
      permissions,
      {},
    );
}

async function goHomeFromUnauthorized() {
  // The app's router is a browser router built once, at import, from `window.location`.
  const { router } = await import('@/router');
  await act(() => router.navigate('/unauthorized'));
  const i18n = await createLocaleI18n('en-US');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByTestId('unauthorized-go-home', {}, LAZY_ROUTE));
  return router;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  sessionStorage.clear();
  server.use(
    http.get('/api/v1/agents/me', () => new HttpResponse(null, { status: 404 })),
    http.get('/api/v1/branding/:tenantId', () => new HttpResponse(null, { status: 404 })),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.getState().logout();
});

describe('the "go home" action of /unauthorized', () => {
  it.each([
    ['agent', AGENT_PERMISSIONS, '/agent', 'agent-layout'],
    ['supervisor', SUPERVISOR_PERMISSIONS, '/operations', 'operations-layout'],
    ['admin', ['users:user:view'], '/admin', 'admin-layout'],
  ])(
    'GoHome_ShouldLandOnTheRoleDefault_WhenTheRoleIs %s',
    async (role, permissions, route, page) => {
      signIn(role, permissions);

      const router = await goHomeFromUnauthorized();

      await waitFor(() => expect(router.state.location.pathname).toBe(route), SETTLES);
      expect(await screen.findByTestId(page, {}, LAZY_ROUTE)).toBeInTheDocument();
    },
    TEST_BUDGET,
  );

  it.each(['api', 'auditor'])(
    'GoHome_ShouldTakeTheFallback_WhenTheRoleIs %s',
    async (role) => {
      signIn(role, AGENT_PERMISSIONS);

      const router = await goHomeFromUnauthorized();

      await waitFor(() => expect(router.state.location.pathname).toBe('/agent'), SETTLES);
      expect(await screen.findByTestId('agent-layout', {}, LAZY_ROUTE)).toBeInTheDocument();
    },
    TEST_BUDGET,
  );

  it(
    'GoHome_ShouldStayOnUnauthorized_WhenTheRoleCannotOpenItsDefault',
    async () => {
      signIn('supervisor', []);

      const router = await goHomeFromUnauthorized();

      expect(await screen.findByTestId('unauthorized-page', {}, LAZY_ROUTE)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/unauthorized');
    },
    TEST_BUDGET,
  );

  it(
    'GoHome_ShouldAskForSignIn_WhenThereIsNoSession',
    async () => {
      const router = await goHomeFromUnauthorized();

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'), SETTLES);
      expect(router.state.location.state).toMatchObject({ from: { pathname: '/agent' } });
    },
    TEST_BUDGET,
  );
});
