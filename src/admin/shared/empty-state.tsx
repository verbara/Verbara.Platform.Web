import type { LucideIcon } from 'lucide-react';
import { Button } from '@/core/ui/button';

export interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16 dark:border-slate-600">
      <Icon className="mb-3 h-10 w-10 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
