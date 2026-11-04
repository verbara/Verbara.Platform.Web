import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { createLocaleI18n } from '@/test/locale-i18n';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/core/api/hooks/use-auth-admin', () => ({
  useMySessions: vi.fn(),
  useRevokeSession: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import { useMySessions, useRevokeSession, type UserSession } from '@/core/api/hooks/use-auth-admin';
import UserSessionsPage from './user-sessions-page';

/** Host fixture `own-sessions.v1.json` (`GET /api/v1/auth/sessions`): the current row, then a null row. */
const ROWS = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts/own-sessions.v1.json'), 'utf-8'),
  ) as { body: UserSession[] }
).body;
const CURRENT = ROWS[0]!;
const OTHER = ROWS[1]!;

const LOCALE = 'es-419';

const mockSessions = asMock(useMySessions);
const mockRevoke = asMock(useRevokeSession);

let i18n: I18n;

beforeAll(async () => {
  i18n = await createLocaleI18n(LOCALE);
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function showRows(rows: UserSession[]) {
  mockSessions.mockReturnValue({ data: rows, isLoading: false, isError: false });
}

function localeDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

describe('UserSessionsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRevoke.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('Page_ShouldRenderEmptyState_WhenNoSessions', () => {
    showRows([]);

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-sessions-empty')).toBeInTheDocument();
  });

  it('Page_ShouldRenderOneRowPerSession_KeyedByTokenId', () => {
    showRows(ROWS);

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-sessions-table')).toBeInTheDocument();
    expect(screen.getByTestId(`user-session-row-${CURRENT.tokenId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`user-session-row-${OTHER.tokenId}`)).toBeInTheDocument();
  });

  it('Page_ShouldMarkOnlyTheCurrentSession_WhenTheListHasOne', () => {
    showRows(ROWS);

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    const current = screen.getByTestId(`user-session-row-${CURRENT.tokenId}`);
    const other = screen.getByTestId(`user-session-row-${OTHER.tokenId}`);
    expect(screen.getAllByTestId('user-session-current-badge')).toHaveLength(1);
    expect(within(current).getByTestId('user-session-current-badge')).toBeInTheDocument();
    expect(current).toHaveAttribute('data-current', 'true');
    expect(other).toHaveAttribute('data-current', 'false');
    expect(screen.getByTestId(`user-session-revoke-${CURRENT.tokenId}`)).toBeDisabled();
    expect(screen.getByTestId(`user-session-revoke-${OTHER.tokenId}`)).toBeEnabled();
  });

  it('Page_ShouldShowTheDeviceLabelAndIp_WhenTheRowHasThem', () => {
    showRows(ROWS);

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    const cells = within(screen.getByTestId(`user-session-row-${CURRENT.tokenId}`)).getAllByRole(
      'cell',
    );
    expect(cells[0]).toHaveTextContent(
      i18n.t('admin:profile_security.sessions.device_label', { browser: 'Chrome', os: 'Linux' }),
    );
    expect(cells[1]).toHaveTextContent('203.0.113.24');
  });

  it('Page_ShouldShowUnknownDeviceAndADash_WhenUserAgentAndIpAreNull', () => {
    showRows(ROWS);

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    const row = screen.getByTestId(`user-session-row-${OTHER.tokenId}`);
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent(i18n.t('admin:profile_security.sessions.device_unknown'));
    expect(cells[1]?.textContent).toBe('—');
    expect(row.textContent).not.toContain('null');
  });

  it('Page_ShouldShowSignedInAndLastActivityInTheActiveLocale_WhenTheyDiffer', () => {
    showRows(ROWS);

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    const cells = within(screen.getByTestId(`user-session-row-${CURRENT.tokenId}`)).getAllByRole(
      'cell',
    );
    const created = localeDateTime(CURRENT.createdAt);
    const lastActivity = localeDateTime(CURRENT.lastActivityAt);
    expect(created).not.toBe(lastActivity);
    expect(cells[2]?.textContent).toBe(created);
    expect(cells[3]?.textContent).toBe(lastActivity);
  });

  it('Revoke_ShouldCallTheMutationWithTheTokenIdAndCloseTheDialog_WhenConfirmed', async () => {
    showRows(ROWS);
    // The hook resolves on the route's 204; the page closes its dialog from the mutation's onSuccess.
    const mutate = vi.fn((_tokenId: string, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    mockRevoke.mockReturnValue({ mutate, isPending: false });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId(`user-session-revoke-${OTHER.tokenId}`));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(i18n.t('admin:profile_security.sessions.device_unknown'));
    const confirm = screen.getByTestId('confirm-delete-btn');
    // The dialog's own 3 s countdown before the button arms.
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 5_000 });
    fireEvent.click(confirm);

    expect(mutate).toHaveBeenCalledWith(OTHER.tokenId, expect.any(Object));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }, 10_000);

  it('Page_ShouldHideTheTable_WhenARefetchFailsOverCachedRows', () => {
    mockSessions.mockReturnValue({
      data: [{ ...CURRENT, tokenId: 'cached' }],
      isLoading: false,
      isError: true,
    });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-sessions-error')).toBeInTheDocument();
    expect(screen.queryByTestId('user-sessions-table')).not.toBeInTheDocument();
  });

  it('Page_ShouldRenderError_WhenLoadFails', () => {
    mockSessions.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-sessions-error')).toHaveTextContent(
      i18n.t('admin:profile_security.sessions.load_error'),
    );
    expect(screen.queryByTestId('user-sessions-table')).not.toBeInTheDocument();
  });
});
