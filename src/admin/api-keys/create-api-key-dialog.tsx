// R5.1 Phase 2 Task Q — Create API Key dialog.
//
// Two-phase dialog: (1) the form, (2) the one-time reveal.
//
// Security model: the plaintext key is returned ONLY by the create mutation
// response. The moment the user dismisses the reveal phase, the plaintext is
// dropped from component state and cannot be surfaced again — rotation is the
// only path to obtain a working key for an existing `keyId`. The reveal
// therefore gates dismissal behind an explicit "I've copied the key" click so
// a stray Escape or backdrop click doesn't silently throw away the key.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { CopyButton } from '@/core/ui/copy-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/ui/dialog';
import {
  useCreateApiKey,
  type CreateApiKeyResponse,
} from '@/core/api/hooks/use-api-keys';

export interface CreateApiKeyDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

type Phase = 'form' | 'reveal';

// Curated expiration options — keep the picker simple. Matches the backend
// `ExpiresInDays` int contract: a non-null value here means the key expires,
// `null` means perpetual.
const EXPIRATION_CHOICES: ReadonlyArray<{ days: number | null; labelKey: string }> = [
  { days: 30, labelKey: 'admin:api-keys.expiration.30_days' },
  { days: 90, labelKey: 'admin:api-keys.expiration.90_days' },
  { days: 365, labelKey: 'admin:api-keys.expiration.365_days' },
  { days: null, labelKey: 'admin:api-keys.expiration.never' },
];

export function CreateApiKeyDialog({ open, onOpenChange }: CreateApiKeyDialogProps) {
  const { t } = useTranslation(['admin']);
  const create = useCreateApiKey();

  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [expirationIndex, setExpirationIndex] = useState(1); // default 90 days
  const [reveal, setReveal] = useState<CreateApiKeyResponse | null>(null);

  // Form state is reset in `handleOpenChange` below on the transition
  // open → closed (when not in reveal phase), which gives us a clean form
  // the next time the dialog opens without needing a post-render effect.

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const expiresInDays = EXPIRATION_CHOICES[expirationIndex]?.days ?? null;
    create.mutate(
      { name: name.trim(), expiresInDays: expiresInDays ?? undefined },
      {
        onSuccess: (response) => {
          setReveal(response);
          setPhase('reveal');
        },
      },
    );
  }

  // Dismisses the reveal phase and resets back to the form state. The
  // plaintext key is cleared from component state in the same tick to
  // minimize the window any in-memory snapshot could capture it.
  function handleRevealDismiss() {
    setReveal(null);
    setPhase('form');
    onOpenChange(false);
  }

  // During the reveal phase we gate external dismissals (Escape, backdrop
  // click) to prevent accidental key loss. The only way out is the explicit
  // "I've copied" button which routes through `handleRevealDismiss`.
  function handleOpenChange(next: boolean) {
    if (phase === 'reveal' && !next) return; // block implicit dismiss
    if (!next) {
      // Closing from the form phase — reset inputs so a reopen starts fresh.
      setPhase('form');
      setReveal(null);
      setName('');
      setExpirationIndex(1);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="create-api-key-dialog"
        className="sm:max-w-md"
      >
        {phase === 'form' ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t('admin:api-keys.create_title')}</DialogTitle>
              <DialogDescription>
                {t('admin:api-keys.create_description')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="api-key-name">
                  {t('admin:api-keys.name_label')}
                </Label>
                <Input
                  id="api-key-name"
                  data-testid="api-key-name-input"
                  autoComplete="off"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('admin:api-keys.name_placeholder')}
                />
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">
                  {t('admin:api-keys.expiration_label')}
                </legend>
                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label={t('admin:api-keys.expiration_label')}
                >
                  {EXPIRATION_CHOICES.map((choice, idx) => {
                    const selected = idx === expirationIndex;
                    return (
                      <label
                        key={choice.labelKey}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                          selected
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name="api-key-expiration"
                          className="sr-only"
                          checked={selected}
                          onChange={() => setExpirationIndex(idx)}
                          data-testid={`api-key-expires-${choice.days ?? 'never'}`}
                        />
                        {t(choice.labelKey)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="create-api-key-cancel"
              >
                {t('admin:api-keys.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || create.isPending}
                data-testid="create-api-key-submit"
              >
                {create.isPending
                  ? t('admin:api-keys.creating')
                  : t('admin:api-keys.create')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          reveal && (
            <RevealPanel
              keyName={reveal.name}
              plaintextKey={reveal.apiKey}
              onDismiss={handleRevealDismiss}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Reveal panel ────────────────────────────────────────────────────────────

// Shared between CreateApiKeyDialog and RotateApiKeyDialog. Hoisting it here
// keeps the "seen-once" warning copy + CopyButton layout in a single place so
// both surfaces stay consistent.
export interface RevealPanelProps {
  readonly keyName: string;
  readonly plaintextKey: string;
  readonly onDismiss: () => void;
}

export function RevealPanel({ keyName, plaintextKey, onDismiss }: RevealPanelProps) {
  const { t } = useTranslation(['admin']);
  return (
    <div data-testid="api-key-reveal-panel">
      <DialogHeader>
        <DialogTitle>{t('admin:api-keys.reveal_title')}</DialogTitle>
        <DialogDescription>
          {t('admin:api-keys.reveal_description', { name: keyName })}
        </DialogDescription>
      </DialogHeader>

      <div
        className="my-4 flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
        data-testid="api-key-reveal-warning"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('admin:api-keys.reveal_warning')}</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-key-reveal-value">
          {t('admin:api-keys.key_label')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="api-key-reveal-value"
            data-testid="api-key-reveal-value"
            readOnly
            value={plaintextKey}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton
            value={plaintextKey}
            label={t('admin:api-keys.copy')}
            size="sm"
            variant="outline"
          />
        </div>
      </div>

      <DialogFooter className="mt-4">
        <Button
          type="button"
          onClick={onDismiss}
          data-testid="api-key-reveal-dismiss"
        >
          {t('admin:api-keys.reveal_dismiss')}
        </Button>
      </DialogFooter>
    </div>
  );
}
