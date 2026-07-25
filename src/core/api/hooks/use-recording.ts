import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

/** Adopts the generated `RecordingMetadataDto`, which matches this shape field-for-field
 *  (openapi-numeric-schema-truth completes the Analytics-module aliasing). */
export type RecordingMetadata = components['schemas']['RecordingMetadataDto'];

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
