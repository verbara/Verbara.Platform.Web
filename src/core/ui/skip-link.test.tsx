import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLink } from './skip-link';

describe('SkipLink', () => {
  it('Renders_AnchorWithHrefToTargetId', () => {
    const { container } = render(<SkipLink targetId="main-content">Skip to main</SkipLink>);
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a).toBeInTheDocument();
    expect(a.getAttribute('href')).toBe('#main-content');
    expect(a.textContent).toBe('Skip to main');
  });

  it('IsVisuallyHiddenByDefault_AndVisibleOnFocus', () => {
    const { container } = render(<SkipLink targetId="main-content">Skip</SkipLink>);
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a.className).toContain('sr-only');
    expect(a.className).toContain('focus:not-sr-only');
  });

  it('Merges_CustomClassName', () => {
    const { container } = render(
      <SkipLink targetId="main-content" className="custom-x">
        Skip
      </SkipLink>,
    );
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a.className).toContain('custom-x');
    expect(a.className).toContain('sr-only');
  });
});
