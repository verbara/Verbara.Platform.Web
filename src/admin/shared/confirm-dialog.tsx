import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
  'data-testid'?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel,
  variant = 'destructive',
  'data-testid': dataTestId = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { t } = useTranslation('admin');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={dataTestId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" data-testid="confirm-dialog-cancel" />}>
            {t('shared.confirm_dialog.cancel')}
          </DialogClose>
          <Button variant={variant} onClick={onConfirm} data-testid="confirm-dialog-confirm">
            {confirmLabel ?? t('shared.confirm_dialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
