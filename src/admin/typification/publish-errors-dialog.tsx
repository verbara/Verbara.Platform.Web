import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/core/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import type { PublishError } from '@/core/api/hooks/use-typification';

interface PublishErrorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schemaName: string;
  errors: PublishError[];
}

export function PublishErrorsDialog({
  open,
  onOpenChange,
  schemaName,
  errors,
}: PublishErrorsDialogProps) {
  const { t } = useTranslation(['admin']);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="publish-errors-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <TriangleAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle>{t('admin:typification.publish.errorsTitle')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('admin:typification.publish.errorsDescription', { name: schemaName })}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-72 space-y-2 overflow-y-auto" data-testid="publish-errors-list">
          {errors.map((err, i) => (
            <li
              key={`${err.field}-${i}`}
              className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm"
              data-testid="publish-error-item"
            >
              {err.field && (
                <span className="mr-1 font-mono text-xs font-medium text-destructive">
                  {err.field}
                </span>
              )}
              <span className="text-foreground">{err.message}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t('admin:typification.publish.close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
