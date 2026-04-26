import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// i18n is mocked to return raw keys so assertions can target key literals
// without depending on the loaded JSON bundle.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object') {
        return `${k}:${JSON.stringify(opts)}`;
      }
      return k;
    },
  }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({
    formatDate: (v: string) => `formatted(${v})`,
    formatRelative: (v: string) => `relative(${v})`,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/core/api/hooks/use-system', () => ({
  useSystemLicense: vi.fn(),
  useUpdateLicense: vi.fn(),
}));

import {
  useSystemLicense,
  useUpdateLicense,
  type LicenseInfo,
} from '@/core/api/hooks/use-system';
import LicensePage from './license-page';

const mockUseLicense = useSystemLicense as unknown as ReturnType<typeof vi.fn>;
const mockUseUpdate = useUpdateLicense as unknown as ReturnType<typeof vi.fn>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function baseLicense(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
  return {
    isValid: true,
    licenseId: 'LIC-0000-1234-5678-ABCD',
    licensee: 'Acme Corp',
    status: 'Valid',
    expiresAt: '2099-12-31T00:00:00Z',
    licensedFeatures: ['Dialer', 'Analytics', 'AgentAssist'],
    maxNodes: 4,
    lastValidatedAt: '2026-04-22T10:00:00Z',
    // PC.4 grace-state defaults — happy-path Valid license with no grace
    // window active and no blocked features. Tests override these.
    inGrace: false,
    gracePeriodRemaining: null,
    blocked: false,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LicensePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseUpdate.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('renders_loading_state_when_license_is_pending', () => {
    mockUseLicense.mockReturnValue({ data: undefined, isLoading: true });

    render(<LicensePage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('license-page')).toBeDefined();
    expect(screen.getByText('admin:license.loading')).toBeDefined();
  });

  it('renders_summary_and_feature_matrix_when_license_loaded', () => {
    mockUseLicense.mockReturnValue({
      data: baseLicense(),
      isLoading: false,
    });

    render(<LicensePage />, { wrapper: makeWrapper() });

    // Summary card with StatCard for each metric.
    expect(screen.getByTestId('license-summary')).toBeDefined();

    // License ID mask surface and CopyButton.
    expect(screen.getByTestId('license-id-masked')).toBeDefined();

    // Feature matrix renders one row per licensed feature, lowercased testid.
    expect(screen.getByTestId('license-feature-matrix')).toBeDefined();
    expect(screen.getByTestId('feature-row-dialer')).toBeDefined();
    expect(screen.getByTestId('feature-row-analytics')).toBeDefined();
    expect(screen.getByTestId('feature-row-agentassist')).toBeDefined();
  });

  it('renders_expiration_warning_banner_when_license_expiring_soon', () => {
    // Pick a date ~10 days from now so differenceInDays returns something
    // in the (0, 30] window that triggers the soon banner.
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    mockUseLicense.mockReturnValue({
      data: baseLicense({ expiresAt: soon.toISOString() }),
      isLoading: false,
    });

    render(<LicensePage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('license-warning-banner')).toBeDefined();
  });

  // ─── PC.4 / triage limitation #11 — grace-state surface ────────────────────
  // Three tests covering the new DTO fields wired through the StatCard slot
  // and the dedicated blocked banner. Mirrors the backend's
  // ComputeGraceState contract: inGrace ⇒ grace card visible with parsed
  // remaining duration; blocked ⇒ banner visible.

  it('Renders_GraceBadge_When_InGrace', () => {
    mockUseLicense.mockReturnValue({
      data: baseLicense({
        status: 'GracePeriod',
        inGrace: true,
        gracePeriodRemaining: '5.00:00:00',
      }),
      isLoading: false,
    });

    render(<LicensePage />, { wrapper: makeWrapper() });

    // The grace card is rendered (replaces the max-nodes card while in grace)
    expect(screen.getByTestId('license-grace-card')).toBeDefined();
    // Tier StatusBadge resolves to the canonical 'grace' license variant.
    // status-badge variant="license" + status="grace" renders the i18n key
    // `status.license.grace` from the badge's namespace; we assert the badge
    // surface itself is present rather than the inner label string.
    expect(screen.getByTestId('license-grace-card').textContent).toContain(
      'admin:license.grace_remaining',
    );
  });

  it('Renders_GracePeriodRemaining_When_InGrace', () => {
    mockUseLicense.mockReturnValue({
      data: baseLicense({
        status: 'GracePeriod',
        inGrace: true,
        // 3 days, 4 hours, 30 minutes — expected formatted output: "3d 4h"
        gracePeriodRemaining: '3.04:30:00',
      }),
      isLoading: false,
    });

    render(<LicensePage />, { wrapper: makeWrapper() });

    const card = screen.getByTestId('license-grace-card');
    expect(card.textContent).toContain('3d 4h');
  });

  it('Renders_BlockedBanner_When_Blocked', () => {
    mockUseLicense.mockReturnValue({
      data: baseLicense({
        isValid: false,
        status: 'Expired',
        inGrace: false,
        blocked: true,
        gracePeriodRemaining: null,
      }),
      isLoading: false,
    });

    render(<LicensePage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('license-blocked-banner')).toBeDefined();
    // The blocked banner takes precedence — the soft expiring-soon banner
    // must NOT render simultaneously.
    expect(screen.queryByTestId('license-warning-banner')).toBeNull();
  });

  it('opens_confirm_dialog_and_submits_license_on_confirm', () => {
    const mutate = vi.fn();
    mockUseUpdate.mockReturnValue({ mutate, isPending: false });
    mockUseLicense.mockReturnValue({
      data: baseLicense(),
      isLoading: false,
    });

    render(<LicensePage />, { wrapper: makeWrapper() });

    const input = screen.getByTestId('license-key-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'new-license-key' } });

    const submit = screen.getByTestId('license-submit-button');
    fireEvent.click(submit);

    // Confirm dialog rendered.
    const confirmBtn = screen.getByTestId('confirm-dialog-confirm');
    fireEvent.click(confirmBtn);

    expect(mutate).toHaveBeenCalledTimes(1);
    const [payload] = mutate.mock.calls[0];
    expect(payload).toEqual({ licenseKey: 'new-license-key' });
  });
});
