import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: string) => fallback ?? k,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({
    formatDateTime: (v: string) => `fdt(${v})`,
  }),
}));

// Mutable so each test can pick the permission set before rendering.
const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: <T,>(selector: (s: { permissions: string[] }) => T) => selector(auth),
}));

vi.mock('./use-retention-targets', () => ({
  useRetentionTargets: vi.fn(),
  useRetentionConfig: vi.fn(),
  useRunRetentionNow: vi.fn(),
  useToggleDryRun: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import {
  useRetentionTargets,
  useRetentionConfig,
  useRunRetentionNow,
  useToggleDryRun,
  type RetentionTargetDto,
} from './use-retention-targets';
import RetentionAdminPage from './retention-admin-page';

const mockUseTargets = asMock(useRetentionTargets);
const mockUseConfig = asMock(useRetentionConfig);
const mockUseRun = asMock(useRunRetentionNow);
const mockUseToggle = asMock(useToggleDryRun);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function makeTarget(overrides: Partial<RetentionTargetDto> = {}): RetentionTargetDto {
  return {
    name: 'audit_entries',
    schema: 'public',
    table: 'audit_entries',
    windowDays: 90,
    lastExecutionAt: '2026-08-01T03:00:00Z',
    lastRowsPurged: 1200,
    lastStatus: 'success',
    lastWasDryRun: false,
    ...overrides,
  };
}

const config = {
  dryRun: true,
  defaultWindowDays: 90,
  batchSize: 500,
  cronExpression: '0 3 * * *',
  registeredTargetCount: 1,
};

describe('RetentionAdminPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.permissions = [];
    mockUseTargets.mockReturnValue({ data: [makeTarget()], isLoading: false, error: null });
    mockUseConfig.mockReturnValue({ data: config, isLoading: false });
    mockUseRun.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseToggle.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  // The `canManage` check is the guard this page owns. It moved from the
  // uncatalogued `retention.manage` to `system:retention:manage` (Platform/ADR-0037);
  // these two tests pin both sides of it so a future rename cannot silently
  // re-open or re-close the write controls.
  it('Renders_WriteControls_When_ManagePermissionHeld', () => {
    auth.permissions = ['system:retention:view', 'system:retention:manage'];

    render(<RetentionAdminPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('retention-dryrun-toggle')).toBeDefined();
    expect(screen.getByTestId('retention-run-dryrun')).toBeDefined();
    expect(screen.getByTestId('retention-run-purge')).toBeDefined();
  });

  it('HidesWriteControls_When_OnlyViewPermissionHeld', () => {
    auth.permissions = ['system:retention:view'];

    const { container } = render(<RetentionAdminPage />, { wrapper: makeWrapper() });

    // Read-only: the table is still there, the mutating surfaces are not.
    expect(screen.getByTestId('retention-targets-table')).toBeDefined();
    expect(container.querySelector('[data-testid="retention-dryrun-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="retention-run-dryrun"]')).toBeNull();
    expect(container.querySelector('[data-testid="retention-run-purge"]')).toBeNull();
  });

  it('RendersTargetRow_When_TargetsLoaded', () => {
    render(<RetentionAdminPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('retention-target-audit_entries')).toBeDefined();
    expect(screen.getByTestId('retention-dryrun-banner')).toBeDefined();
  });

  it('RendersEmptyState_When_NoTargetsRegistered', () => {
    mockUseTargets.mockReturnValue({ data: [], isLoading: false, error: null });

    render(<RetentionAdminPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('retention-empty-state')).toBeDefined();
  });

  it('RendersError_When_TargetsFailToLoad', () => {
    mockUseTargets.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });

    render(<RetentionAdminPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('retention-error')).toBeDefined();
  });

  it('RunsDryRun_When_DryRunButtonClicked', () => {
    auth.permissions = ['system:retention:manage'];
    const mutate = vi.fn();
    mockUseRun.mockReturnValue({ mutate, isPending: false });

    render(<RetentionAdminPage />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByTestId('retention-run-dryrun'));

    expect(mutate).toHaveBeenCalledWith({ dryRun: true }, expect.any(Object));
  });

  it('PurgesOnlyAfterConfirmation_When_PurgeRequested', () => {
    auth.permissions = ['system:retention:manage'];
    const mutate = vi.fn();
    mockUseRun.mockReturnValue({ mutate, isPending: false });
    // Purge is disabled while DryRun is on, so this case needs it off.
    mockUseConfig.mockReturnValue({ data: { ...config, dryRun: false }, isLoading: false });

    render(<RetentionAdminPage />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByTestId('retention-run-purge'));

    expect(screen.getByTestId('retention-confirm-purge-dialog')).toBeDefined();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('retention-confirm-purge'));
    expect(mutate).toHaveBeenCalledWith({ dryRun: false }, expect.any(Object));
  });
});
