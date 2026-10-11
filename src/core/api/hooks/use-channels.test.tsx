import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import { ApiError, entriesOf } from '@/core/api/api-error';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';
import type { ChannelConfig, ChannelTestResult } from './use-channels';
import {
  CHANNEL_TEST_ERRORS,
  CHANNEL_UPDATE_ERRORS,
  useChannel,
  useTestChannel,
  useUpdateChannel,
} from './use-channels';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** The 2.28.0 shape: key names and whether each is set, never a value. */
const mockChannel: ChannelConfig = {
  channel: 'WhatsApp',
  isActive: true,
  isConfigured: true,
  credentials: [
    { key: 'AccessToken', isSet: true },
    { key: 'PhoneNumberId', isSet: true },
    { key: 'WabaId', isSet: false },
    { key: 'ApiToken', isSet: true },
  ],
};

describe('useChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch channel config by channelId', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockChannel);

    const { result } = renderHook(() => useChannel('whatsapp'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChannel);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/channels/whatsapp',
      method: 'GET',
    });
  });

  it('should not fetch when channelId is undefined', () => {
    const { result } = renderHook(() => useChannel(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useChannel('bad-channel'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useUpdateChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call PUT /api/v1/admin/channels/{channelId}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockChannel);

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });

    const data = {
      channelId: 'whatsapp',
      isActive: true,
      credentials: { AccessToken: 'tok-new', ApiToken: null },
    };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/channels/whatsapp',
      method: 'PUT',
      data: { isActive: true, credentials: { AccessToken: 'tok-new', ApiToken: null } },
    });
  });

  it('mutate_ShouldStoreTheResponseAsTheChannel_WhenSaved', async () => {
    const saved: ChannelConfig = {
      ...mockChannel,
      credentials: [{ key: 'AppSecret', isSet: true }],
    };
    vi.mocked(client.customFetch).mockResolvedValue(saved);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const local = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateChannel(), { wrapper: local });
    act(() => {
      result.current.mutate({ channelId: 'whatsapp', isActive: true, credentials: {} });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['channels', 'whatsapp'])).toEqual(saved);
  });

  it('onError_ShouldToastTheUnknownKeyCode_WhenPlatformRefusesAKey', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(400, { error: 'unknown-credential-key', details: ['AppSecrt'] }),
    );

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });
    act(() => {
      result.current.mutate({
        channelId: 'whatsapp',
        isActive: true,
        credentials: { AppSecrt: 'x' },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const shown = vi.mocked(toast.error).mock.calls[0]?.[0] as React.ReactElement<{
      'data-error-code': string;
    }>;
    expect(shown.props['data-error-code']).toBe('unknown-credential-key');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation failed'));

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });

    act(() => {
      result.current.mutate({ channelId: 'whatsapp', isActive: false, credentials: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Validation failed');
  });
});

describe('useTestChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mutate_ShouldPostToTheChannelTestRoute_AndReturnTheServerOutcome', async () => {
    const outcome: ChannelTestResult = {
      success: false,
      message: 'Invalid OAuth access token [redacted]',
      code: 'provider-rejected',
      verifiedName: null,
    };
    vi.mocked(client.customFetch).mockResolvedValue(outcome);

    const { result } = renderHook(() => useTestChannel(), { wrapper });
    act(() => {
      result.current.mutate('whatsapp');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/channels/whatsapp/test',
      method: 'POST',
    });
    expect(result.current.data).toEqual(outcome);
  });
});

describe.each(TEST_LOCALES)('channel error maps in %s', (lng) => {
  it('ChannelErrorMaps_ShouldResolveEveryEntryToATranslation', async () => {
    const i18n = await createLocaleI18n(lng);
    for (const entry of [...entriesOf(CHANNEL_UPDATE_ERRORS), ...entriesOf(CHANNEL_TEST_ERRORS)]) {
      expect(i18n.exists(entry.key), entry.key).toBe(true);
    }
  });
});
