import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('Renders_WithDefaultTextVariant', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('rounded-md');
  });

  it('Renders_CircularVariant', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
  });

  it('Renders_RectangularVariant', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
  });

  it('Merges_CustomClassName', () => {
    const { container } = render(<Skeleton className="h-10 w-40" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-10');
    expect(el.className).toContain('w-40');
  });

  it('Renders_AsDiv_WithNoContent', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild?.nodeName).toBe('DIV');
    expect(container.firstChild?.textContent).toBe('');
  });
});
