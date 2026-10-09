import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { components } from '@/core/api/generated/openapi';
import { createWrapper } from '@/test/hook-test-utils';
import {
  fetchLicensedAgentExport,
  licensedAgentExportFileName,
  useLicenseStatus,
  useLicensedAgentExport,
  useLicensedAgentPeaks,
} from './use-system';

/**
 * Licensed-agent metering, Web child (host change `licensed-agent-metering`, slice 3).
 *
 * 1. Verbatim-fixture guard: the three host contract fixtures, copied unchanged (minus `_comment`)
 *    into `tests/fixtures/contracts/`, must match the generated OpenAPI schemas key for key and in
 *    JSON type. The shape tables below are typed `Record<keyof Schema, Kind>`, so a schema field
 *    added or renamed by a regenerated `openapi.d.ts` fails type-checking of this table, and a
 *    fixture that drifts fails at run time.
 * 2. The hooks call the right endpoints with the fixture bodies, and the export is handed back as
 *    the served bytes, never parsed (design D2).
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Schemas = components['schemas'];
type Kind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'string|null'
  | 'number|null'
  | 'boolean|null';
type Shape<T> = Record<keyof T, Kind>;

const fixturePath = (name: string) => resolve(process.cwd(), 'tests/fixtures/contracts', name);
const PEAKS_PATH = fixturePath('licensed-agent-peaks.v1.json');
const EXPORT_PATH = fixturePath('licensed-agent-export.v1.json');
const STATUS_PATH = fixturePath('license-status-snapshot.v1.json');

const readJson = (path: string) =>
  JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;

const LICENSE: Shape<Schemas['LicensedAgentLicenseDto']> = {
  licenseId: 'string|null',
  licensee: 'string|null',
  tier: 'string',
  maxAgents: 'number|null',
  maxAgentsAdvisory: 'boolean',
};
const CHAIN_HEAD: Shape<Schemas['LicensedAgentChainHeadDto']> = {
  tenantId: 'string|null',
  headSequence: 'number',
  headHash: 'string',
  licenseId: 'string|null',
};
const PEAKS: Shape<Schemas['LicensedAgentPeaksResponse']> = {
  schemaVersion: 'number',
  from: 'string',
  to: 'string',
  dayZone: 'string',
  license: 'object',
  deployment: 'object',
  days: 'array',
  chainHeads: 'array',
};
const DEPLOYMENT: Shape<Schemas['LicensedAgentDeploymentPeakDto']> = {
  peakLicensedAgents: 'number',
  peakDay: 'string|null',
  overBand: 'boolean',
};
const DAY: Shape<Schemas['LicensedAgentDayDto']> = {
  day: 'string',
  deploymentLicensedAgents: 'number',
  deploymentRowHash: 'string',
  tenants: 'array',
};
const TENANT_DAY: Shape<Schemas['LicensedAgentTenantDayDto']> = {
  tenantId: 'string',
  tenantName: 'string',
  licensedAgents: 'number',
  revision: 'number',
  closedAt: 'string',
  rowHash: 'string',
};
const EXPORT: Shape<Schemas['LicensedAgentExportResponse']> = {
  schemaVersion: 'number',
  hashScheme: 'string',
  generatedAt: 'string',
  from: 'string',
  to: 'string',
  dayZone: 'string',
  license: 'object',
  events: 'array',
  daily: 'array',
  chainHeads: 'array',
};
const EVENT: Shape<Schemas['LicensedAgentExportEventDto']> = {
  tenantId: 'string|null',
  sequence: 'number',
  eventId: 'string',
  kind: 'string',
  occurredAt: 'string',
  agentId: 'string|null',
  userId: 'string|null',
  actorUserId: 'string|null',
  conversationId: 'string|null',
  userStatus: 'string|null',
  counted: 'boolean|null',
  licenseId: 'string|null',
  prevHash: 'string',
  rowHash: 'string',
};
const DAILY: Shape<Schemas['LicensedAgentExportDailyDto']> = {
  tenantId: 'string|null',
  sequence: 'number',
  day: 'string',
  revision: 'number',
  licensedAgents: 'number',
  closedAt: 'string',
  closedThroughSequence: 'number',
  licenseId: 'string|null',
  prevHash: 'string',
  rowHash: 'string',
};
const STATUS: Shape<Required<Schemas['LicenseStatusSnapshot']>> = {
  isLoaded: 'boolean',
  isValid: 'boolean',
  tier: 'string',
  expiresAt: 'string|null',
  maxAgents: 'number|null',
  maxNodes: 'number|null',
  authorizedDigestsCount: 'number',
  lastValidationResult: 'string',
  lastValidationAt: 'string|null',
  revalidationInterval: 'string|null',
  licensee: 'string|null',
};

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Asserts `value` has exactly the shape's keys, each of an allowed JSON type. */
function expectShape(value: unknown, shape: Record<string, Kind>, where: string) {
  expect(kindOf(value), where).toBe('object');
  const row = value as Record<string, unknown>;
  expect(Object.keys(row).sort(), where).toEqual(Object.keys(shape).sort());
  for (const [key, kind] of Object.entries(shape)) {
    expect(kind.split('|'), `${where}.${key}`).toContain(kindOf(row[key]));
  }
}

function expectRows(rows: unknown, shape: Record<string, Kind>, where: string) {
  expect(Array.isArray(rows), where).toBe(true);
  const list = rows as unknown[];
  expect(list.length, where).toBeGreaterThan(0);
  list.forEach((row, i) => expectShape(row, shape, `${where}[${i}]`));
}

describe('licensed-agent metering — verbatim-fixture guard', () => {
  it('PeaksFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    const fixture = readJson(PEAKS_PATH);
    expectShape(fixture, PEAKS, 'peaks');
    expectShape(fixture.license, LICENSE, 'peaks.license');
    expectShape(fixture.deployment, DEPLOYMENT, 'peaks.deployment');
    expectRows(fixture.days, DAY, 'peaks.days');
    for (const day of fixture.days as Array<Record<string, unknown>>) {
      expectRows(day.tenants, TENANT_DAY, `peaks.days.${String(day.day)}.tenants`);
    }
    expectRows(fixture.chainHeads, CHAIN_HEAD, 'peaks.chainHeads');
  });

  it('ExportFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    const fixture = readJson(EXPORT_PATH);
    expectShape(fixture, EXPORT, 'export');
    expectShape(fixture.license, LICENSE, 'export.license');
    expectRows(fixture.events, EVENT, 'export.events');
    expectRows(fixture.daily, DAILY, 'export.daily');
    expectRows(fixture.chainHeads, CHAIN_HEAD, 'export.chainHeads');
  });

  it('StatusFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    expectShape(readJson(STATUS_PATH), STATUS, 'status');
  });

  it('Fixtures_ShouldCarryNoComment_WhenCopiedIntoTheTree', () => {
    for (const path of [PEAKS_PATH, EXPORT_PATH, STATUS_PATH]) {
      expect(Object.keys(readJson(path))).not.toContain('_comment');
    }
  });
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('licensed-agent metering — hooks', () => {
  it('UseLicenseStatus_ShouldReturnSnapshot_WhenStatusEndpointAnswers', async () => {
    const body = readJson(STATUS_PATH);
    server.use(
      http.get('*/api/v1/management/system/license/status', () => HttpResponse.json(body)),
    );

    const { result } = renderHook(() => useLicenseStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body);
    expect(result.current.data?.tier).toBe('SelfHostBusiness');
  });

  it('UseLicensedAgentPeaks_ShouldSendFromAndTo_WhenRangeGiven', async () => {
    const body = readJson(PEAKS_PATH);
    let seen: URLSearchParams | null = null;
    server.use(
      http.get('*/api/v1/management/licensing/agents', ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(body);
      }),
    );

    const { result } = renderHook(
      () => useLicensedAgentPeaks({ from: '2026-09-01', to: '2026-09-30' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen!.get('from')).toBe('2026-09-01');
    expect(seen!.get('to')).toBe('2026-09-30');
    expect(result.current.data?.deployment.peakLicensedAgents).toBe(47);
  });

  it('FetchLicensedAgentExport_ShouldReturnServedBytes_WhenExportAnswers', async () => {
    const bytes = readFileSync(EXPORT_PATH);
    server.use(
      http.get(
        '*/api/v1/management/licensing/agents/export',
        () =>
          new HttpResponse(bytes, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const blob = await fetchLicensedAgentExport({ from: '2026-09-01', to: '2026-09-30' });

    expect(Buffer.from(await blob.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it('UseLicensedAgentExport_ShouldSaveResponseBodyByteForByte_WhenMutated', async () => {
    const bytes = readFileSync(EXPORT_PATH);
    let seen: URLSearchParams | null = null;
    server.use(
      http.get('*/api/v1/management/licensing/agents/export', ({ request }) => {
        seen = new URL(request.url).searchParams;
        return new HttpResponse(bytes, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    let saved: Blob | null = null;
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = vi.fn((b: Blob) => {
      saved = b;
      return 'blob:licensed-agents';
    });
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { result } = renderHook(() => useLicensedAgentExport(), { wrapper: createWrapper() });
    await act(() => result.current.mutateAsync({ from: '2026-09-01', to: '2026-09-30' }));

    expect(seen!.get('from')).toBe('2026-09-01');
    expect(seen!.get('to')).toBe('2026-09-30');
    expect(saved).not.toBeNull();
    expect(Buffer.from(await saved!.arrayBuffer()).equals(bytes)).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:licensed-agents');

    click.mockRestore();
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('LicensedAgentExportFileName_ShouldNameTheRange_WhenGivenAMonth', () => {
    expect(licensedAgentExportFileName({ from: '2026-09-01', to: '2026-09-30' })).toBe(
      'licensed-agents-2026-09-01-2026-09-30.json',
    );
  });
});
