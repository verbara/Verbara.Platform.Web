import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-419' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/core/api/hooks/use-user-sessions', () => ({
  useUserSessions: vi.fn(),
  useRevokeUserSession: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import {
  useUserSessions,
  useRevokeUserSession,
  type UserSessionDto,
} from '@/core/api/hooks/use-user-sessions';
import UserSessionsPage from './user-sessions-page';

const mockSessions = asMock(useUserSessions);
const mockRevoke = asMock(useRevokeUserSession);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function makeSession(overrides: Partial<UserSessionDto> = {}): UserSessionDto {
  return {
    sessionId: 'session-1',
    device: 'Chrome on macOS',
    ipAddress: '192.0.2.1',
    location: null,
    createdAt: '2026-04-25T10:00:00Z',
    lastActivity: '2026-04-25T11:00:00Z',
    isCurrentSession: false,
    ...overrides,
  };
}

describe('UserSessionsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRevoke.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('Page_ShouldRenderEmptyState_WhenNoSessions', () => {
    mockSessions.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-sessions-empty')).toBeInTheDocument();
  });

  it('Page_ShouldRenderTable_WithRowPerSession', () => {
    mockSessions.mockReturnValue({
      data: [
        makeSession({ sessionId: 's1' }),
        makeSession({ sessionId: 's2', device: 'Firefox on Linux' }),
      ],
      isLoading: false,
      isError: false,
    });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-session-row-s1')).toBeInTheDocument();
    expect(screen.getByTestId('user-session-row-s2')).toBeInTheDocument();
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
  });

  it('Page_ShouldShowCurrentBadge_OnCurrentSessionRow', () => {
    mockSessions.mockReturnValue({
      data: [makeSession({ sessionId: 's1', isCurrentSession: true })],
      isLoading: false,
      isError: false,
    });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-session-current-badge')).toBeInTheDocument();
  });

  it('RevokeButton_ShouldBeDisabled_OnCurrentSession', () => {
    mockSessions.mockReturnValue({
      data: [makeSession({ sessionId: 's1', isCurrentSession: true })],
      isLoading: false,
      isError: false,
    });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-session-revoke-s1')).toBeDisabled();
  });

  it('RevokeButton_ShouldOpenConfirmDialog_WhenClicked', async () => {
    mockSessions.mockReturnValue({
      data: [makeSession({ sessionId: 's2', isCurrentSession: false })],
      isLoading: false,
      isError: false,
    });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('user-session-revoke-s2'));

    // ConfirmDeleteDialog renders with role=dialog
    await waitFor(() => {
      expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
    });
  });

  it('Page_ShouldRenderError_WhenLoadFails', () => {
    mockSessions.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<UserSessionsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('user-sessions-error')).toBeInTheDocument();
  });
});
