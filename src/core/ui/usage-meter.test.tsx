import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { UsageMeter } from './usage-meter';
import { usageColor, usagePercent } from './usage-meter-scale';

describe('UsageMeter', () => {
  it('UsagePercent_ShouldClampToHundred_WhenValueExceedsLimit', () => {
    expect(usagePercent(47, 50)).toBe(94);
    expect(usagePercent(60, 50)).toBe(100);
    expect(usagePercent(5, 0)).toBe(0);
  });

  it('UsageColor_ShouldKeepTheQuotaScale_WhenToneIsQuota', () => {
    expect(usageColor(50)).toBe('bg-brand');
    expect(usageColor(70)).toBe('bg-warning');
    expect(usageColor(90)).toBe('bg-destructive');
  });

  it('UsageColor_ShouldNeverBeDestructive_WhenToneIsAdvisory', () => {
    expect(usageColor(50, 'advisory')).toBe('bg-brand');
    expect(usageColor(70, 'advisory')).toBe('bg-warning');
    expect(usageColor(100, 'advisory')).toBe('bg-warning');
  });

  it('Render_ShouldExposeMeterSemantics_WhenGivenValueAndLimit', () => {
    render(<UsageMeter value={47} limit={50} tone="advisory" label="band" data-testid="m" />);
    const meter = screen.getByTestId('m');
    expect(meter).toHaveAttribute('role', 'meter');
    expect(meter).toHaveAttribute('aria-valuenow', '47');
    expect(meter).toHaveAttribute('aria-valuemax', '50');
    expect(meter).toHaveAttribute('data-tone', 'advisory');
    const fill = meter.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('94%');
    expect(fill.className).toContain('bg-warning');
    expect(fill.className).not.toContain('bg-destructive');
  });
});
