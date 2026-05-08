import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly estimateSize: (index: number) => number;
  readonly getItemKey?: (item: T, index: number) => string | number;
  readonly overscan?: number;
  readonly className?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  getItemKey,
  overscan = 5,
  className,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    getItemKey: getItemKey ? (i) => getItemKey(items[i] as T, i) : undefined,
  });

  return (
    <div ref={parentRef} className={cn('h-full overflow-auto', className)}>
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
