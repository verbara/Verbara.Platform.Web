import { useState, useEffect, useCallback } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  entityName: string;
  entityType: string;
  isPending?: boolean;
  /**
   * When set, the user must type this literal word (case-sensitive) into a
   * text input instead of waiting out the countdown. Useful for destructive
   * actions where a specific keyword — e.g. "FORCE" — signals intent more
   * deliberately than a typed entity name.
   * When unset, the default 3-second countdown gate applies.
   */
  confirmationWord?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  entityName,
  entityType,
  isPending = false,
  confirmationWord,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation('common');
  const useWord = typeof confirmationWord === 'string' && confirmationWord.length > 0;
  const [countdown, setCountdown] = useState(3);
  const [typed, setTyped] = useState('');

  // Manage countdown timer + reset state when dialog closes. Legitimate because
  // (a) the parent controls `open` so reset must respond to a prop change, and
  // (b) the timer-driven countdown is genuinely effectful.
  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setCountdown(3);
      setTyped('');
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    if (useWord) return; // word-gate path, no timer
    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [open, countdown, useWord]);

  const wordMatches = useWord && typed === confirmationWord;

  const handleConfirm = useCallback(() => {
    if (isPending) return;
    if (useWord) {
      if (!wordMatches) return;
    } else if (countdown > 0) {
      return;
    }
    onConfirm();
  }, [countdown, isPending, onConfirm, useWord, wordMatches]);

  const deleteDisabled = isPending || (useWord ? !wordMatches : countdown > 0);

  const computeButtonLabel = (): string => {
    if (isPending) return t('confirm_delete_dialog.deleting');
    if (!useWord && countdown > 0)
      return t('confirm_delete_dialog.wait_seconds', { seconds: countdown });
    return t('confirm_delete_dialog.delete');
  };
  const buttonLabel = computeButtonLabel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <TriangleAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle>{t('confirm_delete_dialog.title', { entityType })}</DialogTitle>
          </div>
          <DialogDescription>
            {t('confirm_delete_dialog.description_prefix')}
            <strong>&ldquo;{entityName}&rdquo;</strong>
            {t('confirm_delete_dialog.description_suffix')}
          </DialogDescription>
        </DialogHeader>
        {useWord && (
          <div className="space-y-2">
            <Label htmlFor="confirm-delete-word-input" className="text-xs">
              {t('confirm_delete_dialog.type_to_confirm_prefix')}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {confirmationWord}
              </code>
              {t('confirm_delete_dialog.type_to_confirm_suffix')}
            </Label>
            <Input
              id="confirm-delete-word-input"
              data-testid="confirm-delete-word-input"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={typed.length > 0 && !wordMatches}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t('confirm_delete_dialog.cancel')}
          </DialogClose>
          <Button
            variant="destructive"
            data-testid="confirm-delete-btn"
            onClick={handleConfirm}
            disabled={deleteDisabled}
          >
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
