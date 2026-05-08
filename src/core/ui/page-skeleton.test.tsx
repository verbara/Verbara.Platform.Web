import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton } from './page-skeleton';

describe('PageSkeleton', () => {
  it('Renders_TableVariantByDefault', () => {
    const { container } = render(<PageSkeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.dataset.testid).toBe('page-skeleton');
    expect(el.dataset.variant).toBe('table');
  });

  it('Renders_DefaultFiveRows_ForTable', () => {
    const { container } = render(<PageSkeleton />);
    const rows = container.querySelectorAll('[data-slot="skeleton-row"]');
    // 1 header row + 5 content rows
    expect(rows.length).toBe(6);
  });

  it('Renders_CustomRowCount_ForTable', () => {
    const { container } = render(<PageSkeleton rows={3} />);
    const rows = container.querySelectorAll('[data-slot="skeleton-row"]');
    // 1 header row + 3 content rows
    expect(rows.length).toBe(4);
  });

  it('Renders_CardsVariant', () => {
    const { container } = render(<PageSkeleton variant="cards" />);
    const el = container.firstChild as HTMLElement;
    expect(el.dataset.variant).toBe('cards');
    const cards = container.querySelectorAll('[data-slot="skeleton"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('Renders_FormVariant', () => {
    const { container } = render(<PageSkeleton variant="form" />);
    const el = container.firstChild as HTMLElement;
    expect(el.dataset.variant).toBe('form');
    const fields = container.querySelectorAll('[data-slot="skeleton-field"]');
    expect(fields.length).toBe(5);
  });

  it('Renders_CustomRowCount_ForForm', () => {
    const { container } = render(<PageSkeleton variant="form" rows={3} />);
    const fields = container.querySelectorAll('[data-slot="skeleton-field"]');
    expect(fields.length).toBe(3);
  });
});
