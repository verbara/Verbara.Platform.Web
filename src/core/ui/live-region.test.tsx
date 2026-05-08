import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveRegion } from './live-region';

describe('LiveRegion', () => {
  it('DefaultsTo_PoliteRoleStatus', () => {
    const { container } = render(<LiveRegion>hello</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('role')).toBe('status');
    expect(div.getAttribute('aria-live')).toBe('polite');
    expect(div.getAttribute('aria-atomic')).toBe('true');
  });

  it('Maps_AssertivePoliteness_ToRoleAlert', () => {
    const { container } = render(<LiveRegion politeness="assertive">err</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('role')).toBe('alert');
    expect(div.getAttribute('aria-live')).toBe('assertive');
  });

  it('Allows_NonAtomic_WhenAtomicFalse', () => {
    const { container } = render(<LiveRegion atomic={false}>x</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('aria-atomic')).toBe('false');
  });

  it('IsScreenReaderOnly_ByDefault', () => {
    const { container } = render(<LiveRegion>x</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('sr-only');
  });

  it('Merges_CustomClassName_WithSrOnly', () => {
    const { container } = render(<LiveRegion className="extra">x</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('extra');
    expect(div.className).toContain('sr-only');
  });
});
