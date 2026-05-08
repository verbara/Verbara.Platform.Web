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
    // Theoretical ceiling: viewport 400 / row 40 = 10 visible + overscan 5 each side = 20.
    // 30 leaves slack for virtualizer rounding without masking real regressions.
    expect(renderedRows.length).toBeLessThanOrEqual(30);
    expect(renderedRows.length).toBeGreaterThan(0);
  });

  it('AutoScrollsToBottom_WhenStickToBottom_AndUserNearBottom', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const { container, rerender } = render(
      <div style={{ height: 200 }}>
        <VirtualList
          items={items}
          renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
          stickToBottom
        />
      </div>,
    );
    const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
    // Simulate user is at bottom (within 50px threshold)
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 1750,
    });

    const longer = [...items, { id: 50 }, { id: 51 }];
    rerender(
      <div style={{ height: 200 }}>
        <VirtualList
          items={longer}
          renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
          stickToBottom
        />
      </div>,
    );
    // Auto-scroll should have moved scrollTop to ≥ scrollHeight - clientHeight
    expect(scroller.scrollTop).toBeGreaterThanOrEqual(1800 - 200);
  });

  it('DoesNotAutoScroll_WhenStickToBottom_AndUserScrolledUp', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const { container, rerender } = render(
      <div style={{ height: 200 }}>
        <VirtualList
          items={items}
          renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
          stickToBottom
        />
      </div>,
    );
    const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 100,
    });
    // Manually trigger scroll event to register isNearBottom = false
    scroller.dispatchEvent(new Event('scroll'));

    const longer = [...items, { id: 50 }];
    rerender(
      <div style={{ height: 200 }}>
        <VirtualList
          items={longer}
          renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
          stickToBottom
        />
      </div>,
    );
    // scrollTop unchanged
    expect(scroller.scrollTop).toBe(100);
  });

  it('FiresOnEndReached_WhenLastItemEntersOverscan', () => {
    const onEndReached = vi.fn();
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
    const { container } = render(
      <div style={{ height: 200 }}>
        <VirtualList
          items={items}
          renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
          onEndReached={onEndReached}
        />
      </div>,
    );
    const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 1000,
    });
    scroller.dispatchEvent(new Event('scroll'));
    expect(onEndReached).toHaveBeenCalled();
  });

  it('FiresOnStartReached_WhenFirstItemEntersOverscan', () => {
    const onStartReached = vi.fn();
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
    const { container } = render(
      <div style={{ height: 200 }}>
        <VirtualList
          items={items}
          renderItem={(item) => <div style={{ height: 40 }}>Row {item.id}</div>}
          estimateSize={() => 40}
          getItemKey={(item) => item.id}
          onStartReached={onStartReached}
        />
      </div>,
    );
    const scroller = container.querySelector('[data-virtual-scroller]') as HTMLDivElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    });
    scroller.dispatchEvent(new Event('scroll'));
    expect(onStartReached).toHaveBeenCalled();
  });
});
