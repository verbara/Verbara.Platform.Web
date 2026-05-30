import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: 'rounded-md h-4 w-full',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
};

interface SkeletonProps {
  readonly className?: string;
  readonly variant?: SkeletonVariant;
  readonly style?: React.CSSProperties;
}

function Skeleton({ className, variant = 'text', style }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      // <output> isn't semantically correct here (it expects a `for` form
      // association for calculation outputs); aria-live status div is the
      // canonical SR-friendly skeleton placeholder pattern.
      role="status"
      aria-busy="true"
      className={cn('animate-pulse bg-muted', VARIANT_CLASSES[variant], className)}
      style={style}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

export { Skeleton };
