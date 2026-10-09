import type { LicensedAgentPeaks } from '@/core/api/hooks/use-system';

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
