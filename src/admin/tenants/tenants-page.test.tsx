import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/admin/gdpr/retention-policy-section', () => ({
  RetentionPolicySection: () => null,
}));

vi.mock('@/core/auth/permission-guard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => children,
}));

const createMutate = vi.fn();
const mutation = () => ({ mutate: vi.fn(), isPending: false });

vi.mock('@/core/api/hooks/use-tenants', () => ({
  useTenants: () => ({
    data: [
      { tenantId: 'platform', name: 'Platform', type: 'Platform', status: 'Active' },
      { tenantId: 'p1', name: 'Partner One', type: 'Partner', status: 'Active' },
      { tenantId: 'dc1', name: 'Direct Customer', type: 'Customer', status: 'Active' },
    ],
    isLoading: false,
  }),
  useCreateTenant: () => ({ mutate: createMutate, isPending: false }),
  useUpdateTenant: () => mutation(),
  useDeleteTenant: () => mutation(),
  useSuspendTenant: () => mutation(),
  useActivateTenant: () => mutation(),
}));

import TenantsPage from './tenants-page';

function openCreateSheet() {
  render(
    <MemoryRouter>
      <TenantsPage />
    </MemoryRouter>,
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
