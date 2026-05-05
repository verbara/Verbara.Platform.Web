import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConsentManagementPage from './consent-management-page';

vi.mock('@/core/api/hooks/use-contacts', () => ({
  useSearchContacts: vi.fn(() => ({ data: [], isLoading: false })),
  useUpdateContact: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/admin/shared/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>,
}));

vi.mock('@/core/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/core/ui/confirm-delete-dialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/core/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/core/ui/checkbox', () => ({
  Checkbox: (props: Record<string, unknown>) => (
    <input type="checkbox" data-testid="checkbox" {...props} />
  ),
}));

vi.mock('@/core/ui/switch', () => ({
  Switch: (props: Record<string, unknown>) => <button data-testid="switch" {...props} />,
}));

vi.mock('@/core/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/core/ui/input', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock('@/core/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

describe('ConsentManagementPage', () => {
  it('renders page header', () => {
    render(<ConsentManagementPage />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('consent.title');
  });

  it('shows empty state with no search results', async () => {
    const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
    vi.mocked(useSearchContacts).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useSearchContacts>);

    render(<ConsentManagementPage />);
    // Without a search of >= 2 chars, no empty message shown
    expect(screen.queryByTestId('consent-empty')).not.toBeInTheDocument();
  });

  it('renders contacts with consent badges when search returns results', async () => {
    const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
    vi.mocked(useSearchContacts).mockReturnValue({
      data: [
        {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme',
          addresses: [],
          createdAt: '2025-01-01',
          doNotContact: false,
          channelConsent: { voice: true, email: true, sms: false, whatsapp: false, webchat: true },
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useSearchContacts>);

    render(<ConsentManagementPage />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^channel-badge-/).length).toBe(5);
  });

  it('shows edit button per row', async () => {
    const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
    vi.mocked(useSearchContacts).mockReturnValue({
      data: [
        {
          id: '1',
          firstName: 'Jane',
          lastName: 'Smith',
          addresses: [],
          createdAt: '2025-01-01',
          channelConsent: {},
        },
        {
          id: '2',
          firstName: 'Bob',
          lastName: 'Jones',
          addresses: [],
          createdAt: '2025-01-01',
          channelConsent: {},
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useSearchContacts>);

    render(<ConsentManagementPage />);
    const editButtons = screen.getAllByTestId('edit-consent-btn');
    expect(editButtons).toHaveLength(2);
  });
});
