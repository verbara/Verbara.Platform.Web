/**
 * Pins the Platform-scope gate of the Agent Assist feature page (design D4): the console has no
 * tenant rule of its own. Platform filters `features:agent-assist:manage` out of the login and
 * refresh bodies for any caller outside the Platform tenant, so the admin sidebar's Features group
 * and the `/admin/features/agent-assist` route must gate on that permission and on nothing else —
 * in particular not on the tenant-scoped `agentassist:config:manage`, which every tenant admin holds.
 *
 * No sidebar test existed; the route half renders the app's real router (`src/router.tsx`), the
 * pattern of `src/profile/security/security-page-route.test.tsx`, because what is under test is the
 * route table. The shell's chrome is stubbed; it is not what these routes decide.
 *
 * The last case is the refresh half of D4 (scenario "An existing session refreshed to an empty
 * list"): `client.ts` now lets an explicit `permissions: []` replace the stored list. Its store-level
 * cases live in `src/core/api/refresh-permissions.test.ts`; the sidebar and route assertions live
 * here because src/core may not import a feature domain (Verbara.Platform.Web/ADR-0014).
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/core/auth/auth-store';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { refreshAccessToken } from '@/core/api/client';
import { AdminSidebar } from '@/admin/sidebar';
import { createLocaleI18n } from '@/test/locale-i18n';
import { server } from '@/test/msw-server';

vi.mock('@/core/hooks/use-sse', () => ({ useSSE: vi.fn() }));
vi.mock('@/core/session/session-manager', () => ({ SessionManager: () => null }));
vi.mock('@/core/auth/impersonation-banner', () => ({ ImpersonationBanner: () => null }));
vi.mock('@/core/auth/recovery-codes-banner', () => ({ RecoveryCodesBanner: () => null }));
vi.mock('@/shell/rail', () => ({ Rail: () => null }));
vi.mock('@/shell/command-palette', () => ({ CommandPalette: () => null }));
vi.mock('@/admin/setup/setup-banner', () => ({ SetupBanner: () => null }));

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

const FEATURE_ROUTE = '/admin/features/agent-assist';

/** The tenant-scoped Agent Assist permission: held by tenant admins, never opens the feature page. */
const TENANT_AGENT_ASSIST = 'agentassist:config:manage';

/** The Platform-scope permission the sidebar group and the route gate on. */
const PLATFORM_AGENT_ASSIST = 'features:agent-assist:manage';

/**
 * The `/admin` layout has its own guard (`requiresAny` of five view permissions), so the route cases
 * carry `users:user:view` to reach the leaf guard; otherwise the parent redirect would answer for it.
 */
const ADMIN_LAYOUT_PERMISSION = 'users:user:view';

/** The first render of a route imports its lazy page; see security-page-route.test.tsx. */
const LAZY_ROUTE = { timeout: 15_000 };

function signIn(permissions: string[]) {
  useAuthStore
    .getState()
    .setAuth(
      'token',
      Date.now() + 3_600_000,
      { id: 'u-1', email: 'admin@example.test', displayName: 'Admin', role: 'admin' },
      'tenant-1',
      permissions,
      {},
    );
}

async function renderSidebarAt(entry: string) {
  const i18n = await createLocaleI18n('en-US');
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[entry]}>
        <AdminSidebar />
      </MemoryRouter>
    </I18nextProvider>,
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
    http.get('/api/v1/admin/features/agent-assist', () =>
      HttpResponse.json({
        enabled: false,
        provider: null,
        credentialsConfigured: false,
        apiKeyMasked: null,
        endpointMasked: null,
        updatedAt: null,
        updatedBy: null,
      }),
    ),
    http.post('/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.getState().logout();
});

describe('the admin sidebar Features group', () => {
  it('sidebar_ShouldShowNoFeaturesSection_WhenTheUserHoldsOnlyTheTenantAgentAssistPermission', async () => {
    signIn([TENANT_AGENT_ASSIST]);

    // Rendered at the feature route, so the group would be open (and its link visible) if it rendered.
    await renderSidebarAt(FEATURE_ROUTE);

    expect(screen.queryByTestId('sidebar-group-features')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-feature-agent-assist')).not.toBeInTheDocument();
  });

  it('sidebar_ShouldShowFeaturesAgentAssist_WhenTheUserHoldsThePlatformPermission', async () => {
    signIn([PLATFORM_AGENT_ASSIST]);

    await renderSidebarAt(FEATURE_ROUTE);

    expect(screen.getByTestId('sidebar-group-features')).toBeInTheDocument();
    const link = screen.getByTestId('sidebar-link-feature-agent-assist');
    expect(link).toHaveAttribute('href', FEATURE_ROUTE);
  });
});

describe('the /admin/features/agent-assist route', () => {
  // These import the whole app router, every route and module; see reset-password-without-session.test.tsx.
  it('route_ShouldRedirect_WhenTheUserHoldsOnlyTheTenantAgentAssistPermission', async () => {
    signIn([ADMIN_LAYOUT_PERMISSION, TENANT_AGENT_ASSIST]);

    const router = await renderAppAt(FEATURE_ROUTE);

    await waitFor(() => expect(router.state.location.pathname).toBe('/unauthorized'), LAZY_ROUTE);
    expect(screen.queryByTestId('agent-assist-feature-page')).not.toBeInTheDocument();
  }, 20_000);

  it('route_ShouldRenderThePage_WhenTheUserHoldsThePlatformPermission', async () => {
    signIn([ADMIN_LAYOUT_PERMISSION, PLATFORM_AGENT_ASSIST]);

    const router = await renderAppAt(FEATURE_ROUTE);

    expect(
      await screen.findByTestId('agent-assist-feature-page', {}, LAZY_ROUTE),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(FEATURE_ROUTE);
    expect(screen.getByTestId('sidebar-link-feature-agent-assist')).toBeInTheDocument();
  }, 20_000);
});

function Pathname() {
  return <span data-testid="pathname">{useLocation().pathname}</span>;
}

/**
 * The admin sidebar beside the feature route under the leaf guard `src/router.tsx` gives it (the
 * cases above pin that entry against the real router). The real router cannot answer this case:
 * a session holding only `features:agent-assist:manage` is already sent away by the `/admin`
 * layout's own guard, before and after the refresh alike. Both read the live auth store, so they
 * re-render when the refresh replaces the stored list.
 */
async function renderSidebarAndFeatureRoute() {
  const i18n = await createLocaleI18n('en-US');
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[FEATURE_ROUTE]}>
        <AdminSidebar />
        <Pathname />
        <Routes>
          <Route
            path={FEATURE_ROUTE}
            element={
              <PermissionGuard requires={PLATFORM_AGENT_ASSIST} redirect>
                <div data-testid="feature-page" />
              </PermissionGuard>
            }
          />
          <Route path="/unauthorized" element={<div data-testid="unauthorized" />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('an existing session refreshed to an empty list (design D4)', () => {
  it('refresh_ShouldDropFeaturesAgentAssist_WhenTheServerReturnsNoPermissions', async () => {
    useAuthStore
      .getState()
      .setAuth(
        'old-token',
        Date.now() - 1000,
        { id: 'u-1', email: 'admin@example.test', displayName: 'Admin', role: 'admin' },
        'tenant-1',
        [PLATFORM_AGENT_ASSIST],
        {},
      );
    await renderSidebarAndFeatureRoute();

    // Before the refresh the session reaches the feature: group, link and route.
    expect(screen.getByTestId('sidebar-group-features')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-feature-agent-assist')).toBeInTheDocument();
    expect(screen.getByTestId('feature-page')).toBeInTheDocument();

    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({
          accessToken: 'refreshed-token',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          permissions: [],
        }),
      ),
    );
    await act(async () => {
      await expect(refreshAccessToken()).resolves.toBe(true);
    });

    expect(useAuthStore.getState().permissions).toEqual([]);
    expect(screen.queryByTestId('sidebar-group-features')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-feature-agent-assist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('feature-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/unauthorized');
  });
});
