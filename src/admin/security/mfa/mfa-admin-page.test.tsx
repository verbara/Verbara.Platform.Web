import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('@/core/api/hooks/use-mfa-users', () => ({
  useMfaUsers: vi.fn(),
  useResetMfa: vi.fn(),
  useRevokeMfaSessions: vi.fn(),
}));

import {
  useMfaUsers,
  useResetMfa,
  useRevokeMfaSessions,
  type MfaUserSummary,
} from '@/core/api/hooks/use-mfa-users';
import MfaAdminPage from './mfa-admin-page';

const mockUseList = useMfaUsers as unknown as ReturnType<typeof vi.fn>;
const mockUseReset = useResetMfa as unknown as ReturnType<typeof vi.fn>;
const mockUseRevoke = useRevokeMfaSessions as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function makeUser(overrides: Partial<MfaUserSummary> = {}): MfaUserSummary {
  return {
    userId: 'u-001',
    username: 'alice@example.test',
    tenantId: 'tenant-acme',
    tenantName: 'Acme Corp',
    status: 'enrolled',
    enrolledAt: '2026-04-20T10:00:00Z',
    lastUsedAt: '2026-04-25T08:30:00Z',
    ...overrides,
  };
}

function pagedResult(items: MfaUserSummary[]) {
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

describe('MfaAdminPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseReset.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseRevoke.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('Renders_DataTableColumns_When_UsersExist', () => {
    mockUseList.mockReturnValue(
      pagedResult([
        makeUser(),
        makeUser({ userId: 'u-002', username: 'bob@example.test', status: 'not-enrolled' }),
      ]),
    );

    render(<MfaAdminPage />, { wrapper: makeWrapper() });

    // Page surface + filter panel render.
    expect(screen.getByTestId('mfa-admin-page')).toBeDefined();
    expect(screen.getByTestId('mfa-admin-filters')).toBeDefined();
    // Both seeded users render.
    expect(screen.getByTestId('mfa-admin-user-u-001')).toBeDefined();
    expect(screen.getByTestId('mfa-admin-user-u-002')).toBeDefined();
    // Per-row action buttons are present.
    expect(screen.getByTestId('mfa-admin-reset-u-001')).toBeDefined();
    expect(screen.getByTestId('mfa-admin-revoke-u-001')).toBeDefined();
  });

  it('Triggers_Refetch_When_StatusFilterChanges', () => {
    mockUseList.mockReturnValue(pagedResult([makeUser()]));

    render(<MfaAdminPage />, { wrapper: makeWrapper() });

    const select = screen.getByTestId('mfa-admin-filter-status') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'locked' } });

    // The useMfaUsers hook is invoked again (each render triggers a call) —
    // assert at least one call passed status="locked".
    const callsWithLocked = mockUseList.mock.calls.filter(
      (args) => args[0]?.status === 'locked',
    );
    expect(callsWithLocked.length).toBeGreaterThan(0);
  });

  it('Triggers_Refetch_When_TenantFilterChanges', () => {
    mockUseList.mockReturnValue(pagedResult([makeUser()]));

    render(<MfaAdminPage />, { wrapper: makeWrapper() });

    const input = screen.getByTestId('mfa-admin-filter-tenant') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'tenant-acme' } });

    const callsWithTenant = mockUseList.mock.calls.filter(
      (args) => args[0]?.tenant === 'tenant-acme',
    );
    expect(callsWithTenant.length).toBeGreaterThan(0);
  });

  it('OpensConfirmationDialog_When_ResetClicked', () => {
    mockUseList.mockReturnValue(pagedResult([makeUser()]));
    const mutate = vi.fn();
    mockUseReset.mockReturnValue({ mutate, isPending: false });

    render(<MfaAdminPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('mfa-admin-reset-u-001'));

    // ConfirmDeleteDialog with confirmationWord prompts for "RESET" input.
    const wordInput = screen.getByTestId('confirm-delete-word-input') as HTMLInputElement;
    expect(wordInput).toBeDefined();
    fireEvent.change(wordInput, { target: { value: 'RESET' } });
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    expect(mutate).toHaveBeenCalledWith('u-001', expect.any(Object));
  });

  it('OpensConfirmationDialog_When_RevokeSessionsClicked', () => {
    mockUseList.mockReturnValue(pagedResult([makeUser()]));
    const mutate = vi.fn();
    mockUseRevoke.mockReturnValue({ mutate, isPending: false });

    render(<MfaAdminPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('mfa-admin-revoke-u-001'));

    const wordInput = screen.getByTestId('confirm-delete-word-input') as HTMLInputElement;
    expect(wordInput).toBeDefined();
    fireEvent.change(wordInput, { target: { value: 'REVOKE' } });
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    expect(mutate).toHaveBeenCalledWith('u-001', expect.any(Object));
  });

  it('Renders_EmptyState_When_NoUsersMatchFilters', () => {
    mockUseList.mockReturnValue(pagedResult([]));

    render(<MfaAdminPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('mfa-admin-empty')).toBeDefined();
  });
});

// ─── Permission gate ────────────────────────────────────────────────────────
//
// The PermissionGuard wraps this page in router.tsx with
// `requires="security.mfa.admin"`. We verify the gate rendering separately by
// importing PermissionGuard with a stubbed auth-store — exercising the same
// flow used by /admin/security/mfa/.

vi.mock('@/core/auth/auth-store', () => {
  const stub = {
    permissions: ['users:user:view'], // intentionally NOT containing security.mfa.admin
  };
  return {
    useAuthStore: <T,>(selector: (s: typeof stub) => T) => selector(stub),
  };
});

describe('MfaAdminPage permission gate', () => {
  it('Renders_Nothing_When_PermissionMissing', async () => {
    const { PermissionGuard } = await import('@/core/auth/permission-guard');
    const { container } = render(
      <PermissionGuard requires="security.mfa.admin">
        <div data-testid="mfa-admin-rendered">child</div>
      </PermissionGuard>,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('[data-testid="mfa-admin-rendered"]')).toBeNull();
  });
});
