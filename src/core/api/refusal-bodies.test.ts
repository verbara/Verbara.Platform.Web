import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { components } from '@/core/api/generated/openapi';

/**
 * Verbatim-fixture guard for the host's partner-channel refusals (host change
 * `partner-channel-pilot-fixes`, design D11). The copies in `tests/fixtures/contracts/` must match
 * the generated refusal schemas key for key and in JSON type, carry the machine code in `error` and no
 * `code` key. The shape tables are typed `Record<keyof Body, Kind>`, so a renamed type field fails
 * type-checking and a drifted copy fails at run time.
 */

type Schemas = components['schemas'];
type Kind = 'string' | 'string|null';
type Shape<T> = Record<keyof T, Kind>;

const readJson = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, unknown>;

const PLAN_ABOVE_PARENT: Shape<Schemas['PlanAboveParentRefusal']> = {
  error: 'string',
  requestedPlan: 'string',
  parentPlan: 'string',
  parentTenantId: 'string',
};
const DUNNING_PARTNER_CUSTOMER: Shape<Schemas['DunningPartnerCustomerRefusal']> = {
  error: 'string',
  tenantId: 'string',
  partnerTenantId: 'string',
};
const CURRENCY_INVALID: Shape<Schemas['CurrencyInvalidRefusal']> = {
  error: 'string',
  currency: 'string|null',
};
const CURRENCY_MISMATCH: Shape<Schemas['CurrencyMismatchRefusal']> = {
  error: 'string',
  partnerCurrency: 'string',
  hostCurrency: 'string',
};

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function expectRefusal(
  entry: unknown,
  shape: Record<string, Kind>,
  status: number,
  code: string,
  where: string,
) {
  expect(kindOf(entry), where).toBe('object');
  const { status: actualStatus, body } = entry as { status: unknown; body: unknown };
  expect(actualStatus, `${where}.status`).toBe(status);
  expect(kindOf(body), `${where}.body`).toBe('object');
  const row = body as Record<string, unknown>;
  expect(Object.keys(row).sort(), `${where}.body`).toEqual(Object.keys(shape).sort());
  for (const [key, kind] of Object.entries(shape)) {
    expect(kind.split('|'), `${where}.body.${key}`).toContain(kindOf(row[key]));
  }
  expect(row.error, `${where}.body.error`).toBe(code);
  expect(Object.keys(row), `${where}.body`).not.toContain('code');
}

describe('partner-channel refusals — verbatim-fixture guard', () => {
  it('PlanAboveParentFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    expectRefusal(
      readJson('plan-above-parent-409.json'),
      PLAN_ABOVE_PARENT,
      409,
      'plan-exceeds-parent',
      'plan-above-parent-409',
    );
  });

  it('DunningPartnerCustomerFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    expectRefusal(
      readJson('dunning-partner-customer-409.json'),
      DUNNING_PARTNER_CUSTOMER,
      409,
      'dunning-partner-customer',
      'dunning-partner-customer-409',
    );
  });

  it('CurrencyRefusalsFixture_ShouldMatchGeneratedSchemas_WhenCopiedFromHost', () => {
    const fixture = readJson('rate-card-currency-refusals.json');
    expect(Object.keys(fixture).sort()).toEqual(['currencyMismatch', 'invalidCurrency']);
    expectRefusal(
      fixture.invalidCurrency,
      CURRENCY_INVALID,
      400,
      'currency-invalid',
      'invalidCurrency',
    );
    expectRefusal(
      fixture.currencyMismatch,
      CURRENCY_MISMATCH,
      400,
      'currency-mismatch',
      'currencyMismatch',
    );
  });

  it('RefusalFixtures_ShouldCarryNoComment_WhenCopiedIntoTheTree', () => {
    for (const name of [
      'plan-above-parent-409.json',
      'dunning-partner-customer-409.json',
      'rate-card-currency-refusals.json',
    ]) {
      expect(Object.keys(readJson(name))).not.toContain('_comment');
    }
  });
});
