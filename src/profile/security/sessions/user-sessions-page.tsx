import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/core/hooks/use-document-title';
import { LogOut, Monitor } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PageHeader } from '@/core/ui/page-header';
import { useMySessions, useRevokeSession, type UserSession } from '@/core/api/hooks/use-auth-admin';
import { useFormatDate } from '@/core/i18n/use-format';
import { parseUserAgent } from './session-device';

/**
 * End-user active sessions page at `/profile/security/sessions` (spec `own-session-console`).
 *
 * Lists the caller's sessions from `GET /api/v1/auth/sessions`, the route the `refresh_token`
 * cookie reaches, so `isCurrentSession` marks this browser's row; revokes another one with
 * `DELETE /api/v1/auth/sessions/{tokenId}`. It shares its hooks and cache entry with the
 * `/profile/security` card. The current session's action is disabled; the API refuses it too.
 */
export default function UserSessionsPage() {
  const { t } = useTranslation(['admin', 'common']);
  useDocumentTitle(t('admin:profile_security.sessions.title'));
  const { formatDateTime } = useFormatDate();
  const { data: sessions, isLoading, isError } = useMySessions();
  const revoke = useRevokeSession();

  const [confirmTarget, setConfirmTarget] = useState<UserSession | null>(null);

  function deviceLabel(userAgent: string | null): string {
    const device = parseUserAgent(userAgent);
    return device
      ? t('admin:profile_security.sessions.device_label', {
          browser: device.browser,
          os: device.os,
        })
      : t('admin:profile_security.sessions.device_unknown');
  }

  function handleRevoke() {
    if (!confirmTarget) return;
    revoke.mutate(confirmTarget.tokenId, {
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

      {isLoading && <p className="text-sm text-muted-foreground">{t('common:status.loading')}…</p>}

      {isError && (
        <div
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          data-testid="user-sessions-error"
        >
          {t('admin:profile_security.sessions.load_error')}
        </div>
      )}

      {!isError && sessions && sessions.length === 0 && (
        <div
          className="rounded-md border bg-card p-6 text-sm text-muted-foreground"
          data-testid="user-sessions-empty"
        >
          {t('admin:profile_security.sessions.empty')}
        </div>
      )}

      {!isError && sessions && sessions.length > 0 && (
        <div
          className="overflow-hidden rounded-lg border bg-card"
          data-testid="user-sessions-table"
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">
                  {t('admin:profile_security.sessions.col_device')}
                </th>
                <th className="px-4 py-2 text-left">
                  {t('admin:profile_security.sessions.col_ip')}
                </th>
                <th className="px-4 py-2 text-left">
                  {t('admin:profile_security.sessions.col_created')}
                </th>
                <th className="px-4 py-2 text-left">
                  {t('admin:profile_security.sessions.col_last_activity')}
                </th>
                <th className="px-4 py-2" aria-label={t('common:table.col_actions')} />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.tokenId}
                  className="border-t"
                  data-testid={`user-session-row-${s.tokenId}`}
                  data-current={s.isCurrentSession ? 'true' : 'false'}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span>{deviceLabel(s.userAgent)}</span>
                      {s.isCurrentSession && (
                        <Badge variant="default" data-testid="user-session-current-badge">
                          {t('admin:profile_security.sessions.current')}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.ipAddress ?? '—'}</td>
                  <td className="px-4 py-2 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-2 text-xs">{formatDate(s.lastActivityAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={s.isCurrentSession}
                      onClick={() => setConfirmTarget(s)}
                      data-testid={`user-session-revoke-${s.tokenId}`}
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
        entityName={confirmTarget ? deviceLabel(confirmTarget.userAgent) : ''}
        entityType={t('admin:profile_security.sessions.entity_type')}
        isPending={revoke.isPending}
      />
    </div>
  );
}
