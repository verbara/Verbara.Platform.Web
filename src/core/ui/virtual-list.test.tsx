import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualList } from './virtual-list';

describe('VirtualList', () => {
  /**
   * jsdom does not implement layout, so offsetHeight always returns 0.
   * The TanStack virtualizer reads offsetHeight from the scroll element via
   * observeElementRect (virtual-core/dist/esm/index.js:3) to determine the
   * visible viewport height. With height=0, it renders 0 rows.
   *
   * Fix: mock offsetHeight on HTMLElement.prototype to return 400 so the
   * virtualizer calculates a real viewport and renders visible + overscan rows.
   * This mirrors the 400px container height used in the render tree.
   */
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Renders_OnlyOverscanWindow_When10kItemsProvided', () => {
    const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `Row ${i}` }));
    const { container } = render(
      <div style={{ height: 400 }}>
        <VirtualList
          items={items}
          renderItem={(item) => <div>{item.label}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
        />
      </div>,
    );
    const renderedRows = container.querySelectorAll('[data-virtual-row]');
    expect(renderedRows.length).toBeLessThanOrEqual(30);
    expect(renderedRows.length).toBeGreaterThan(0);
  });
});
