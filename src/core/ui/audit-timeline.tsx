import { Clock } from 'lucide-react';
import { useEntityHistory } from '@/core/api/hooks/use-audit';

interface AuditTimelineProps {
  entityType: string;
  entityId: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function AuditTimeline({ entityType, entityId }: AuditTimelineProps) {
  const { data: entries = [], isLoading } = useEntityHistory(entityType, entityId);

  if (isLoading) {
    return <p className="py-4 text-sm text-muted-foreground">Loading history...</p>;
  }

  if (entries.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No history available.</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const meta = entry.metadata ?? entry.details;
        const metaText = meta
          ? Object.entries(meta).map(([k, v]) => k + '=' + (typeof v === 'string' ? v : JSON.stringify(v))).join(' · ')
          : null;
        return (
          <div key={entry.entryId} className="flex gap-3 pb-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                <Clock className="h-3 w-3 text-muted-foreground" />
              </div>
              {i < entries.length - 1 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-1">
              <p className="text-sm">
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(entry.occurredAt)}
                </span>
                {' '}
                <span className="font-medium">{entry.performedBy ?? 'system'}</span>
                {': '}
                <span className="capitalize">{entry.action.replace(/_/g, ' ')}</span>
              </p>
              {metaText && (
                <p className="mt-0.5 text-xs text-muted-foreground">{metaText}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
