import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Monitor } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PageHeader } from '@/admin/shared/page-header';
import {
  useUserSessions,
  useRevokeUserSession,
  type UserSessionDto,
} from '@/core/api/hooks/use-user-sessions';
import { useFormatDate } from '@/core/i18n/use-format';

/**
 * End-user active sessions page at `/profile/security/sessions` (R5.2 PA.2).
 *
 * Lists every active refresh-token-backed session for the calling user and
 * exposes a "revoke" action for non-current sessions. Revoking the current
 * session is intentionally blocked at the API; the wizard pre-disables the
 * action to make this obvious in the UX.
 */
export default function UserSessionsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { formatDateTime } = useFormatDate();
  const { data: sessions, isLoading, isError } = useUserSessions();
  const revoke = useRevokeUserSession();

  const [confirmTarget, setConfirmTarget] = useState<UserSessionDto | null>(null);

  function handleRevoke() {
    if (!confirmTarget) return;
    revoke.mutate(confirmTarget.sessionId, {
      onSuccess: () => setConfirmTarget(null),
    });
  }

  function formatDate(iso: string): string {
    try {
      return formatDateTime(iso);
    } catch {
      return iso;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" data-testid="user-sessions-page">
      <PageHeader
        title={t('admin:profile_security.sessions.title')}
        description={t('admin:profile_security.sessions.description')}
      />

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t('common:status.loading')}…</p>
      )}

      {isError && (
        <div
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          data-testid="user-sessions-error"
        >
          {t('admin:profile_security.sessions.load_error')}
        </div>
      )}

      {sessions && sessions.length === 0 && (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground" data-testid="user-sessions-empty">
          {t('admin:profile_security.sessions.empty')}
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card" data-testid="user-sessions-table">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t('admin:profile_security.sessions.col_device')}</th>
                <th className="px-4 py-2 text-left">{t('admin:profile_security.sessions.col_ip')}</th>
                <th className="px-4 py-2 text-left">{t('admin:profile_security.sessions.col_created')}</th>
                <th className="px-4 py-2 text-left">{t('admin:profile_security.sessions.col_last_activity')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  className="border-t"
                  data-testid={`user-session-row-${s.sessionId}`}
                  data-current={s.isCurrentSession ? 'true' : 'false'}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span>{s.device}</span>
                      {s.isCurrentSession && (
                        <Badge variant="default" data-testid="user-session-current-badge">
                          {t('admin:profile_security.sessions.current')}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.ipAddress}</td>
                  <td className="px-4 py-2 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-2 text-xs">{formatDate(s.lastActivity)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={s.isCurrentSession}
                      onClick={() => setConfirmTarget(s)}
                      data-testid={`user-session-revoke-${s.sessionId}`}
                    >
                      <LogOut className="mr-1.5 h-3.5 w-3.5" />
                      {t('common:actions.revoke')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        onConfirm={handleRevoke}
        entityName={confirmTarget?.device ?? ''}
        entityType={t('admin:profile_security.sessions.entity_type')}
        isPending={revoke.isPending}
      />
    </div>
  );
}

