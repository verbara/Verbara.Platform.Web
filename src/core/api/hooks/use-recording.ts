import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface RecordingMetadata {
  sessionId: string;
  recordingName: string;
  hasRecording: boolean;
  streamUrl: string;
}

export function useRecordingMetadata(sessionId: string) {
  return useQuery({
    queryKey: ['recording-metadata', sessionId],
    queryFn: () =>
      customFetch<RecordingMetadata>({
        url: `/api/v1/recordings/${sessionId}`,
        method: 'GET',
      }),
    enabled: !!sessionId,
  });
}

export function recordingStreamUrl(sessionId: string): string {
  return `/api/v1/recordings/${sessionId}/stream`;
}
