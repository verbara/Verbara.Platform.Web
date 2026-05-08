import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/core/auth/auth-store', () => {
  const stub = {
    permissions: ['audit.read', 'audit.export', 'platform:tenant:manage'],
  };
  return {
    useAuthStore: <T,>(selector: (s: typeof stub) => T) => selector(stub),
  };
});

vi.mock('./use-audit-events', () => ({
  useAuditEvents: vi.fn(),
}));

vi.mock('./use-audit-export', () => ({
  useAuditExport: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import { useAuditEvents, type AuditEventDto } from './use-audit-events';
import { useAuditExport } from './use-audit-export';
import AuditViewerPage from './audit-viewer-page';

const mockUseEvents = asMock(useAuditEvents);
const mockUseExport = asMock(useAuditExport);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return Wrapper;
}

function makeEvent(overrides: Partial<AuditEventDto> = {}): AuditEventDto {
  return {
    entryId: 'entry-001',
    tenantId: 'tenant-acme',
    action: 'mfa.admin.reset',
    category: 'admin',
    severity: 'warning',
    actorId: 'admin@acme.test',
    actorType: 'user',
    targetId: 'user-42',
    targetType: 'user',
    correlationId: null,
    impersonatorId: null,
    occurredAt: '2026-04-25T08:30:00Z',
    status: 'warning',
    before: { mfaEnabled: true },
    after: { mfaEnabled: false },
    metadata: { ip: '10.0.0.1' },
    ...overrides,
  };
}

function pagedResult(items: AuditEventDto[]) {
  return {
    data: {
      data: {
        items,
        totalCount: items.length,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      retentionDays: 90,
    },
    isFetching: false,
  };
}

describe('AuditViewerPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // jsdom returns 0 for layout; the DataTable virtualizer needs a non-zero
    // viewport to render any rows. Mock here so the existing assertions on
    // [data-testid="audit-row-action-*"] still find the rows.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
    mockUseExport.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('Renders_DataTableColumns_When_EventsExist', () => {
    mockUseEvents.mockReturnValue(
      pagedResult([
        makeEvent(),
        makeEvent({ entryId: 'entry-002', action: 'mfa.admin.sessions_revoked' }),
      ]),
    );

    render(<AuditViewerPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('audit-viewer-page')).toBeDefined();
    expect(screen.getByTestId('audit-viewer-filters')).toBeDefined();
    expect(screen.getByTestId('audit-row-action-entry-001')).toBeDefined();
    expect(screen.getByTestId('audit-row-action-entry-002')).toBeDefined();
    expect(screen.getByTestId('audit-retention-summary')).toBeDefined();
  });

  it('Triggers_Refetch_When_FilterApplied', () => {
    mockUseEvents.mockReturnValue(pagedResult([makeEvent()]));

    render(<AuditViewerPage />, { wrapper: makeWrapper() });

    const input = screen.getByTestId('audit-filter-action-prefix') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mfa.admin.' } });
    fireEvent.click(screen.getByTestId('audit-filter-apply'));

    const callsWithPrefix = mockUseEvents.mock.calls.filter(
      (args) => args[0]?.actionPrefix === 'mfa.admin.',
    );
    expect(callsWithPrefix.length).toBeGreaterThan(0);
  });

  it('OpensDrawer_When_RowClicked', () => {
    mockUseEvents.mockReturnValue(pagedResult([makeEvent()]));

    render(<AuditViewerPage />, { wrapper: makeWrapper() });

    // The DataTable row click is wired through cells. Click the action cell.
    fireEvent.click(screen.getByTestId('audit-row-action-entry-001'));

    expect(screen.getByTestId('audit-drawer-overview')).toBeDefined();
  });

  it('RendersBeforeAfterDiff_When_DrawerOpened', () => {
    mockUseEvents.mockReturnValue(pagedResult([makeEvent()]));

    render(<AuditViewerPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('audit-row-action-entry-001'));
    // Switch to Diff tab.
    fireEvent.click(screen.getByText('admin:security_admin.audit.drawer.tabs.diff'));

    expect(screen.getByTestId('audit-drawer-diff')).toBeDefined();
  });

  it('TriggersDownload_When_ExportClicked', () => {
    mockUseEvents.mockReturnValue(pagedResult([makeEvent()]));
    const mutate = vi.fn();
    mockUseExport.mockReturnValue({ mutate, isPending: false });

    render(<AuditViewerPage />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('audit-export-button'));
    fireEvent.click(screen.getByTestId('audit-export-csv'));

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv' }));
  });
});

// ─── Permission gate ────────────────────────────────────────────────────────
//
// PermissionGuard wraps this page in router.tsx with `requires="audit.read"`.
// Verify a user lacking the permission can't see the rendered content.

vi.mock('@/core/auth/auth-store-no-perm', () => ({}));

describe('AuditViewerPage permission gate', () => {
  it('Renders_Nothing_When_PermissionMissing', async () => {
    vi.doMock('@/core/auth/auth-store', () => {
      const stub = { permissions: ['users:user:view'] };
      return {
        useAuthStore: <T,>(selector: (s: typeof stub) => T) => selector(stub),
      };
    });
    const { PermissionGuard } = await import('@/core/auth/permission-guard');
    const { container } = render(
      <PermissionGuard requires="audit.read">
        <div data-testid="audit-viewer-rendered">child</div>
      </PermissionGuard>,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('[data-testid="audit-viewer-rendered"]')).toBeNull();
  });
});
