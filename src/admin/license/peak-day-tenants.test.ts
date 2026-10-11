import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LicensedAgentPeaks } from '@/core/api/hooks/use-system';
import {
  directSubtotal,
  partnerSubtotals,
  peakDayTenants,
  tenantChannel,
} from './peak-day-tenants';

const fixture = (): LicensedAgentPeaks =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/licensed-agent-peaks.v1.json'),
      'utf-8',
    ),
  ) as LicensedAgentPeaks;

describe('tenantChannel (design D9)', () => {
  it('should name the Partner of a row whose parent is a listed Partner', () => {
    const peaks = fixture();
    const globex = peakDayTenants(peaks)!.find((t) => t.tenantId === 'ten-globex')!;
    expect(tenantChannel(globex, partnerSubtotals(peaks))).toEqual({
      kind: 'partner',
      partnerName: 'Reseller One',
    });
  });

  it('should mark a row whose parent is any other tenant as direct', () => {
    const peaks = fixture();
    const acme = peakDayTenants(peaks)!.find((t) => t.tenantId === 'ten-acme')!;
    expect(tenantChannel(acme, partnerSubtotals(peaks))).toEqual({ kind: 'direct' });
  });

  it('should mark a row with a null parent as unknown', () => {
    const peaks = fixture();
    const acme = { ...peakDayTenants(peaks)![0]!, parentTenantId: null };
    expect(tenantChannel(acme, partnerSubtotals(peaks))).toEqual({ kind: 'unknown' });
  });

  it('should mark a row from an older host, without parentTenantId, as unknown', () => {
    const peaks = fixture();
    const { parentTenantId: _omitted, ...row } = peakDayTenants(peaks)![0]!;
    expect(tenantChannel(row, [])).toEqual({ kind: 'unknown' });
  });
});

describe('partnerSubtotals and directSubtotal (design D9)', () => {
  it('should keep the server order and compute the direct remainder', () => {
    const peaks = fixture();
    expect(partnerSubtotals(peaks).map((s) => [s.partnerTenantName, s.licensedAgents])).toEqual([
      ['Reseller One', 15],
    ]);
    expect(directSubtotal(peaks)).toBe(32);
  });

  it('should read a response without partnerSubtotals as an empty list', () => {
    const peaks = fixture();
    delete peaks.deployment.partnerSubtotals;
    expect(partnerSubtotals(peaks)).toEqual([]);
    expect(directSubtotal(peaks)).toBe(47);
  });

  it('should list several Partners in the order received', () => {
    const peaks = fixture();
    peaks.deployment.partnerSubtotals = [
      { partnerTenantId: 'ten-b', partnerTenantName: 'B', licensedAgents: 5 },
      { partnerTenantId: 'ten-a', partnerTenantName: 'A', licensedAgents: 7 },
    ];
    expect(partnerSubtotals(peaks).map((s) => s.partnerTenantId)).toEqual(['ten-b', 'ten-a']);
    expect(directSubtotal(peaks)).toBe(35);
  });
});
