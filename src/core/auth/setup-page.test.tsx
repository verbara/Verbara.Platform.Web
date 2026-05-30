import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mutateMock = vi.fn();

vi.mock('@/core/api/hooks/use-system', () => ({
  useSetup: vi.fn(() => ({ mutate: mutateMock, isPending: false, isError: false, error: null })),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SetupPage from './setup-page';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SetupPage', () => {
  it('should render setup form with email and password fields', () => {
    render(<SetupPage />, { wrapper });
    expect(screen.getByTestId('setup-email')).toBeInTheDocument();
    expect(screen.getByTestId('setup-password')).toBeInTheDocument();
    expect(screen.getByTestId('setup-submit')).toBeInTheDocument();
  });

  it('should render platform name field', () => {
    render(<SetupPage />, { wrapper });
    expect(screen.getByTestId('setup-platform-name')).toBeInTheDocument();
  });

  it('should render display name field', () => {
    render(<SetupPage />, { wrapper });
    expect(screen.getByTestId('setup-display-name')).toBeInTheDocument();
  });

  it('should render the customer (company) fields', () => {
    render(<SetupPage />, { wrapper });
    expect(screen.getByTestId('setup-customer-name')).toBeInTheDocument();
    expect(screen.getByTestId('setup-customer-tenant-id')).toBeInTheDocument();
    expect(screen.getByTestId('setup-customer-admin-email')).toBeInTheDocument();
    expect(screen.getByTestId('setup-customer-admin-password')).toBeInTheDocument();
  });

  it('should show sign in link', () => {
    render(<SetupPage />, { wrapper });
    // react-i18next is globally mocked (src/test/setup.ts): t(key) => key.
    expect(screen.getByText('setupPage.signIn')).toBeInTheDocument();
  });

  it('submits platform + customer fields', async () => {
    mutateMock.mockClear();
    render(<SetupPage />, { wrapper });

    fireEvent.change(screen.getByTestId('setup-email'), {
      target: { value: 'admin@x.com' },
    });
    fireEvent.change(screen.getByTestId('setup-password'), {
      target: { value: 'PlatformPass2026!' },
    });
    fireEvent.change(screen.getByTestId('setup-customer-name'), {
      target: { value: 'Acme Corp' },
    });
    fireEvent.change(screen.getByTestId('setup-customer-tenant-id'), {
      target: { value: 'acme' },
    });
    fireEvent.change(screen.getByTestId('setup-customer-admin-email'), {
      target: { value: 'ops@acme.com' },
    });
    fireEvent.change(screen.getByTestId('setup-customer-admin-password'), {
      target: { value: 'CustomerPass2026!' },
    });
    fireEvent.click(screen.getByTestId('setup-submit'));

    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@x.com',
        customerTenantId: 'acme',
        customerName: 'Acme Corp',
        customerAdminEmail: 'ops@acme.com',
        customerAdminPassword: 'CustomerPass2026!',
      }),
      expect.anything(),
    );
  });
});
