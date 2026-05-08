import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

interface LoadingOverlayProps {
  readonly active: boolean;
  readonly children: ReactNode;
}

function LoadingOverlay({ active, children }: LoadingOverlayProps) {
  if (!active) return children;

  return (
    <div className="relative">
      {children}
      <div
        data-testid="loading-overlay"
        role="status"
        aria-label="Loading"
        className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
      >
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

export { LoadingOverlay };
