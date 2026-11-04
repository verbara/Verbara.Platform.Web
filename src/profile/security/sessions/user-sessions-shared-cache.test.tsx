/**
 * Both own-session lists read one source (spec `own-session-console`, audit-carry F2): the real
 * hooks, one `QueryClient`, the page and the `/profile/security` card mounted together. A revoke on
 * the card, answered `204`, must drop the row from the page's list with no navigation.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PasswordPolicy, UserSession } from '@/core/api/hooks/use-auth-admin';
import type { Me } from '@/core/api/hooks/use-me';
import { createLocaleI18n } from '@/test/locale-i18n';
import { server } from '@/test/msw-server';
import SecurityPage from '../security-page';
import UserSessionsPage from './user-sessions-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ROWS = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts/own-sessions.v1.json'), 'utf-8'),
  ) as { body: UserSession[] }
).body;
const CURRENT = ROWS[0]!;
const OTHER = ROWS[1]!;

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

let active: UserSession[] = [];
const requests: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  active = [...ROWS];
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  server.use(
    http.get('/api/v1/users/me', () => HttpResponse.json(ME)),
    http.get('/api/v1/auth/password-policy', () => HttpResponse.json(PASSWORD_POLICY)),
    http.get('/api/v1/auth/sessions', () => HttpResponse.json(active)),
    http.delete('/api/v1/auth/sessions/:tokenId', ({ params }) => {
      active = active.filter((s) => s.tokenId !== params.tokenId);
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
});

describe('own-session lists share one cache entry', () => {
  it('CardRevoke_ShouldDropTheRowFromThePage_WhenTheRouteAnswers204', async () => {
    const i18n = await createLocaleI18n('en-US');
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <SecurityPage />
            <UserSessionsPage />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByTestId(`user-session-row-${OTHER.tokenId}`)).toBeInTheDocument();
    const cardRevoke = await screen.findByTestId(`security-sessions-revoke-${OTHER.tokenId}`);

    fireEvent.click(cardRevoke);

    await waitFor(() =>
      expect(screen.queryByTestId(`user-session-row-${OTHER.tokenId}`)).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId(`user-session-row-${CURRENT.tokenId}`)).toBeInTheDocument();
    expect(requests).toContain(`DELETE /api/v1/auth/sessions/${OTHER.tokenId}`);
    // The page reads the auth route only, never the profile twin (spec: the page loads from the auth route).
    expect(requests.some((r) => r.includes('/api/v1/profile/security/sessions'))).toBe(false);
  }, 15_000);
});
