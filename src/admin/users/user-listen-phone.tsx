import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneCall } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { describeApiError, type ApiErrorEntry } from '@/core/api/api-error';
import { toastApiError } from '@/core/api/toast-api-error';
import { listenPhoneRefusals } from '@/core/api/supervisor-listen-refusals';
import { useListenPhone, useSetListenPhone } from '@/core/api/hooks/use-supervisor-listen';

interface UserListenPhoneProps {
  readonly userId: string;
}

/**
 * The number a supervisor's phone listen rings (design D8). Shown for every user the administrator
 * opens: the host stores one for any tenant user, and only a user with
 * `contacts:conversation:monitor` can ever use it. The text is sent as typed, trimmed; the host is
 * the authority on E.164, so `listen-phone-invalid` keeps the editor open with its message.
 */
export function UserListenPhone({ userId }: UserListenPhoneProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { data, error: readError } = useListenPhone(userId);
  const save = useSetListenPhone();
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<ApiErrorEntry | null>(null);

  const editing = draft !== null;
  const stored = data?.phoneNumber ?? null;
  const readRefusal = readError ? describeApiError(readError, listenPhoneRefusals) : null;
  const shownRefusal = refusal ?? readRefusal;

  function submit(phoneNumber: string | null) {
    setRefusal(null);
    save.mutate(
      { userId, phoneNumber },
      {
        onSuccess: () => setDraft(null),
        onError: (err) => {
          const entry = describeApiError(err, listenPhoneRefusals);
          if (entry.code === 'listen-phone-invalid') setRefusal(entry);
          else toastApiError(err, listenPhoneRefusals, t);
        },
      },
    );
  }

  return (
    <div className="flex items-start gap-3 py-3" data-testid="user-listen-phone">
      <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground">{t('admin:users.listen_phone.label')}</p>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-56"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={draft}
              placeholder={t('admin:users.listen_phone.placeholder')}
              aria-invalid={refusal !== null}
              onChange={(e) => setDraft(e.target.value)}
              data-testid="user-listen-phone-input"
            />
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() => submit(draft)}
              data-testid="user-listen-phone-save"
            >
              {t('admin:users.listen_phone.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setRefusal(null);
              }}
              data-testid="user-listen-phone-cancel"
            >
              {t('admin:users.listen_phone.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={stored ? 'font-mono' : 'text-muted-foreground'}
              data-testid="user-listen-phone-value"
              data-empty={stored ? 'false' : 'true'}
            >
              {stored ?? t('admin:users.listen_phone.none')}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(readError)}
              onClick={() => setDraft(stored ?? '')}
              data-testid="user-listen-phone-edit"
            >
              {t('admin:users.listen_phone.edit')}
            </Button>
            {stored && (
              <Button
                size="sm"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => submit(null)}
                data-testid="user-listen-phone-clear"
              >
                {t('admin:users.listen_phone.clear')}
              </Button>
            )}
          </div>
        )}
        {shownRefusal && (
          <p
            className="text-xs text-destructive"
            data-testid="user-listen-phone-error"
            data-error-code={shownRefusal.code}
          >
            {t(shownRefusal.key)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t('admin:users.listen_phone.hint')}</p>
      </div>
    </div>
  );
}
