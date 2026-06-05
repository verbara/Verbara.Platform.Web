import { useRef } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { LiveRegion } from '@/core/ui/live-region';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui/dialog';

export interface SessionWarningDialogProps {
  open: boolean;
  secondsLeft: number;
  onStayConnected: () => void;
  onSignOut: () => void;
}

/**
 * Presentational idle-warning alertdialog. Owns no timers and reads no store —
 * the parent drives `open`/`secondsLeft` and supplies the two action callbacks.
 *
 * The dialog is non-dismissible: the user MUST choose "Stay connected" or
 * "Sign out now". Because `open` is fully controlled by the parent and
 * `onOpenChange` is a no-op, base-ui's internal close requests (Escape key,
 * outside press, focus-out) cannot toggle the dialog shut.
 */
export function SessionWarningDialog({
  open,
  secondsLeft,
  onStayConnected,
  onSignOut,
}: SessionWarningDialogProps) {
  const { t } = useTranslation('common');
  const stayConnectedRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      // Non-dismissible: ignore every close request so neither Escape, an
      // outside press, nor focus-out can close it. Only the action buttons,
      // via the parent flipping `open`, may dismiss the dialog.
      onOpenChange={() => {}}
      disablePointerDismissal
    >
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        initialFocus={stayConnectedRef}
        className="motion-reduce:transition-none motion-reduce:animate-none sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle>{t('session.warning.title')}</DialogTitle>
          </div>
          <DialogDescription>{t('session.warning.description')}</DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium tabular-nums" data-testid="session-warning-countdown">
          {t('session.warning.countdown', { seconds: secondsLeft })}
        </p>

        <LiveRegion politeness="assertive">
          {t('session.warning.srCountdown', { seconds: secondsLeft })}
        </LiveRegion>

        <DialogFooter>
          <Button variant="outline" onClick={onSignOut}>
            {t('session.warning.signOutNow')}
          </Button>
          <Button ref={stayConnectedRef} onClick={onStayConnected}>
            {t('session.warning.stayConnected')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
