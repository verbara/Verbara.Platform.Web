import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SkipLinkProps {
  readonly targetId: string;
  readonly children: ReactNode;
  readonly className?: string;
}

function SkipLink({ targetId, children, className }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50',
        'focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:shadow',
        className,
      )}
    >
      {children}
    </a>
  );
}

export { SkipLink };
export type { SkipLinkProps };
