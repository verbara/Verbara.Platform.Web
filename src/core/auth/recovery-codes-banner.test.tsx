/**
 * The recovery-codes banner (design D5, spec `recovery-code-feedback`): shown while
 * `GET /api/v1/users/me` reports `recoveryCodesNeedRegeneration: true`, hidden when it is `false`
 * or absent, while an impersonation is active, and once the user dismisses it. Real `useMe`, real
 * `customFetch`, msw answering with the host fixture values.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import { server } from '@/test/msw-server';
import { createLocaleI18n } from '@/test/locale-i18n';
import { useAuthStore } from './auth-store';
import { RecoveryCodesBanner } from './recovery-codes-banner';

// Verbara.Platform openspec/changes/sign-in-refusals-say-what-happened/fixtures/users-me-recovery-flag.v1.json
// `legacyCodesHeld.status` and the `legacyCodesHeld.body` members the console reads (example data).
const LEGACY_CODES_HELD_STATUS = 200;
const LEGACY_CODES_HELD_BODY = {
  userId: 'u-7f3a',
  tenantId: 'acme',
  email: 'agent@example.com',
  displayName: 'Example Agent',
  role: 'Agent',
  status: 'Active',
  mfaEnabled: true,
  recoveryCodesNeedRegeneration: true,
} as const;
// Same fixture, `upToDate.body` ("Partial body: every other member as in legacyCodesHeld").
const UP_TO_DATE_BODY = { recoveryCodesNeedRegeneration: false } as const;

const { recoveryCodesNeedRegeneration: _flag, ...BODY_WITHOUT_FLAG } = LEGACY_CODES_HELD_BODY;

let meBody: object = LEGACY_CODES_HELD_BODY;
let userSeq = 0;
let en: i18n;

function signIn(): void {
  userSeq += 1;
  useAuthStore.getState().setAuth(
    'access-token',
    Date.now() + 3600_000,
    {
      id: `${LEGACY_CODES_HELD_BODY.userId}-${userSeq}`,
      email: LEGACY_CODES_HELD_BODY.email,
      displayName: LEGACY_CODES_HELD_BODY.displayName,
      role: LEGACY_CODES_HELD_BODY.role,
    },
    LEGACY_CODES_HELD_BODY.tenantId,
    [],
    {},
  );
}

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function renderBanner(client: QueryClient = newClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={en}>
        <MemoryRouter>
          <RecoveryCodesBanner />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  en = await createLocaleI18n('en-US');
});
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  try {
    window.localStorage.clear();
  } catch {
    // jsdom storage is available; nothing to clear otherwise.
  }
  meBody = LEGACY_CODES_HELD_BODY;
  server.use(
    http.get('/api/v1/users/me', () =>
      HttpResponse.json(meBody, { status: LEGACY_CODES_HELD_STATUS }),
    ),
  );
  signIn();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe('RecoveryCodesBanner (design D5)', () => {
  it('RecoveryCodesBanner_ShouldShowThePromptWithItsLink_WhenTheFlagIsTrue', async () => {
    renderBanner();

    const banner = await screen.findByTestId('recovery-codes-banner');
    expect(banner).toHaveTextContent(en.t('recovery_codes_banner.message'));
    const link = screen.getByTestId('recovery-codes-banner-regenerate');
    expect(link).toHaveAttribute('href', '/profile/security/recovery-codes/regenerate');
    expect(link).toHaveTextContent(en.t('recovery_codes_banner.regenerate'));
    expect(screen.getByTestId('recovery-codes-banner-dismiss')).toHaveAccessibleName(
      en.t('recovery_codes_banner.dismiss'),
    );
  });

  it('RecoveryCodesBanner_ShouldStayHidden_WhenTheFlagIsFalse', async () => {
    meBody = { ...LEGACY_CODES_HELD_BODY, ...UP_TO_DATE_BODY };
    const { client } = renderBanner();

    await waitFor(() => expect(client.getQueryState(['me'])?.status).toBe('success'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();
  });

  it('RecoveryCodesBanner_ShouldStayHidden_WhenTheFlagIsAbsent', async () => {
    meBody = BODY_WITHOUT_FLAG;
    const { client } = renderBanner();

    await waitFor(() => expect(client.getQueryState(['me'])?.status).toBe('success'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();
  });

  it('RecoveryCodesBanner_ShouldHideAndStayHiddenAfterARemount_WhenDismissed', async () => {
    const first = renderBanner();
    fireEvent.click(await screen.findByTestId('recovery-codes-banner-dismiss'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();

    first.unmount();
    const { client } = renderBanner();
    await waitFor(() => expect(client.getQueryState(['me'])?.status).toBe('success'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();
  });

  it('RecoveryCodesBanner_ShouldStillHideOnDismissAndRemount_WhenStorageThrows', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const first = renderBanner();
    fireEvent.click(await screen.findByTestId('recovery-codes-banner-dismiss'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();

    first.unmount();
    const { client } = renderBanner();
    await waitFor(() => expect(client.getQueryState(['me'])?.status).toBe('success'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();
  });

  it('RecoveryCodesBanner_ShouldStayHidden_WhileAnImpersonationIsActive', async () => {
    useAuthStore.getState().startImpersonation(
      {
        accessToken: 'impersonation-token',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        targetTenantId: 'tenant-9',
        targetTenantName: 'Example Tenant',
      },
      'access-token',
      LEGACY_CODES_HELD_BODY.tenantId,
    );
    const { client } = renderBanner();

    await waitFor(() => expect(client.getQueryState(['me'])?.status).toBe('success'));
    expect(screen.queryByTestId('recovery-codes-banner')).toBeNull();
  });

  it('RecoveryCodesBanner_ShouldDisappear_WhenMeIsReReadWithTheFlagFalse', async () => {
    const { client } = renderBanner();
    await screen.findByTestId('recovery-codes-banner');

    meBody = { ...LEGACY_CODES_HELD_BODY, ...UP_TO_DATE_BODY };
    await act(() => client.invalidateQueries({ queryKey: ['me'] }));

    await waitFor(() => expect(screen.queryByTestId('recovery-codes-banner')).toBeNull());
  });
});
