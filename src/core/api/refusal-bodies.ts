/**
 * The host's partner-channel refusal bodies, exactly as frozen in the host change
 * `partner-channel-pilot-fixes` fixtures (copied into `tests/fixtures/contracts/`). Each `error`
 * is a kebab-case machine code that {@link ApiError} reads into `err.code` (ADR-0013); the other
 * fields reach a message through `err.facts`. The runtime never reads these types: they type the
 * fixture guard and the tests (design D4).
 */

// interim until openapi.d.ts regenerates (partner-channel-pilot-fixes 3.1)
export interface PlanAboveParentRefusal {
  error: 'plan-exceeds-parent';
  requestedPlan: string;
  parentPlan: string;
  parentTenantId: string;
}

// interim until openapi.d.ts regenerates (partner-channel-pilot-fixes 3.1)
export interface DunningPartnerCustomerRefusal {
  error: 'dunning-partner-customer';
  tenantId: string;
  partnerTenantId: string;
}

// interim until openapi.d.ts regenerates (partner-channel-pilot-fixes 3.1)
export interface CurrencyInvalidRefusal {
  error: 'currency-invalid';
  currency: string | null;
}

// interim until openapi.d.ts regenerates (partner-channel-pilot-fixes 3.1)
export interface CurrencyMismatchRefusal {
  error: 'currency-mismatch';
  partnerCurrency: string;
  hostCurrency: string;
}
