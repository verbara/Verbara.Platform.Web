import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const fetchMock = vi.fn();
vi.mock('@/core/api/client', () => ({ customFetch: (cfg: unknown) => fetchMock(cfg) }));

import { useVoiceCodecs } from './use-voice-codecs';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useVoiceCodecs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useVoiceCodecs_ShouldGetCodecsEndpoint', async () => {
    fetchMock.mockResolvedValue({ source: 'asterisk', codecs: ['ulaw', 'alaw'] });
    const { result } = renderHook(() => useVoiceCodecs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith({ url: '/api/v1/admin/voice/codecs', method: 'GET' });
    expect(result.current.data?.codecs).toEqual(['ulaw', 'alaw']);
  });
});
