import { describe, it, expect } from 'vitest';
import enAdmin from '../../../public/locales/en-US/admin.json';
import esAdmin from '../../../public/locales/es-419/admin.json';
import ptAdmin from '../../../public/locales/pt-BR/admin.json';
import {
  ACCOUNT_STATUSES,
  UNKNOWN_DATA_STATUS,
  accountStatusBadgeVariant,
  accountStatusDataAttribute,
  accountStatusLabelKey,
  describeAccountStatus,
  normalizeAccountStatus,
} from './account-status';

function lookup(tree: unknown, dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      tree,
    );
}

describe('account-status', () => {
  it('ACCOUNT_STATUSES_ShouldListTheThreeEnumNames_InFormOrder', () => {
    expect(ACCOUNT_STATUSES).toEqual(['Active', 'Suspended', 'Deactivated']);
  });

  it.each([
    ['active', 'Active'],
    ['ACTIVE', 'Active'],
    ['Active', 'Active'],
    ['suspended', 'Suspended'],
    ['SuSpEnDeD', 'Suspended'],
    ['Suspended', 'Suspended'],
    ['deactivated', 'Deactivated'],
    ['DEACTIVATED', 'Deactivated'],
    ['deActivated', 'Deactivated'],
    ['  suspended  ', 'Suspended'],
  ] as const)('normalizeAccountStatus_ShouldReturnEnumName_WhenValueIs %j', (raw, expected) => {
    expect(normalizeAccountStatus(raw)).toBe(expected);
  });

  it.each(['inactive', 'pending', 'activ', 'active!', 'Active Suspended'])(
    'normalizeAccountStatus_ShouldReturnUndefined_WhenValueIsUnknown %j',
    (raw) => {
      expect(normalizeAccountStatus(raw)).toBeUndefined();
    },
  );

  it.each(['', '   ', null, undefined])(
    'normalizeAccountStatus_ShouldReturnUndefined_WhenValueIsEmpty %j',
    (raw) => {
      expect(normalizeAccountStatus(raw)).toBeUndefined();
    },
  );

  it('accountStatusBadgeVariant_ShouldGiveEachKnownStatusADistinctVariant_AndUnknownTheNeutralOne', () => {
    const variants = ACCOUNT_STATUSES.map(accountStatusBadgeVariant);
    expect(variants).toEqual(['default', 'secondary', 'destructive']);
    expect(new Set(variants).size).toBe(ACCOUNT_STATUSES.length);
    expect(accountStatusBadgeVariant(undefined)).toBe('outline');
    expect(variants).not.toContain('outline');
  });

  it('accountStatusDataAttribute_ShouldBeCanonicalLowerCase_AndUnknownForAnUnknownStatus', () => {
    expect(ACCOUNT_STATUSES.map(accountStatusDataAttribute)).toEqual([
      'active',
      'suspended',
      'deactivated',
    ]);
    expect(accountStatusDataAttribute(undefined)).toBe(UNKNOWN_DATA_STATUS);
  });

  it('accountStatusLabelKey_ShouldResolveInEveryLocale_WhenStatusIsKnown', () => {
    for (const status of ACCOUNT_STATUSES) {
      const key = accountStatusLabelKey(status);
      expect(key.startsWith('admin:')).toBe(true);
      const path = key.slice('admin:'.length);
      for (const locale of [enAdmin, esAdmin, ptAdmin]) {
        const value = lookup(locale, path);
        expect(typeof value, `${path} in a locale`).toBe('string');
        expect(value).not.toBe('');
      }
    }
  });

  it('describeAccountStatus_ShouldDeriveEveryField_WhenStatusIsKnownInAnyCase', () => {
    expect(describeAccountStatus('SUSPENDED')).toEqual({
      status: 'Suspended',
      labelKey: 'admin:users.statuses.suspended',
      badgeVariant: 'secondary',
      dataStatus: 'suspended',
    });
  });

  it('describeAccountStatus_ShouldFallBackToNeutral_WhenStatusIsUnknownOrEmpty', () => {
    const neutral = {
      status: undefined,
      labelKey: undefined,
      badgeVariant: 'outline',
      dataStatus: UNKNOWN_DATA_STATUS,
    };
    expect(describeAccountStatus('inactive')).toEqual(neutral);
    expect(describeAccountStatus('')).toEqual(neutral);
  });
});
