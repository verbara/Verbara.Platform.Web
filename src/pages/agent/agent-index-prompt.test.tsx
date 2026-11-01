/**
 * Renders the app's real router (`src/router.tsx`): the prompt is what the `/agent` index route draws,
 * so the route table is part of what this proves. The agent layout is stubbed down to its outlet,
 * and the shell's chrome to nothing, as in `src/pages/unauthorized.test.tsx`.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { Outlet, RouterProvider } from 'react-router';
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
vi.mock('@/pages/agent/agent-layout', () => ({ default: () => <Outlet /> }));

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

/** The first render of the layout imports a lazy route, which outlasts the 1 s default on a loaded runner. */
const LAZY_ROUTE = { timeout: 15_000 };

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  server.use(
    http.get('/api/v1/agents/me', () => new HttpResponse(null, { status: 404 })),
    http.get('/api/v1/branding/:tenantId', () => new HttpResponse(null, { status: 404 })),
  );
  useAuthStore
    .getState()
    .setAuth(
      'token',
      Date.now() + 3_600_000,
      { id: 'u-1', email: 'agent@example.test', displayName: 'Ana Agent', role: 'agent' },
      'tenant-1',
      ['contacts:conversation:handle'],
      {},
    );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.getState().logout();
});

describe('the /agent index route', () => {
  it('ShouldPromptInEs419_WhenNoConversationIsSelected', { timeout: 20_000 }, async () => {
    // The app's router is a browser router built once, at import, from `window.location`.
    const { router } = await import('@/router');
    await act(() => router.navigate('/agent'));
    const i18n = await createLocaleI18n('es-419');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText('Selecciona una conversación', {}, LAZY_ROUTE),
    ).toBeInTheDocument();
  });
});
