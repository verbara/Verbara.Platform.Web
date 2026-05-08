import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly estimateSize: (index: number) => number;
  readonly getItemKey?: (item: T, index: number) => string | number;
  readonly overscan?: number;
  readonly className?: string;
  readonly stickToBottom?: boolean;
}

const NEAR_BOTTOM_THRESHOLD_PX = 50;

function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  getItemKey,
  overscan = 5,
  className,
  stickToBottom = false,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    getItemKey: getItemKey ? (i) => getItemKey(items[i] as T, i) : undefined,
  });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = parentRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, [items.length, stickToBottom]);

  return (
    <div ref={parentRef} data-virtual-scroller className={cn('h-full overflow-auto', className)}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index] as T;
          return (
            <div
              key={virtualItem.key}
              data-virtual-row
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { VirtualList };
export type { VirtualListProps };
