// AuditTrailMini — a compact, read-only timeline of the last N audit events
// for a single resource. Used in detail drawers (cluster node, queue, etc.)
// where a full `AuditTimeline` would dominate vertical space.
//
// Design differences vs. `AuditTimeline` (/core/ui/audit-timeline.tsx):
//   - Caps the rendered entries (default 10) — older events are summarised
//     by an inline "N more" footer instead of scrolling.
//   - Tighter vertical rhythm; no timeline rail — each row is self-contained.
//   - i18n wired via `common` namespace; empty + loading states are literal
//     keys (audit-trail-mini.no-events / audit-trail-mini.loading).

import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { useAuditEvents } from '@/core/api/hooks/use-audit-events';
import { useFormatDate } from '@/core/i18n/use-format';
import { Skeleton } from '@/core/ui/skeleton';

export interface AuditTrailMiniProps {
  readonly resourceType: string;
  readonly resourceId: string;
  /** Maximum number of events to render. Defaults to 10. */
  readonly limit?: number;
}

export function AuditTrailMini({ resourceType, resourceId, limit = 10 }: AuditTrailMiniProps) {
  const { t } = useTranslation(['common']);
  const { formatDateShort, formatTimeShort } = useFormatDate();
  const formatTimestamp = (iso: string): string =>
    `${formatDateShort(iso)}, ${formatTimeShort(iso)}`;
  const { data: entries = [], isLoading } = useAuditEvents({ resourceType, resourceId });

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="audit-trail-mini-loading">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="py-3 text-xs text-muted-foreground" data-testid="audit-trail-mini-empty">
        {t('common:audit-trail-mini.no-events', 'No audit events yet.')}
      </p>
    );
  }

  const visible = entries.slice(0, limit);
  const hiddenCount = Math.max(0, entries.length - limit);

  return (
    <div className="space-y-2" data-testid="audit-trail-mini">
      {visible.map((entry) => (
        <div
          key={entry.entryId}
          className="flex items-start gap-2 rounded-md border bg-card px-2.5 py-1.5"
        >
          <Clock className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">
              <span className="text-muted-foreground">{formatTimestamp(entry.occurredAt)}</span>{' '}
              <span className="font-medium">{entry.performedBy ?? 'system'}</span>{' '}
              <span className="capitalize">{entry.action.replace(/_/g, ' ')}</span>
            </p>
          </div>
        </div>
      ))}
      {hiddenCount > 0 && (
        <p className="px-1 text-xs text-muted-foreground">+{hiddenCount} older events</p>
      )}
    </div>
  );
}
