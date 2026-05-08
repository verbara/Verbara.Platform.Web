import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef } from 'react';
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
  readonly onEndReached?: () => void;
  readonly onStartReached?: () => void;
}

const NEAR_BOTTOM_THRESHOLD_PX = 50;
const END_REACHED_THRESHOLD_PX = 200;

function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  getItemKey,
  overscan = 5,
  className,
  stickToBottom = false,
  onEndReached,
  onStartReached,
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
    let firedEnd = false;
    let firedStart = false;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
      if (onEndReached && distanceFromBottom <= END_REACHED_THRESHOLD_PX) {
        if (!firedEnd) {
          firedEnd = true;
          onEndReached();
        }
      } else {
        firedEnd = false;
      }
      if (onStartReached && el.scrollTop <= END_REACHED_THRESHOLD_PX) {
        if (!firedStart) {
          firedStart = true;
          onStartReached();
        }
      } else {
        firedStart = false;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onEndReached, onStartReached]);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = parentRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, [items.length, stickToBottom]);

  const prevFirstKeyRef = useRef<string | number | undefined>(undefined);
  const prevScrollHeightRef = useRef<number>(0);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    let firstKey: string | number | undefined;
    if (items.length === 0) {
      firstKey = undefined;
    } else if (getItemKey) {
      firstKey = getItemKey(items[0] as T, 0);
    } else {
      firstKey = 0;
    }
    const prevFirstKey = prevFirstKeyRef.current;
    const prevScrollHeight = prevScrollHeightRef.current;
    if (
      prevFirstKey !== undefined &&
      firstKey !== undefined &&
      firstKey !== prevFirstKey &&
      prevScrollHeight > 0
    ) {
      const delta = el.scrollHeight - prevScrollHeight;
      if (delta > 0) {
        el.scrollTop = el.scrollTop + delta;
      }
    }
    prevFirstKeyRef.current = firstKey;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [items, getItemKey]);

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
