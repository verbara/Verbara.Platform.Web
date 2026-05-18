/**
 * Typed view of the RFC 9457 ProblemDetails body returned by Verbara.Platform.Api
 * when a Pro-gated endpoint is blocked by the LicenseGate middleware (HTTP 402
 * Payment Required). Mirrors the contract introduced in Platform v2.2.0 +
 * Pro v2.4.0-pro (ADR-0012).
 *
 * Pro's `LicenseGuard.Evaluate` populates the extension members based on the
 * resolved `LicenseBlockReason`:
 *   - NotLicensed / Expired / GraceExhausted → trial_url + upgrade_url
 *   - Revoked                                → contact_sales_url
 *   - UnauthorizedImage                      → no URLs (deployment-correctness signal)
 */
export interface PaymentRequiredProblemDetails {
  // RFC 9457 core fields (always present)
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;

  // Pro v2.4.0-pro extension members — all optional, populated based on Reason
  readonly tier_required?: string;
  readonly trial_url?: string;
  readonly upgrade_url?: string;
  readonly contact_sales_url?: string;
}

/**
 * Type guard — runtime check that an arbitrary JSON-decoded value matches the
 * minimum shape of a PaymentRequired ProblemDetails. Used by the API client
 * before throwing the typed error, so callers can rely on the typed shape
 * downstream.
 */
export function isPaymentRequiredProblemDetails(
  value: unknown,
): value is PaymentRequiredProblemDetails {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.title === 'string' && typeof obj.status === 'number' && obj.status === 402;
}
