import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/core/api/hooks/use-system', () => ({
  useSetup: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
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

  it('should show sign in link', () => {
    render(<SetupPage />, { wrapper });
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
});
