import { useId, useState } from 'react';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useUpdateChannel,
  type ChannelConfig,
  type ChannelCredentialUpdate,
} from '@/core/api/hooks/use-channels';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { generateIdentitySecret } from './identity-secret';

type PendingConfirm = 'rotate' | 'revoke' | 'turn-off';

interface IdentitySecretSectionProps {
  /** The tenant's WebChat channel; `undefined` until it has answered. */
  readonly channel: ChannelConfig | undefined;
  /** The read failed and nothing was loaded, so the section cannot tell what is stored. */
  readonly unreadable: boolean;
}

/**
 * Sets, rotates and revokes the secret that signs a site's WebChat identity tokens, through the channel route.
 *
 * What is stored comes only from `credentials[].isSet`, which says a key holds a value and nothing more: Platform
 * keeps a previous secret after its 24 hours and stops trying it, so this section says one is stored, never that it
 * works, and shows no end time. A generated value lives only in this component's state: it is dropped on a save, on
 * cancel and on unmount. A refused save keeps it, since nothing was stored and the admin may already have copied it.
 */
export function IdentitySecretSection({ channel, unreadable }: IdentitySecretSectionProps) {
  const { t } = useTranslation('admin');
  const update = useUpdateChannel();
  const [draft, setDraft] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const valueId = useId();

  if (!channel) {
    if (!unreadable) return null;
    return (
      <section className="rounded-lg border bg-card p-6 space-y-2">
        <h2 className="font-medium">{t('webchat.identity.title')}</h2>
        <p className="text-sm text-muted-foreground" data-identity-secret-unavailable>
          {t('webchat.identity.unavailable')}
        </p>
      </section>
    );
  }

  const isSet = (key: string) => channel.credentials.some((c) => c.key === key && c.isSet);
  const secretSet = isSet('identityTokenSecret');
  const previousSet = isSet('identityTokenSecretPrevious');

  const send = (credentials: ChannelCredentialUpdate, onSaved?: () => void) => {
    update.mutate(
      { channelId: 'webchat', isActive: channel.isActive, credentials },
      {
        onSuccess: onSaved,
        // The hook's result keeps the request it sent until it is reset, value included.
        onSettled: () => update.reset(),
      },
    );
  };

  const saveDraft = () => {
    if (draft !== null) send({ identityTokenSecret: draft }, () => setDraft(null));
  };

  const confirmPending = () => {
    if (pendingConfirm === 'rotate') saveDraft();
    if (pendingConfirm === 'revoke') send({ identityTokenSecretPrevious: null });
    if (pendingConfirm === 'turn-off') {
      send({ identityTokenSecret: null, identityTokenSecretPrevious: null });
    }
    setPendingConfirm(null);
  };

  return (
    <section className="rounded-lg border bg-card p-6 space-y-4" data-identity-secret-section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          {t('webchat.identity.title')}
        </h2>
        <Badge
          variant={secretSet ? 'default' : 'secondary'}
          data-identity-secret-status={secretSet ? 'configured' : 'not-configured'}
        >
          {t(
            secretSet
              ? 'webchat.identity.status_configured'
              : 'webchat.identity.status_not_configured',
          )}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t('webchat.identity.description')}</p>

      {previousSet && (
        <div
          role="status"
          data-identity-secret-previous
          className="rounded-md border px-4 py-3 text-sm space-y-1"
        >
          <p className="font-medium">{t('webchat.identity.previous_stored')}</p>
          <p className="text-muted-foreground">{t('webchat.identity.previous_explanation')}</p>
        </div>
      )}

      {draft !== null ? (
        <div className="space-y-3" data-identity-secret-draft>
          <div
            data-identity-secret-warning
            className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1">{t('webchat.identity.draft_warning')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={valueId}>{t('webchat.identity.draft_label')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={valueId}
                readOnly
                value={draft}
                autoComplete="off"
                spellCheck={false}
                data-identity-secret-value
                className="font-mono text-xs"
              />
              <div data-identity-secret-copy>
                <CopyButton value={draft} variant="outline" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => setDraft(null)}
              data-identity-secret-cancel
            >
              {t('webchat.identity.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={update.isPending}
              onClick={() => (secretSet ? setPendingConfirm('rotate') : saveDraft())}
              data-identity-secret-save
            >
              {t('webchat.identity.save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {previousSet && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => setPendingConfirm('revoke')}
              data-identity-secret-revoke
            >
              {t('webchat.identity.revoke')}
            </Button>
          )}
          {secretSet && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => setPendingConfirm('turn-off')}
              data-identity-secret-turn-off
            >
              {t('webchat.identity.turn_off')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={update.isPending}
            onClick={() => setDraft(generateIdentitySecret())}
            data-identity-secret-generate
          >
            {t(secretSet ? 'webchat.identity.rotate' : 'webchat.identity.generate')}
          </Button>
        </div>
      )}

      {pendingConfirm === 'rotate' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingConfirm(null)}
          title={t('webchat.identity.confirm_rotate_title')}
          description={t('webchat.identity.confirm_rotate_description')}
          confirmLabel={t('webchat.identity.rotate')}
          variant="default"
          onConfirm={confirmPending}
          data-testid="identity-secret-rotate-confirm"
        />
      )}
      {pendingConfirm === 'revoke' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingConfirm(null)}
          title={t('webchat.identity.confirm_revoke_title')}
          description={t('webchat.identity.confirm_revoke_description')}
          confirmLabel={t('webchat.identity.revoke')}
          onConfirm={confirmPending}
          data-testid="identity-secret-revoke-confirm"
        />
      )}
      {pendingConfirm === 'turn-off' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingConfirm(null)}
          title={t('webchat.identity.confirm_turn_off_title')}
          description={t('webchat.identity.confirm_turn_off_description')}
          confirmLabel={t('webchat.identity.turn_off')}
          onConfirm={confirmPending}
          data-testid="identity-secret-turn-off-confirm"
        />
      )}
    </section>
  );
}
