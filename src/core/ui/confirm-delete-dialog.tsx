import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
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
  const useWord = typeof confirmationWord === 'string' && confirmationWord.length > 0;
  const [countdown, setCountdown] = useState(3);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) {
      setCountdown(3);
      setTyped('');
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
    if (isPending) return 'Deleting...';
    if (!useWord && countdown > 0) return `Wait ${countdown}s...`;
    return 'Delete';
  };
  const buttonLabel = computeButtonLabel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle>Delete {entityType}?</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to delete <strong>&ldquo;{entityName}&rdquo;</strong>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {useWord && (
          <div className="space-y-2">
            <Label htmlFor="confirm-delete-word-input" className="text-xs">
              Type{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {confirmationWord}
              </code>{' '}
              to confirm.
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
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
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
