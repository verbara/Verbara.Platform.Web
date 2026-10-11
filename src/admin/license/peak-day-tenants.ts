import type { LicensedAgentPartnerSubtotal, LicensedAgentPeaks } from '@/core/api/hooks/use-system';

export type LicensedTenantDay = LicensedAgentPeaks['days'][number]['tenants'][number];

/**
 * The tenants of the `days[]` entry whose `day` equals `deployment.peakDay`, sorted by
 * `licensedAgents` descending (design D7). Null when there is no peak day (no day of the range is
 * closed) or when `days[]` has no entry for it. The figures are the server's, never re-added.
 */
export function peakDayTenants(peaks: LicensedAgentPeaks): LicensedTenantDay[] | null {
  const { peakDay } = peaks.deployment;
  if (!peakDay) return null;
  const entry = peaks.days.find((d) => d.day === peakDay);
  if (!entry) return null;
  return [...entry.tenants].sort((a, b) => b.licensedAgents - a.licensedAgents);
}

/**
 * `deployment.partnerSubtotals` in the order received (host-ordered by `partnerTenantId`). A
 * response from a host before the partner-channel slice has none: an empty list (design D9).
 */
export function partnerSubtotals(peaks: LicensedAgentPeaks): LicensedAgentPartnerSubtotal[] {
  return peaks.deployment.partnerSubtotals ?? [];
}

/**
 * The direct share of the peak day: `peakLicensedAgents` minus the Partner subtotals, the one
 * formula the host fixture's `_comment` defines. Nothing else is computed.
 */
export function directSubtotal(peaks: LicensedAgentPeaks): number {
  return (
    peaks.deployment.peakLicensedAgents -
    partnerSubtotals(peaks).reduce((sum, s) => sum + s.licensedAgents, 0)
  );
}

export type TenantChannel =
  | { readonly kind: 'partner'; readonly partnerName: string }
  | { readonly kind: 'direct' }
  | { readonly kind: 'unknown' };

/**
 * A peak-day row's channel, from the server's two fields only (design D9): a `parentTenantId`
 * that is a listed Partner names that Partner; any other string is direct; null (the tenant row no
 * longer exists) or absent (an older host) is unknown. No tenant type is read from anywhere else.
 */
export function tenantChannel(
  tenant: Pick<LicensedTenantDay, 'parentTenantId'>,
  subtotals: readonly LicensedAgentPartnerSubtotal[],
): TenantChannel {
  const parent = tenant.parentTenantId;
  if (typeof parent !== 'string') return { kind: 'unknown' };
  const partner = subtotals.find((s) => s.partnerTenantId === parent);
  return partner ? { kind: 'partner', partnerName: partner.partnerTenantName } : { kind: 'direct' };
}
