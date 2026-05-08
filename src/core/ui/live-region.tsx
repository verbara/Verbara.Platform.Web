import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LiveRegionProps {
  readonly politeness?: 'polite' | 'assertive';
  readonly atomic?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

function LiveRegion({
  politeness = 'polite',
  atomic = true,
  children,
  className,
}: LiveRegionProps) {
  const role = politeness === 'assertive' ? 'alert' : 'status';
  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn('sr-only', className)}
    >
      {children}
    </div>
  );
}

export { LiveRegion };
export type { LiveRegionProps };
