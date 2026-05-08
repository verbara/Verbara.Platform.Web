import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button disabled contrast', () => {
  it('Disabled_DoesNotApply_OpacityFifty', () => {
    const { container } = render(<Button disabled>Click</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).not.toContain('opacity-50');
  });

  it('Disabled_Applies_MutedBackgroundAndForeground', () => {
    const { container } = render(<Button disabled>Click</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('disabled:bg-muted');
    expect(btn.className).toContain('disabled:text-muted-foreground');
  });
});
