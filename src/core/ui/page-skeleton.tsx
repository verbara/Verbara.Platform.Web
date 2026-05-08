import { Skeleton } from '@/core/ui/skeleton';

type PageSkeletonVariant = 'table' | 'cards' | 'form';

interface PageSkeletonProps {
  readonly variant?: PageSkeletonVariant;
  readonly rows?: number;
  readonly columns?: number;
}

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Header row */}
      <div data-slot="skeleton-row" className="flex gap-4 border-b bg-muted/30 px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${20 + (i % 3) * 10}%` }} />
        ))}
      </div>
      {/* Content rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          data-slot="skeleton-row"
          className="flex gap-4 border-b px-4 py-3 last:border-0"
        >
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={j} className="h-4" style={{ width: `${25 + ((i + j) % 3) * 8}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="rectangular" className="h-28" />
      ))}
    </div>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="max-w-lg space-y-6">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} data-slot="skeleton-field" className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton({ variant = 'table', rows = 5, columns = 3 }: PageSkeletonProps) {
  return (
    <div data-testid="page-skeleton" data-variant={variant}>
      {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
      {variant === 'cards' && <CardsSkeleton count={rows} />}
      {variant === 'form' && <FormSkeleton rows={rows} />}
    </div>
  );
}

export { PageSkeleton };
export type { PageSkeletonProps };
