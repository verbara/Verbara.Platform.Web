import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { useActiveSessions, useForceLogout } from '@/core/api/hooks/use-auth-admin';
import { useFormatDate } from '@/core/i18n/use-format';

export default function AuthSessionsPage() {
  const { t } = useTranslation(['admin']);
  const { formatDateTime, formatDateShort } = useFormatDate();
  const { data: sessions = [] } = useActiveSessions();
  const forceLogout = useForceLogout();
  const [logoutTarget, setLogoutTarget] = useState<{
    sessionId: string;
    userName: string;
  } | null>(null);

  function formatUserAgent(ua: string | null): string {
    if (!ua) return '-';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return ua.slice(0, 30);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('admin:auth.just_now', 'Just now');
    if (mins < 60) return t('admin:auth.minutes_ago', { defaultValue: '{{count}} min ago', count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('admin:auth.hours_ago', { defaultValue: '{{count}} hr ago', count: hours });
    return formatDateShort(dateStr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t('admin:auth.sessions_title', 'Active Sessions')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('admin:auth.sessions_description', { defaultValue: '{{count}} active sessions', count: sessions.length })}
          </p>
        </div>
      </div>

      {/* Sessions table */}
      <div className="rounded-lg border">
        <table data-testid="auth-sessions-table" className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">{t('admin:auth.user', 'User')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.ip_address', 'IP Address')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.browser', 'Browser')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.started', 'Started')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.last_activity', 'Last Activity')}</th>
              <th className="px-4 py-2 font-medium w-24" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.sessionId} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <div>
                    <p className="font-medium">{session.userDisplayName}</p>
                    <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {session.ipAddress ?? '-'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {formatUserAgent(session.userAgent)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDateTime(session.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="secondary">{timeAgo(session.lastActivity)}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Button
                    data-testid={`session-logout-${session.sessionId}`}
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLogoutTarget({
                        sessionId: session.sessionId,
                        userName: session.userDisplayName,
                      })
                    }
                  >
                    <LogOut className="mr-1 h-3.5 w-3.5" />
                    {t('admin:auth.force_logout', 'Force Logout')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Force Logout Confirmation */}
      <ConfirmDialog
        data-testid="session-logout-confirm"
        open={!!logoutTarget}
        onOpenChange={() => setLogoutTarget(null)}
        title={t('admin:auth.force_logout', 'Force Logout')}
        description={
          <>
            {t('admin:auth.force_logout_confirm', {
              defaultValue: 'Are you sure you want to force logout {{name}}? Their session will be immediately terminated.',
              name: logoutTarget?.userName,
            })}
          </>
        }
        onConfirm={() => {
          if (logoutTarget) {
            forceLogout.mutate(logoutTarget.sessionId, {
              onSuccess: () => setLogoutTarget(null),
            });
          }
        }}
        confirmLabel={t('admin:auth.force_logout', 'Force Logout')}
        variant="destructive"
      />
    </div>
  );
}
