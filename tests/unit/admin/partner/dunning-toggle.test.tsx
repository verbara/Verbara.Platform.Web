import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mock i18n so useTranslation returns default text ─────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Mock partner customer hooks (page deps) ─────────────────────────────────
vi.mock('@/core/api/hooks/use-partner', () => ({
  usePartnerCustomer: () => ({
    data: {
      tenantId: 'tenant-abc',
      name: 'Acme Corp',
      status: 'Active',
      plan: 'Enterprise',
      createdAt: '2026-04-01T00:00:00Z',
    },
  }),
  useUpdatePartnerCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useSuspendCustomer: () => ({ mutate: vi.fn() }),
  useActivateCustomer: () => ({ mutate: vi.fn() }),
  useCustomerSettings: () => ({ data: null, isLoading: false }),
  useUpdateCustomerSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomerInvoices: () => ({ data: [] }),
  useGeneratePartnerInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomerUsage: () => ({ data: [] }),
}));

// ─── Mock billing hooks (controllable per test) ──────────────────────────────
const dunningStatusMock = vi.fn();
const updateDunningMock = vi.fn();
const updateDunningMutate = vi.fn();
let updateDunningPending = false;

vi.mock('@/core/api/hooks/use-billing', () => ({
  useDunningStatus: (...args: unknown[]) => dunningStatusMock(...args),
  useUpdateDunningStatus: (...args: unknown[]) => {
    updateDunningMock(...args);
    return { mutate: updateDunningMutate, isPending: updateDunningPending };
  },
}));

// ─── Stub react-router-dom hooks so the page can mount outside a Router ──────
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'tenant-abc' }),
  useNavigate: () => vi.fn(),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────
import PartnerCustomerDetailPage from '@/admin/partner/customer-detail-page';

beforeEach(() => {
  dunningStatusMock.mockReset();
  updateDunningMock.mockReset();
  updateDunningMutate.mockReset();
  updateDunningPending = false;
});

describe('PartnerCustomerDetailPage — dunning toggle', () => {
  it('renders dunning toggle co-located with suspend button', () => {
    dunningStatusMock.mockReturnValue({
      data: {
        isActive: true,
        phase: 'Phase1',
        daysOverdue: 14,
        overdueAmount: 1234.56,
        invoiceId: 'inv-1',
        isPaused: false,
      },
    });
    render(<PartnerCustomerDetailPage />);

    // Suspend button (existing) anchors the action area.
    expect(screen.getByTestId('suspend-customer')).toBeInTheDocument();

    // Dunning toggle is rendered next to it.
    expect(screen.getByTestId('dunning-toggle')).toBeInTheDocument();
  });

  it('opens reason input + calls useUpdateDunningStatus when toggled to paused', async () => {
    dunningStatusMock.mockReturnValue({
      data: {
        isActive: true,
        phase: 'Phase1',
        daysOverdue: 7,
        overdueAmount: 500,
        invoiceId: 'inv-2',
        isPaused: false,
      },
    });
    render(<PartnerCustomerDetailPage />);

    // Toggle from unpaused -> paused: reveals reason input.
    fireEvent.click(screen.getByTestId('dunning-toggle'));
    const reasonInput = await screen.findByTestId('dunning-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'Customer dispute under review' } });

    fireEvent.click(screen.getByTestId('dunning-confirm'));

    await waitFor(() => {
      expect(updateDunningMutate).toHaveBeenCalledWith({
        paused: true,
        reason: 'Customer dispute under review',
      });
    });
  });

  it('disables toggle while mutation is in flight', () => {
    dunningStatusMock.mockReturnValue({
      data: {
        isActive: true,
        phase: 'Phase1',
        daysOverdue: 14,
        overdueAmount: 1234.56,
        invoiceId: 'inv-3',
        isPaused: false,
      },
    });
    updateDunningPending = true;
    render(<PartnerCustomerDetailPage />);

    expect(screen.getByTestId('dunning-toggle')).toBeDisabled();
  });
});
