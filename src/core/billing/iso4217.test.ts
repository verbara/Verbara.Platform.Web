import { describe, it, expect } from 'vitest';
import { ISO_4217_CODES, canonicalCurrency } from './iso4217';

describe('canonicalCurrency', () => {
  it.each([
    ['USD', 'USD'],
    ['EUR', 'EUR'],
    ['PEN', 'PEN'],
    ['usd', 'USD'],
    [' usd ', 'USD'],
  ])('should accept %j as %s', (input, expected) => {
    expect(canonicalCurrency(input)).toBe(expected);
  });

  it.each(['XYZ', 'banana', 'XYZ123', '', '   ', 'US', 'USDD', 'XTS', 'XXX', 'HRK', 'ANG'])(
    'should refuse %j',
    (input) => {
      expect(canonicalCurrency(input)).toBeNull();
    },
  );
});

describe('ISO_4217_CODES', () => {
  it('should hold only three-letter upper-case codes', () => {
    for (const code of ISO_4217_CODES) expect(code).toMatch(/^[A-Z]{3}$/);
  });

  it('should hold the 2025 List One revision this file names', () => {
    expect(ISO_4217_CODES.size).toBe(176);
    for (const code of ['XCG', 'ZWG', 'SLE', 'VED']) expect(ISO_4217_CODES.has(code)).toBe(true);
    for (const code of ['ZWL', 'SLL', 'HRK', 'ANG']) expect(ISO_4217_CODES.has(code)).toBe(false);
  });
});
