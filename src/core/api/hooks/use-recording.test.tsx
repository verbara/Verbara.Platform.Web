import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecordingMetadata, recordingStreamUrl } from './use-recording';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useRecordingMetadata', () => {
  it('fetches recording metadata for a session', async () => {
    const mockData = {
      sessionId: 'session-123',
      recordingName: 'call-2026-05-05.wav',
      hasRecording: true,
      streamUrl: '/api/recordings/session-123/stream',
    };
    server.use(http.get('*/api/v1/recordings/session-123', () => HttpResponse.json(mockData)));

    const { result } = renderHook(() => useRecordingMetadata('session-123'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('does not fetch when sessionId is empty', () => {
    const { result } = renderHook(() => useRecordingMetadata(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('handles 404 not found', async () => {
    server.use(
      http.get('*/api/v1/recordings/missing', () => new HttpResponse(null, { status: 404 })),
    );
    const { result } = renderHook(() => useRecordingMetadata('missing'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('recordingStreamUrl', () => {
  it('returns the correct stream URL', () => {
    expect(recordingStreamUrl('abc-123')).toBe('/api/v1/recordings/abc-123/stream');
  });
});
