import type { PaymentRequiredProblemDetails } from './types';

/**
 * Typed error thrown by the API client when a Pro-gated endpoint returns
 * HTTP 402 Payment Required. Carries the parsed RFC 9457 ProblemDetails body
 * so downstream handlers (the global `<PaymentRequiredDialogHost />`) can
 * surface actionable upgrade / trial / contact-sales CTAs from the
 * `LicenseGuard.Evaluate` URLs Pro v2.4.0-pro populates.
 *
 * Pattern matches `UnauthorizedError` in `core/api/client.ts` — typed errors
 * for status codes that warrant special-case handling, fall-through plain
 * `Error` for everything else.
 */
export class PaymentRequiredError extends Error {
  readonly problemDetails: PaymentRequiredProblemDetails;

  constructor(problemDetails: PaymentRequiredProblemDetails) {
    super(problemDetails.detail ?? problemDetails.title ?? 'Payment Required');
    this.name = 'PaymentRequiredError';
    this.problemDetails = problemDetails;
  }
}
