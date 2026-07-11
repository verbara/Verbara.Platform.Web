import { useMutation } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

/**
 * Typed CSAT capture request — the single source of truth for the wire shape of
 * `POST /api/v1/csat/responses/webchat`. Mirrors the golden fixture
 * `Verbara.Platform/openspec/changes/csat-runner/fixtures/csat-response-capture.v1.json`
 * field-for-field (verbatim-fixture-citation rule, `/xr:propagate`).
 *
 * `responseToken`, `surveyId`, `questionId`, `channel`, `queueName`, and
 * `conversationId` are sourced from the embed session context (server-issued);
 * the rating panel owns only `rating`, `comment`, and `capturedAt`. No ad-hoc
 * object literals may leak extra keys onto this HTTP boundary.
 */
export interface CsatCaptureRequest {
  /** Opaque signed capture token (HMAC, 7-day TTL) issued for this conversation; echoed, never minted or mutated client-side. */
  responseToken: string;
  /** CSAT survey identifier (e.g. `srv-csat-v1`). */
  surveyId: string;
  /** Rating question identifier (e.g. `csat-rating-v1`). */
  questionId: string;
  /** Capture channel — `webchat` for the embed surface. */
  channel: string;
  /** Routing queue the conversation was handled on (e.g. `support-tier1`). */
  queueName: string;
  /** Integer star value 1–5 the visitor selected. */
  rating: number;
  /** Optional free-text comment; omitted or `null` when the visitor leaves it blank. */
  comment?: string | null;
  /** ISO-8601 UTC timestamp when the visitor submitted the rating. */
  capturedAt: string;
  /** Webchat conversation the rating belongs to (e.g. `conv-8f2a1c4e`). */
  conversationId: string;
}

/**
 * TanStack Query mutation posting a {@link CsatCaptureRequest} to
 * `POST /api/v1/csat/responses/webchat`. The embed rating panel (Phase B) owns
 * success acknowledgement; surfaces the API error message on failure, mirroring
 * the repo's mutation-hook idiom.
 */
export function useCaptureCsatResponse() {
  return useMutation({
    mutationFn: (data: CsatCaptureRequest) =>
      customFetch<void>({
        url: '/api/v1/csat/responses/webchat',
        method: 'POST',
        data,
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}
