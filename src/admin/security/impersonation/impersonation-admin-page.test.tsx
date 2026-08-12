import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object') return `${k}:${JSON.stringify(opts)}`;
      return k;
    },
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({
    formatDate: (v: string) => `fd(${v})`,
    formatRelative: (v: string) => `rel(${v})`,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./use-impersonation-sessions', () => ({
  useActiveImpersonationSessions: vi.fn(),
  useImpersonationSessionHistory: vi.fn(),
  useRevokeImpersonationSession: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import {
  useActiveImpersonationSessions,
  useImpersonationSessionHistory,
  useRevokeImpersonationSession,
  type ImpersonationSessionDto,
} from './use-impersonation-sessions';
import ImpersonationAdminPage from './impersonation-admin-page';

const mockUseActive = asMock(useActiveImpersonationSessions);
const mockUseHistory = asMock(useImpersonationSessionHistory);
const mockUseRevoke = asMock(useRevokeImpersonationSession);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function makeSession(overrides: Partial<ImpersonationSessionDto> = {}): ImpersonationSessionDto {
  return {
    id: 'sess-001',
    actorUserId: 'admin-1',
    actorTenantId: 'tenant-platform',
    targetUserId: null,
    targetTenantId: 'tenant-acme',
    reason: 'support escalation',
    readOnly: false,
    startedAt: '2026-04-25T10:00:00Z',
    endedAt: null,
    status: 'Active',
    closeReason: null,
    timeRemainingSeconds: 600, // 10 minutes
    expiresAt: '2026-04-25T10:10:00Z',
    ...overrides,
  };
}

function pagedResult(items: ImpersonationSessionDto[]) {
  return {
    data: {
      items,
      totalCount: items.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    isLoading: false,
  };
}

describe('ImpersonationAdminPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseRevoke.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseActive.mockReturnValue(pagedResult([makeSession()]));
    mockUseHistory.mockReturnValue(pagedResult([]));
  });

  it('Renders_DataTableColumns_When_ActiveSessionsExist', () => {
    mockUseActive.mockReturnValue(
      pagedResult([
        makeSession(),
        makeSession({ id: 'sess-002', actorUserId: 'admin-2', targetTenantId: 'tenant-bravo' }),
      ]),
    );

    render(<ImpersonationAdminPage />, { wrapper: makeWrapper() });

    // Page surface + tab toggle render.
    expect(screen.getByTestId('impersonation-admin-page')).toBeDefined();
    expect(screen.getByTestId('impersonation-admin-tabs')).toBeDefined();
    // Both seeded sessions render with actor + target + revoke.
    expect(screen.getByTestId('impersonation-actor-sess-001')).toBeDefined();
    expect(screen.getByTestId('impersonation-target-sess-001')).toBeDefined();
    expect(screen.getByTestId('impersonation-actor-sess-002')).toBeDefined();
    expect(screen.getByTestId('impersonation-revoke-sess-001')).toBeDefined();
    expect(screen.getByTestId('impersonation-revoke-sess-002')).toBeDefined();
    // Live countdown cell renders for each row.
    expect(screen.getByTestId('impersonation-countdown-sess-001')).toBeDefined();
  });

  it('Updates_LiveCountdown_When_TimeAdvances', () => {
    vi.useFakeTimers();
    try {
      const start = new Date('2026-04-25T10:00:00Z').getTime();
      vi.setSystemTime(start);
      // 65s window — countdown starts at "minutes_remaining" (>= 60), drops
      // to "seconds_remaining" once the page advances 10s past start.
      mockUseActive.mockReturnValue(
        pagedResult([
          makeSession({
            timeRemainingSeconds: 65,
            expiresAt: '2026-04-25T10:01:05Z',
          }),
        ]),
      );

      render(<ImpersonationAdminPage />, { wrapper: makeWrapper() });

      const initial = screen.getByTestId('impersonation-countdown-sess-001').textContent ?? '';
      expect(initial).toContain('minutes_remaining');

      // Advance ~50s past the snapshot time → countdown should fall under
      // 60s and switch to the seconds_remaining label (~15s remaining of the
      // 65s window). The 5s tick triggers a re-render so the cell reads the
      // new `nowMs`.
      act(() => {
        vi.setSystemTime(start + 45_000);
        vi.advanceTimersByTime(5_000); // page re-renders on 5s tick
      });

      const updated = screen.getByTestId('impersonation-countdown-sess-001').textContent ?? '';
      expect(updated).toContain('seconds_remaining');
    } finally {
      vi.useRealTimers();
    }
  });

  it('OpensRevokeDialog_With_ReasonInput_When_RevokeClicked', () => {
    const mutate = vi.fn();
    mockUseRevoke.mockReturnValue({ mutate, isPending: false });
    mockUseActive.mockReturnValue(pagedResult([makeSession()]));

    render(<ImpersonationAdminPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('impersonation-revoke-sess-001'));

    const reasonInput = screen.getByTestId('impersonation-revoke-reason') as HTMLInputElement;
    expect(reasonInput).toBeDefined();
    fireEvent.change(reasonInput, { target: { value: 'investigation complete' } });
    fireEvent.click(screen.getByTestId('impersonation-revoke-confirm'));

    expect(mutate).toHaveBeenCalledWith(
      { id: 'sess-001', reason: 'investigation complete' },
      expect.any(Object),
    );
  });

  it('TogglesHistoryTab_When_HistoryButtonClicked', () => {
    mockUseHistory.mockReturnValue(
      pagedResult([
        makeSession({
          id: 'closed-1',
          status: 'AutoTimedOut',
          endedAt: '2026-04-25T14:00:00Z',
          closeReason: 'auto_timeout',
          timeRemainingSeconds: null,
          expiresAt: null,
        }),
      ]),
    );

    render(<ImpersonationAdminPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('impersonation-admin-tab-history'));

    // History view renders the auto-timeout outcome badge.
    expect(screen.getByTestId('impersonation-outcome-AutoTimedOut')).toBeDefined();
    // Active section is no longer mounted.
    expect(screen.queryByTestId('impersonation-revoke-closed-1')).toBeNull();
  });
});

// ─── Permission gate ────────────────────────────────────────────────────────
//
// The PermissionGuard wraps this page in router.tsx with
// `requires="system:impersonation:manage"`. Replicate the gate test pattern
// from MFA/Audit so a missing permission renders nothing.

vi.mock('@/core/auth/auth-store', () => {
  const stub = {
    permissions: ['users:user:view'], // intentionally NOT containing system:impersonation:manage
  };
  return {
    useAuthStore: <T,>(selector: (s: typeof stub) => T) => selector(stub),
  };
});

describe('ImpersonationAdminPage permission gate', () => {
  it('Renders_Nothing_When_PermissionMissing', async () => {
    const { PermissionGuard } = await import('@/core/auth/permission-guard');
    const { container } = render(
      <PermissionGuard requires="system:impersonation:manage">
        <div data-testid="impersonation-admin-rendered">child</div>
      </PermissionGuard>,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('[data-testid="impersonation-admin-rendered"]')).toBeNull();
  });
});
