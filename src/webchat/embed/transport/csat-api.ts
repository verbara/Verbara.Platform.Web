import type { CsatCaptureRequest } from '@/core/api/hooks/use-csat';

/**
 * Embed-native CSAT capture transport.
 *
 * The rating panel runs inside the webchat embed iframe, which has **no**
 * `QueryClientProvider` and **no** auth/tenant store — so it cannot use the
 * app-side {@link import('@/core/api/hooks/use-csat').useCaptureCsatResponse}
 * TanStack hook (that hook posts through the auth-gated `customFetch`). Instead
 * the embed posts directly with plain `fetch`, exactly like
 * `session-api.ts`, authenticating with the server-issued `responseToken`
 * carried in the {@link CsatCaptureRequest} body (HMAC, 7-day TTL). The wire
 * shape is still the single-source-of-truth {@link CsatCaptureRequest} DTO from
 * Phase A — no ad-hoc object literals may leak extra keys onto this boundary.
 */
export async function captureCsatResponse(input: {
  apiBase: string;
  body: CsatCaptureRequest;
}): Promise<void> {
  const url = `${input.apiBase.replace(/\/$/, '')}/csat/responses/webchat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.body),
  });
  if (!res.ok) {
    throw new Error(`captureCsatResponse failed with ${res.status}`);
  }
}
