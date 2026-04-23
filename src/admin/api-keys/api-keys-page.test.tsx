import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// i18n returns raw keys so assertions can match key literals directly.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object') {
        return `${k}:${JSON.stringify(opts)}`;
      }
      return k;
    },
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({
    formatDate: (v: string) => `fd(${v})`,
    formatRelative: (v: string) => `rel(${v})`,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/core/api/hooks/use-api-keys', () => ({
  useApiKeys: vi.fn(),
  useCreateApiKey: vi.fn(),
  useRotateApiKey: vi.fn(),
  useRevokeApiKey: vi.fn(),
}));

import {
  useApiKeys,
  useCreateApiKey,
  useRotateApiKey,
  useRevokeApiKey,
  type ManagementApiKey,
} from '@/core/api/hooks/use-api-keys';
import ApiKeysPage from './api-keys-page';
import { resolveApiKeyStatus } from './resolve-status';

const mockUseList = useApiKeys as unknown as ReturnType<typeof vi.fn>;
const mockUseCreate = useCreateApiKey as unknown as ReturnType<typeof vi.fn>;
const mockUseRotate = useRotateApiKey as unknown as ReturnType<typeof vi.fn>;
const mockUseRevoke = useRevokeApiKey as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function makeKey(overrides: Partial<ManagementApiKey> = {}): ManagementApiKey {
  return {
    keyId: 'k-001',
    name: 'CI deploy bot',
    isRevoked: false,
    expiresAt: null,
    createdAt: '2026-04-20T10:00:00Z',
    ...overrides,
  };
}

describe('resolveApiKeyStatus', () => {
  it('returns_revoked_when_isRevoked_true', () => {
    const key = makeKey({ isRevoked: true });
    expect(resolveApiKeyStatus(key)).toBe('revoked');
  });

  it('returns_expired_when_expiresAt_is_past', () => {
    const key = makeKey({ expiresAt: '2020-01-01T00:00:00Z' });
    expect(resolveApiKeyStatus(key, new Date('2026-01-01T00:00:00Z'))).toBe(
      'expired',
    );
  });

  it('returns_active_for_non_revoked_non_expired_key', () => {
    const key = makeKey({ expiresAt: '2099-01-01T00:00:00Z' });
    expect(resolveApiKeyStatus(key, new Date('2026-01-01T00:00:00Z'))).toBe(
      'active',
    );
  });

  it('returns_active_when_expiresAt_is_null', () => {
    const key = makeKey({ expiresAt: null });
    expect(resolveApiKeyStatus(key)).toBe('active');
  });
});

describe('ApiKeysPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseCreate.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseRotate.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseRevoke.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('renders_empty_state_when_no_keys', () => {
    mockUseList.mockReturnValue({ data: [], isLoading: false });
    render(<ApiKeysPage />, { wrapper: makeWrapper() });
    expect(screen.getByTestId('api-keys-empty')).toBeDefined();
  });

  it('renders_data_table_when_keys_exist', () => {
    mockUseList.mockReturnValue({
      data: [makeKey(), makeKey({ keyId: 'k-002', name: 'ops-audit' })],
      isLoading: false,
    });
    render(<ApiKeysPage />, { wrapper: makeWrapper() });
    expect(screen.getByTestId('api-key-name-k-001')).toBeDefined();
    expect(screen.getByTestId('api-key-name-k-002')).toBeDefined();
  });

  it('disables_rotate_and_revoke_for_revoked_keys', () => {
    mockUseList.mockReturnValue({
      data: [makeKey({ isRevoked: true })],
      isLoading: false,
    });
    render(<ApiKeysPage />, { wrapper: makeWrapper() });
    const rotate = screen.getByTestId('rotate-api-key-k-001') as HTMLButtonElement;
    const revoke = screen.getByTestId('revoke-api-key-k-001') as HTMLButtonElement;
    expect(rotate.disabled).toBe(true);
    expect(revoke.disabled).toBe(true);
  });

  it('opens_create_dialog_when_new_key_button_clicked', () => {
    mockUseList.mockReturnValue({ data: [], isLoading: false });
    render(<ApiKeysPage />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByTestId('api-keys-create-btn'));
    expect(screen.getByTestId('create-api-key-dialog')).toBeDefined();
    expect(screen.getByTestId('api-key-name-input')).toBeDefined();
  });

  it('surfaces_reveal_panel_after_successful_create', () => {
    mockUseList.mockReturnValue({ data: [], isLoading: false });
    // Simulate the mutate callback: immediately invoke onSuccess with the
    // backend response shape (mirrors CreateApiKeyResponse).
    const mutate = vi.fn(
      (
        _req: unknown,
        opts?: {
          onSuccess?: (r: {
            keyId: string;
            name: string;
            apiKey: string;
            expiresAt: string | null;
          }) => void;
        },
      ) => {
        opts?.onSuccess?.({
          keyId: 'k-new',
          name: 'CI bot',
          apiKey: 'mgmt_ffffffff1111',
          expiresAt: null,
        });
      },
    );
    mockUseCreate.mockReturnValue({ mutate, isPending: false });

    render(<ApiKeysPage />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByTestId('api-keys-create-btn'));
    fireEvent.change(screen.getByTestId('api-key-name-input'), {
      target: { value: 'CI bot' },
    });
    fireEvent.click(screen.getByTestId('create-api-key-submit'));

    expect(mutate).toHaveBeenCalled();
    // Reveal panel + warning banner + copy control should now be visible.
    expect(screen.getByTestId('api-key-reveal-panel')).toBeDefined();
    expect(screen.getByTestId('api-key-reveal-warning')).toBeDefined();
    const value = screen.getByTestId('api-key-reveal-value') as HTMLInputElement;
    expect(value.value).toBe('mgmt_ffffffff1111');
  });
});
