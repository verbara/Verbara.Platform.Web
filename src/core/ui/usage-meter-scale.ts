// The usage/limit scale behind `UsageMeter` (see usage-meter.tsx for the two tones).

export type UsageMeterTone = 'quota' | 'advisory';

/** The bar's fill as a percentage of `limit`, clamped to 0–100. */
export function usagePercent(value: number, limit: number): number {
  if (!(limit > 0)) return 0;
  return Math.max(0, Math.min(100, (value / limit) * 100));
}

/** The fill colour class for a percentage under a tone. */
export function usageColor(pct: number, tone: UsageMeterTone = 'quota'): string {
  if (tone === 'quota' && pct >= 90) return 'bg-destructive';
  if (pct >= 70) return 'bg-warning';
  return 'bg-brand';
}
