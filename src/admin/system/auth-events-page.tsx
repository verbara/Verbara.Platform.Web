import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/core/ui/select';
import { useAuthEvents } from '@/core/api/hooks/use-auth-admin';

const EVENT_TYPES = [
  'login_success',
  'login_failure',
  'logout',
  'password_change',
  'mfa_enroll',
  'mfa_disable',
  'lockout',
  'session_revoked',
] as const;

const EVENT_TYPE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  login_success: 'default',
  login_failure: 'destructive',
  logout: 'secondary',
  lockout: 'destructive',
  mfa_enroll: 'default',
  mfa_disable: 'secondary',
  password_change: 'secondary',
  session_revoked: 'destructive',
};

export default function AuthEventsPage() {
  const { t } = useTranslation(['admin']);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: '50' };
    if (eventType) p.eventType = eventType;
    if (userSearch) p.userId = userSearch;
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  }, [page, eventType, userSearch, startDate, endDate]);

  const { data } = useAuthEvents(params);

  function exportCsv() {
    if (!data?.items) return;
    const headers = ['Timestamp', 'User', 'Event Type', 'IP Address', 'Details'];
    const rows = data.items.map((e) => [
      e.createdAt,
      e.userEmail ?? e.userId ?? '',
      e.eventType,
      e.ipAddress ?? '',
      JSON.stringify(e.details ?? {}),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t('admin:auth.events_title', 'Authentication Events')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin:auth.events_description', 'View login attempts, password changes, and security events')}</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" />
          {t('actions.export', 'Export CSV')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={eventType} onValueChange={(v) => setEventType(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder={t('admin:auth.all_events', 'All events')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('admin:auth.all_events', 'All events')}</SelectItem>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-48"
          placeholder={t('admin:auth.search_user', 'Search by user...')}
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
        <Input
          type="date"
          className="w-40"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          type="date"
          className="w-40"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {/* Events table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">{t('admin:auth.timestamp', 'Timestamp')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.user', 'User')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.event_type', 'Event Type')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.ip_address', 'IP Address')}</th>
              <th className="px-4 py-2 font-medium">{t('admin:auth.details', 'Details')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((event) => (
              <tr key={event.eventId} className="border-b last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                  {new Date(event.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{event.userEmail ?? event.userId ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={EVENT_TYPE_VARIANTS[event.eventType] ?? 'secondary'}>
                    {event.eventType}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                  {event.ipAddress ?? '-'}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                  {event.details ? JSON.stringify(event.details) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalCount > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('admin:auth.showing', {
              defaultValue: 'Showing {{from}}-{{to}} of {{total}}',
              from: (page - 1) * 50 + 1,
              to: Math.min(page * 50, data.totalCount),
              total: data.totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('actions.previous', 'Previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 50 >= data.totalCount}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('actions.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
