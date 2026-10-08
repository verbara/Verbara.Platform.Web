import { describe, it, expect } from 'vitest';

import {
  LICENSE_MONTH_COUNT,
  isMonthInProgress,
  licenseMonthOf,
  recentLicenseMonths,
} from './license-months';

describe('license months', () => {
  const today = new Date(2026, 9, 8, 12, 0, 0); // 8 October 2026, local time

  it('RecentLicenseMonths_ShouldOfferFifteenMonths_WhenCountDefaulted', () => {
    const months = recentLicenseMonths(today);
    expect(LICENSE_MONTH_COUNT).toBe(15);
    expect(months).toHaveLength(15);
    expect(months[0]!.value).toBe('2026-10');
    expect(months[1]!.value).toBe('2026-09');
    expect(months[14]!.value).toBe('2025-08');
  });

  it('LicenseMonthOf_ShouldSpanFirstToLastDay_WhenGivenAnyDayOfTheMonth', () => {
    expect(licenseMonthOf(new Date(2026, 8, 17))).toMatchObject({
      value: '2026-09',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(licenseMonthOf(new Date(2028, 1, 10))).toMatchObject({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });

  it('IsMonthInProgress_ShouldBeTrueOnlyForTheCurrentMonth_WhenComparedWithToday', () => {
    const [current, previous] = recentLicenseMonths(today);
    expect(isMonthInProgress(current!, today)).toBe(true);
    expect(isMonthInProgress(previous!, today)).toBe(false);
  });
});
