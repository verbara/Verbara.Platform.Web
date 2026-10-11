import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isValidElement, type ReactElement } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/admin/gdpr/retention-policy-section', () => ({
  RetentionPolicySection: () => null,
}));

vi.mock('@/core/auth/permission-guard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

const createMutate = vi.fn();
const mutation = () => ({ mutate: vi.fn(), isPending: false });
// When true, the create sheet runs the real `useCreateTenant` against the mocked `customFetch`, so
// the host's refusal goes through the hook's own error handling.
let realCreateTenant = false;

vi.mock('@/core/api/hooks/use-tenants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-tenants')>();
  return {
    useTenants: () => ({
      data: [
        { tenantId: 'platform', name: 'Platform', type: 'Platform', status: 'Active' },
        { tenantId: 'p1', name: 'Partner One', type: 'Partner', status: 'Active' },
        { tenantId: 'dc1', name: 'Direct Customer', type: 'Customer', status: 'Active' },
      ],
      isLoading: false,
    }),
    useCreateTenant: () =>
      realCreateTenant ? actual.useCreateTenant() : { mutate: createMutate, isPending: false },
    useUpdateTenant: () => mutation(),
    useDeleteTenant: () => mutation(),
    useSuspendTenant: () => mutation(),
    useActivateTenant: () => mutation(),
  };
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toast } from 'sonner';
import { customFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import { asMock } from '@/tests/utils/as-mock';
import TenantsPage from './tenants-page';

function openCreateSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByTestId('tenants-create-button'));
}

async function openOptions(testId: string): Promise<string[]> {
  fireEvent.click(screen.getByTestId(testId));
  const options = await screen.findAllByRole('option');
  return options.map((o) => o.getAttribute('data-testid') ?? `value:${o.textContent}`);
}

async function closeOptions() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

async function choose(testId: string, optionTestId: string) {
  fireEvent.click(screen.getByTestId(testId));
  const option = await screen.findByTestId(optionTestId);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

const parentOptions = (ids: string[]) =>
  ids.filter((id) => id.startsWith('tenants-form-parent-option-'));

describe('TenantsPage create sheet — parent selector by type (P4, design D8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ParentSelector_ShouldOfferOnlyThePlatformTenant_WhenTheTypeIsPartner', async () => {
    openCreateSheet();
    await choose('tenants-form-type', 'tenants-form-type-option-Partner');

    const offered = parentOptions(await openOptions('tenants-form-parent'));

    expect(offered).toEqual(['tenants-form-parent-option-platform']);
  });

  it('ParentSelector_ShouldOfferPlatformAndPartners_WhenTheTypeIsCustomer', async () => {
    openCreateSheet();

    const offered = parentOptions(await openOptions('tenants-form-parent'));

    expect(offered).toEqual([
      'tenants-form-parent-option-platform',
      'tenants-form-parent-option-p1',
    ]);
    await closeOptions();
  });

  it('ParentSelector_ShouldClearAPartnerParent_WhenTheTypeSwitchesToPartner', async () => {
    openCreateSheet();
    await choose('tenants-form-parent', 'tenants-form-parent-option-p1');

    await choose('tenants-form-type', 'tenants-form-type-option-Partner');
    fireEvent.change(screen.getByTestId('tenants-form-tenantId'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByTestId('tenants-form-name'), { target: { value: 'Partner 2' } });
    fireEvent.click(screen.getByTestId('tenants-form-submit'));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ type: 'Partner' });
    expect(createMutate.mock.calls[0][0].parentTenantId).toBeUndefined();
  });

  it('ParentSelector_ShouldKeepThePlatformParent_WhenTheTypeSwitchesToPartner', async () => {
    openCreateSheet();
    await choose('tenants-form-parent', 'tenants-form-parent-option-platform');

    await choose('tenants-form-type', 'tenants-form-type-option-Partner');
    fireEvent.change(screen.getByTestId('tenants-form-tenantId'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByTestId('tenants-form-name'), { target: { value: 'Partner 2' } });
    fireEvent.click(screen.getByTestId('tenants-form-submit'));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      type: 'Partner',
      parentTenantId: 'platform',
    });
  });
});

describe('TenantsPage create sheet — host refusal (P2, plan-exceeds-parent)', () => {
  const refusal = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/plan-above-parent-409.json'),
      'utf-8',
    ),
  ) as { status: number; body: Record<string, unknown> };

  beforeEach(() => {
    vi.clearAllMocks();
    realCreateTenant = true;
  });

  afterEach(() => {
    realCreateTenant = false;
  });

  it('CreateSheet_ShouldStayOpenAndToastTheLocalizedRefusal_WhenTheHostAnswersPlanExceedsParent', async () => {
    asMock(customFetch).mockRejectedValue(new ApiError(refusal.status, refusal.body));
    openCreateSheet();
    await choose('tenants-form-parent', 'tenants-form-parent-option-p1');
    fireEvent.change(screen.getByTestId('tenants-form-tenantId'), { target: { value: 'c2' } });
    fireEvent.change(screen.getByTestId('tenants-form-name'), { target: { value: 'Customer 2' } });

    fireEvent.click(screen.getByTestId('tenants-form-submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const shown = asMock(toast.error).mock.calls[0][0] as ReactElement<{
      'data-error-code': string;
      children: string;
    }>;
    expect(isValidElement(shown)).toBe(true);
    expect(shown.props['data-error-code']).toBe('plan-exceeds-parent');
    expect(shown.props.children).toBe('common:errors.partner_channel.plan_exceeds_parent');
    expect(toast.success).not.toHaveBeenCalled();
    expect(customFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/management/tenants', method: 'POST' }),
    );
    // The sheet stays open with what the user typed.
    expect(screen.getByTestId('tenants-create-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('tenants-form-tenantId')).toHaveValue('c2');
    expect(screen.getByTestId('tenants-form-name')).toHaveValue('Customer 2');
  });
});
