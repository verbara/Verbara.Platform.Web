// R5.1 Phase 2 Task Q — Rotate API Key dialog.
//
// Three-step flow:
//   1. Confirm intent via type-to-confirm ("ROTATE") — the backend *revokes*
//      the prior key in the same request, so we treat this as destructive.
//   2. POST /rotate → backend returns a new plaintext key.
//   3. Reveal panel (shared with CreateApiKeyDialog) — copy-once + dismiss.
//
// The backend returns the new plaintext in the rotate response (same contract
// as create). Dismissal is gated behind an explicit "I've copied" click so a
// stray Escape/backdrop click can't destroy the only way to recover the new
// key material.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import {
  Dialog,
  DialogContent,
} from '@/core/ui/dialog';
import { RevealPanel } from '@/admin/api-keys/create-api-key-dialog';
import {
  useRotateApiKey,
  type CreateApiKeyResponse,
  type ManagementApiKey,
} from '@/core/api/hooks/use-api-keys';

export interface RotateApiKeyDialogProps {
  /** Null closes the dialog; a key opens it in the confirm phase. */
  readonly target: ManagementApiKey | null;
  readonly onOpenChange: (open: boolean) => void;
}

export function RotateApiKeyDialog({ target, onOpenChange }: RotateApiKeyDialogProps) {
  const { t } = useTranslation(['admin']);
  const rotate = useRotateApiKey();

  // Two-phase UI state: while `reveal` is null we show ConfirmDeleteDialog
  // (which handles its own open/closed via the `open` boolean). Once rotate
  // succeeds we pivot to a new Dialog instance anchored to the reveal panel,
  // because ConfirmDeleteDialog doesn't know about the reveal flow.
  const [reveal, setReveal] = useState<CreateApiKeyResponse | null>(null);

  function handleConfirm() {
    if (!target) return;
    rotate.mutate(target.keyId, {
      onSuccess: (response) => {
        setReveal(response);
      },
    });
  }

  function handleRevealDismiss() {
    setReveal(null);
    onOpenChange(false);
  }

  // Confirm phase — shown while no reveal payload is available.
  if (!reveal) {
    return (
      <ConfirmDeleteDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) onOpenChange(false);
        }}
        onConfirm={handleConfirm}
        entityName={target?.name ?? ''}
        entityType={t('admin:api-keys.rotate_entity_type')}
        isPending={rotate.isPending}
        confirmationWord="ROTATE"
      />
    );
  }

  // Reveal phase — use a standalone Dialog so the gate-dismiss behaviour
  // (blocking Escape / backdrop click) is preserved exactly like create.
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) return; // block implicit dismiss
      }}
    >
      <DialogContent
        data-testid="rotate-api-key-reveal-dialog"
        className="sm:max-w-md"
      >
        <RevealPanel
          keyName={reveal.name}
          plaintextKey={reveal.apiKey}
          onDismiss={handleRevealDismiss}
        />
      </DialogContent>
    </Dialog>
  );
}
