// Calendar months offered by the licensed-agents month selector (design D6): the current month and
// the 14 before it, 15 in all, newest first. Each month maps to the inclusive `from`/`to` days that
// both the peaks request and the export download carry, so the figure on screen and the file
// downloaded always describe the same month.

import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

/** How many calendar months the selector offers: the current one and the 14 before it. */
export const LICENSE_MONTH_COUNT = 15;

export interface LicenseMonth {
  /** `YYYY-MM`. */
  readonly value: string;
  /** The month's first day, `YYYY-MM-DD`. */
  readonly from: string;
  /** The month's last day, `YYYY-MM-DD`. */
  readonly to: string;
  /** The month's first day, for display formatting. */
  readonly start: Date;
}

export function licenseMonthOf(day: Date): LicenseMonth {
  const start = startOfMonth(day);
  return {
    value: format(start, 'yyyy-MM'),
    from: format(start, 'yyyy-MM-dd'),
    to: format(endOfMonth(start), 'yyyy-MM-dd'),
    start,
  };
}

/** The selectable months, newest (the month of `today`) first. */
export function recentLicenseMonths(today: Date, count = LICENSE_MONTH_COUNT): LicenseMonth[] {
  const current = startOfMonth(today);
  return Array.from({ length: count }, (_, i) => licenseMonthOf(subMonths(current, i)));
}

/** True when `month` contains `today`, i.e. its figure is still provisional. */
export function isMonthInProgress(month: LicenseMonth, today: Date): boolean {
  return month.value === format(today, 'yyyy-MM');
}
