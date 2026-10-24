import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatNumber: () => ({ formatNumber: (n: number) => String(n) }),
  useFormatDate: () => ({ formatDateShort: (d: string) => d }),
}));

vi.mock('@/core/auth/permission-guard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/core/ui/permission-button', () => ({
  PermissionButton: ({
    children,
    requires: _requires,
    ...props
  }: { children: ReactNode; requires?: string } & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/core/api/hooks/use-dnc-lists', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/hooks/use-dnc-lists')>()),
  useDncLists: vi.fn(),
  useCreateDncList: vi.fn(),
  useUpdateDncList: vi.fn(),
  useDeleteDncList: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import {
  useCreateDncList,
  useDeleteDncList,
  useDncLists,
  useUpdateDncList,
  type DncListSummary,
} from '@/core/api/hooks/use-dnc-lists';
import DncListsPage from './dnc-lists-page';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

// Platform answers the scope as the enum's name (`DncListScope.ToString()`): `Tenant` or `Global`.
const tenantList: DncListSummary = {
  id: 1,
  name: 'Opt-outs',
  scope: 'Tenant',
  entryCount: 3,
  createdAt: '2026-10-01T00:00:00Z',
};
const globalList: DncListSummary = {
  id: 2,
  name: 'National registry',
  scope: 'Global',
  entryCount: 500,
  createdAt: '2026-01-01T00:00:00Z',
};

/** The pencil button of a row: the sibling just before that row's delete button. */
function editButtonOf(id: number): HTMLElement {
  return screen.getByTestId(`delete-dnc-${id}`).previousElementSibling as HTMLElement;
}

describe('DncListsPage form', () => {
  const createMutate = vi.fn();
  const updateMutate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    asMock(useDncLists).mockReturnValue({ data: [tenantList, globalList], isLoading: false });
    asMock(useCreateDncList).mockReturnValue({ mutate: createMutate, isPending: false });
    asMock(useUpdateDncList).mockReturnValue({ mutate: updateMutate, isPending: false });
    asMock(useDeleteDncList).mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('CreateForm_ShouldDefaultToTenantScope_WhenOpened', () => {
    render(<DncListsPage />, { wrapper });
    fireEvent.click(screen.getByTestId('dnc-lists-create-btn'));
    fireEvent.change(screen.getByTestId('dnc-form-name'), { target: { value: 'Callbacks' } });
    fireEvent.click(screen.getByTestId('dnc-form-submit'));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]?.[0]).toEqual({ name: 'Callbacks', scope: 'Tenant' });
  });

  it('CreateForm_ShouldNotOfferGlobalScope_WhenOpened', () => {
    render(<DncListsPage />, { wrapper });
    fireEvent.click(screen.getByTestId('dnc-lists-create-btn'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('dnc-lists.scope.global')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('dnc-form-scope')).toHaveAttribute('data-scope', 'tenant');
  });

  it('EditForm_ShouldNotSendGlobalScope_WhenTheListIsGlobal', () => {
    render(<DncListsPage />, { wrapper });
    fireEvent.click(editButtonOf(globalList.id));

    const dialog = screen.getByRole('dialog');
    // The stored scope is still shown, read-only.
    expect(within(dialog).getByTestId('dnc-form-scope')).toHaveAttribute('data-scope', 'global');
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('dnc-form-name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByTestId('dnc-form-submit'));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const body = updateMutate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).toEqual({ id: globalList.id, name: 'Renamed' });
    expect(body).not.toHaveProperty('scope');
  });

  it('ScopeBadge_ShouldLabelEachListByItsScope_WhenPlatformAnswersTheEnumName', () => {
    render(<DncListsPage />, { wrapper });

    expect(screen.getByText('dnc-lists.scope.tenant')).toBeInTheDocument();
    expect(screen.getByText('dnc-lists.scope.global')).toBeInTheDocument();
  });
});
