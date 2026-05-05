import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { IpAllowlistTab } from './ip-allowlist-tab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => d ?? k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('./use-tenant-settings', () => ({
  useIpAllowlist: vi.fn(),
  useAddIpAllowlistEntry: vi.fn(),
  useRemoveIpAllowlistEntry: vi.fn(),
  useTenantSettings: vi.fn(),
}));

import {
  useIpAllowlist,
  useAddIpAllowlistEntry,
  useRemoveIpAllowlistEntry,
  useTenantSettings,
} from './use-tenant-settings';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('IpAllowlistTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAddIpAllowlistEntry).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useRemoveIpAllowlistEntry).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it('should show upgrade badge when feature not enabled', () => {
    vi.mocked(useTenantSettings).mockReturnValue({ data: { enabledFeatures: [] } } as never);
    vi.mocked(useIpAllowlist).mockReturnValue({ data: [], isLoading: false } as never);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper });
    expect(screen.getByTestId('ip-allowlist-upgrade')).toBeInTheDocument();
  });

  it('should show empty state when no entries', () => {
    vi.mocked(useTenantSettings).mockReturnValue({
      data: { enabledFeatures: ['IpAllowlist'] },
    } as never);
    vi.mocked(useIpAllowlist).mockReturnValue({ data: [], isLoading: false } as never);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper });
    expect(screen.getByTestId('ip-allowlist-empty')).toBeInTheDocument();
  });

  it('should list entries when present', () => {
    vi.mocked(useTenantSettings).mockReturnValue({
      data: { enabledFeatures: ['IpAllowlist'] },
    } as never);
    vi.mocked(useIpAllowlist).mockReturnValue({
      data: [{ id: 'e1', cidr: '10.0.0.0/8', description: 'VPN', createdAt: '2026-01-01' }],
      isLoading: false,
    } as never);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper });
    expect(screen.getByText('10.0.0.0/8')).toBeInTheDocument();
    expect(screen.getByText('VPN')).toBeInTheDocument();
  });

  it('should show add form when feature enabled', () => {
    vi.mocked(useTenantSettings).mockReturnValue({
      data: { enabledFeatures: ['IpAllowlist'] },
    } as never);
    vi.mocked(useIpAllowlist).mockReturnValue({ data: [], isLoading: false } as never);
    render(<IpAllowlistTab tenantId="t1" />, { wrapper });
    expect(screen.getByTestId('ip-cidr-input')).toBeInTheDocument();
    expect(screen.getByTestId('ip-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('ip-add-button')).toBeInTheDocument();
  });
});
