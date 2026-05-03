import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'es-419' },
  }),
}));

vi.mock('@/core/api/hooks/use-agent-assist-feature', () => ({
  useAgentAssistFeature: vi.fn(),
  useUpdateAgentAssistFeature: vi.fn(),
}));

import {
  useAgentAssistFeature,
  useUpdateAgentAssistFeature,
} from '@/core/api/hooks/use-agent-assist-feature';
import AgentAssistFeaturePage from './agent-assist-page';

const mockUseFeature = useAgentAssistFeature as ReturnType<typeof vi.fn>;
const mockUseUpdate = useUpdateAgentAssistFeature as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('AgentAssistFeaturePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseUpdate.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('renders_page_with_disabled_form_when_feature_off', () => {
    mockUseFeature.mockReturnValue({
      data: {
        enabled: false,
        provider: null,
        credentialsConfigured: false,
        apiKeyMasked: null,
        endpointMasked: null,
        updatedAt: null,
        updatedBy: null,
      },
      isLoading: false,
    });

    render(<AgentAssistFeaturePage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('agent-assist-feature-page')).toBeDefined();
    const providerSelect = screen.getByTestId('agent-assist-provider-select');
    // Select is disabled because toggle is off — aria-disabled reflects the disabled prop.
    expect(providerSelect.getAttribute('data-disabled') === 'true'
      || providerSelect.getAttribute('aria-disabled') === 'true'
      || providerSelect.hasAttribute('disabled')).toBe(true);
  });

  it('shows_updated_by_metadata_when_credentials_configured', () => {
    mockUseFeature.mockReturnValue({
      data: {
        enabled: true,
        provider: 'deepgram',
        credentialsConfigured: true,
        apiKeyMasked: '***',
        endpointMasked: null,
        updatedAt: '2026-04-22T10:00:00Z',
        updatedBy: 'platform-admin',
      },
      isLoading: false,
    });

    render(<AgentAssistFeaturePage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('agent-assist-enable-toggle')).toBeDefined();
    // Translation key is passed through (i18n mock returns raw keys)
    // so we assert the key literal appears somewhere on the page.
    expect(screen.getByText(/updated-by/)).toBeDefined();
  });
});
