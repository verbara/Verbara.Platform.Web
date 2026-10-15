import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ApiError,
  describeApiError,
  entriesOf,
  machineCodeOf,
  type ApiErrorMap,
} from './api-error';

describe('machineCodeOf', () => {
  it.each(['not-owner', 'not-offered-to-you', 'target-queue-not-found', 'user-changed'])(
    'should read %s as a machine code',
    (code) => {
      expect(machineCodeOf({ error: code })).toBe(code);
    },
  );

  it.each([
    'Contact not found',
    'Cannot hold conversation',
    'Invalid or expired reset token',
    'Agent has no capacity.',
    'forbidden',
    'Not-Owner',
    'not owner',
    'not-owner ',
    '-not-owner',
    '',
  ])('should never read the prose %j as a machine code', (error) => {
    expect(machineCodeOf({ error })).toBeNull();
  });

  it('should return null when the body has no string error', () => {
    expect(machineCodeOf(null)).toBeNull();
    expect(machineCodeOf('not-owner')).toBeNull();
    expect(machineCodeOf({ error: 42 })).toBeNull();
    expect(machineCodeOf({ errors: ['not-owner'] })).toBeNull();
  });
});

describe('ApiError', () => {
  it('should be an Error whose name is ApiError', () => {
    const err = new ApiError(403, { error: 'not-owner' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
  });

  it('should carry null retryAfterSeconds when built with status and body only', () => {
    const err = new ApiError(429, { error: 'Wait before generating them again.' });
    expect(err.retryAfterSeconds).toBeNull();
    expect(err.status).toBe(429);
  });

  it('should carry the retryAfterSeconds given as the third argument', () => {
    expect(new ApiError(429, null, 7).retryAfterSeconds).toBe(7);
  });

  // Platform's password-policy refusal is `ErrorDetailResponse(Error, Details)`: `details` on the wire.
  it('should keep the policy details list of strings of an ErrorDetailResponse', () => {
    const err = new ApiError(400, {
      error: 'Password does not meet policy',
      details: ['Too short', 'Needs a digit'],
    });
    expect(err.code).toBeNull();
    expect(err.errors).toEqual(['Too short', 'Needs a digit']);
    expect(err.message).toBe('Password does not meet policy');
  });

  it('should prefer detail, then error, for the message as the client always did', () => {
    expect(new ApiError(404, { detail: 'd', error: 'e' }).message).toBe('d');
    expect(new ApiError(404, { error: 'e' }).message).toBe('e');
    expect(new ApiError(404, null).message).toBe('API error: 404');
    expect(new ApiError(400, { errors: [] }).message).toBe('API error: 400');
  });
});

type Action = 'hold' | 'typify';

const MAP: ApiErrorMap<Action> = {
  codes: { 'not-owner': { code: 'not-owner', key: 'errors.not_owner' } },
  actions: {
    hold: { 400: { code: 'conflict', key: 'errors.conflict' } },
    typify: {
      400: (err) => (err.errors ? { code: 'typify-invalid', key: 'errors.typify' } : null),
    },
  },
  statuses: { 404: { code: 'not-found', key: 'errors.not_found' } },
  fallback: { code: 'failed', key: 'errors.failed' },
};

const contract = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, { status: number; body: Record<string, unknown> }> & {
    status: number;
    body: Record<string, unknown>;
  };

describe('ApiError facts (partner-channel-pilot-fixes, design D3)', () => {
  const currency = contract('rate-card-currency-refusals.json');
  const refusals = [
    {
      name: 'plan-above-parent-409.json',
      ...contract('plan-above-parent-409.json'),
      facts: { requestedPlan: 'Enterprise', parentPlan: 'Pro', parentTenantId: 'ten-reseller' },
    },
    {
      name: 'dunning-partner-customer-409.json',
      ...contract('dunning-partner-customer-409.json'),
      facts: { tenantId: 'pc1', partnerTenantId: 'p1' },
    },
    { name: 'invalidCurrency', ...currency.invalidCurrency, facts: { currency: 'banana' } },
    {
      name: 'currencyMismatch',
      ...currency.currencyMismatch,
      facts: { partnerCurrency: 'PEN', hostCurrency: 'USD' },
    },
  ];

  it.each(refusals)('should read the code and the facts of $name', ({ status, body, facts }) => {
    const err = new ApiError(status, body);
    expect(err.code).toBe(body.error);
    expect(err.facts).toEqual(facts);
    expect(Object.keys(err.facts)).not.toContain('error');
  });

  it('should keep a null fact and drop non-scalar fields', () => {
    const err = new ApiError(400, {
      error: 'currency-invalid',
      currency: null,
      nested: { a: 1 },
      list: [1],
      count: 2,
      flag: false,
    });
    expect(err.facts).toEqual({ currency: null, count: 2, flag: false });
  });

  it('should never put a prose error into the code or the facts', () => {
    const err = new ApiError(400, { error: 'Plan exceeds the parent plan', parentPlan: 'Pro' });
    expect(err.code).toBeNull();
    expect(err.facts).toEqual({ parentPlan: 'Pro' });
  });

  it('should have no facts when the body is not an object', () => {
    expect(new ApiError(500, null).facts).toEqual({});
    expect(new ApiError(500, 'oops').facts).toEqual({});
    expect(new ApiError(500, [1, 2]).facts).toEqual({});
  });
});

describe('describeApiError', () => {
  it('should choose the machine code first, whatever the action and status', () => {
    expect(describeApiError(new ApiError(403, { error: 'not-owner' }), MAP, 'hold')).toEqual({
      code: 'not-owner',
      key: 'errors.not_owner',
    });
    // A code wins over a status-per-action inference (ADR-0013 precedence).
    expect(describeApiError(new ApiError(400, { error: 'not-owner' }), MAP, 'hold').code).toBe(
      'not-owner',
    );
  });

  it('should use the status per action when there is no code', () => {
    const err = new ApiError(400, { error: 'Cannot hold conversation' });
    expect(describeApiError(err, MAP, 'hold').code).toBe('conflict');
    // The same answer without the action is the generic failure.
    expect(describeApiError(err, MAP).code).toBe('failed');
  });

  it('should fall through a rule that does not match', () => {
    expect(
      describeApiError(new ApiError(400, { errors: [{ field: 'f', message: 'm' }] }), MAP, 'typify')
        .code,
    ).toBe('typify-invalid');
    expect(
      describeApiError(new ApiError(400, { error: 'no typification schema bound' }), MAP, 'typify')
        .code,
    ).toBe('failed');
  });

  it('should use the status map, then the fallback', () => {
    expect(describeApiError(new ApiError(404, null), MAP, 'hold').code).toBe('not-found');
    expect(describeApiError(new ApiError(500, null), MAP, 'hold').code).toBe('failed');
  });

  it('should report an unknown machine code by status, never by the code itself', () => {
    expect(describeApiError(new ApiError(403, { error: 'some-new-code' }), MAP).code).toBe(
      'failed',
    );
  });

  it('should use the fallback for anything that is not an ApiError', () => {
    expect(describeApiError(new TypeError('Failed to fetch'), MAP).code).toBe('failed');
    expect(describeApiError(new Error('not-owner'), MAP).code).toBe('failed');
    expect(describeApiError(undefined, MAP).code).toBe('failed');
  });
});

describe('entriesOf', () => {
  it('should list the fallback and every static entry', () => {
    expect(
      entriesOf(MAP)
        .map((e) => e.code)
        .sort(),
    ).toEqual(['conflict', 'failed', 'not-found', 'not-owner'].sort());
  });
});
