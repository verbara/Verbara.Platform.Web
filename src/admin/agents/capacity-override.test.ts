import { describe, it, expect } from 'vitest';

import { toCapacityOverride, type CapacityFormGroup } from './capacity-override';

describe('toCapacityOverride', () => {
  it('toCapacityOverride_ShouldReturnAllNull_WhenInputUndefined', () => {
    const result = toCapacityOverride(undefined);
    expect(result).toEqual({
      maxVoice: null,
      maxChat: null,
      maxEmail: null,
      maxSms: null,
      maxTotal: null,
    });
  });

  it('toCapacityOverride_ShouldReturnAllNull_WhenAllFieldsNull', () => {
    const empty: CapacityFormGroup = {
      maxChat: null,
      maxEmail: null,
      maxSms: null,
      maxTotal: null,
    };
    expect(toCapacityOverride(empty)).toEqual({
      maxVoice: null,
      maxChat: null,
      maxEmail: null,
      maxSms: null,
      maxTotal: null,
    });
  });

  it('toCapacityOverride_ShouldCarryOnlySetField_WhenPartial', () => {
    const partial: CapacityFormGroup = {
      maxChat: 7,
      maxEmail: null,
      maxSms: null,
      maxTotal: null,
    };
    const result = toCapacityOverride(partial);
    expect(result.maxChat).toBe(7);
    expect(result.maxEmail).toBeNull();
    expect(result.maxSms).toBeNull();
    expect(result.maxTotal).toBeNull();
  });

  it('toCapacityOverride_ShouldAlwaysReturnNullMaxVoice_WhenFieldsSet', () => {
    const full: CapacityFormGroup = {
      maxChat: 3,
      maxEmail: 5,
      maxSms: 2,
      maxTotal: 8,
    };
    expect(toCapacityOverride(full).maxVoice).toBeNull();
  });

  it('toCapacityOverride_ShouldPreserveZero_WhenFieldExplicitlyZero', () => {
    const withZero: CapacityFormGroup = {
      maxChat: 0,
      maxEmail: null,
      maxSms: null,
      maxTotal: null,
    };
    // 0 is an explicit limit, not "inherit" — must survive the ?? null coalescing.
    expect(toCapacityOverride(withZero).maxChat).toBe(0);
  });
});
