import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import type { components } from '@/core/api/generated/openapi';

type ActiveSessionDto = components['schemas']['ActiveSessionDto'];

interface SessionCardProps {
  session: ActiveSessionDto;
  isSelected: boolean;
  onClick: () => void;
}

function startOf(connectedAt: string | null): number | null {
  if (connectedAt === null) return null;
  const start = new Date(connectedAt).getTime();
  return Number.isNaN(start) ? null : start;
}

/**
 * The live `mm:ss` elapsed since `connectedAt`, or `null` when it is null or unparsable: then no
 * elapsed time is computed and no interval runs (design D2).
 */
function useLiveDuration(connectedAt: string | null): string | null {
  const start = startOf(connectedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (start === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);

  if (start === null) return null;
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const sentimentColors: Record<string, string> = {
  Positive: 'bg-emerald-500',
  Neutral: 'bg-slate-400',
  Negative: 'bg-amber-500',
  Frustrated: 'bg-orange-500',
  Escalating: 'bg-red-500',
};

export function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const { t } = useTranslation('operations');
  const duration = useLiveDuration(session.connectedAt);
  const dotColor =
    session.sentiment && sentimentColors[session.sentiment]
      ? sentimentColors[session.sentiment]
      : 'bg-slate-300';
  // The agent id is an opaque id, never a title (design D2).
  const agentName = session.agentName;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="session-card"
      data-session-id={session.sessionId}
      className={`w-full rounded-lg border p-3 text-left transition-colors focus:outline-none ${
        isSelected
          ? 'border-brand bg-brand/5 dark:bg-brand/10'
          : 'border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-medium ${agentName === null ? 'text-muted-foreground' : 'text-foreground'}`}
            data-testid="session-card-title"
            data-agent-name={agentName === null ? 'unknown' : undefined}
          >
            {agentName ?? t('monitor.unknown_agent')}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{session.queueName ?? ''}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {session.sentiment && (
            <span
              className={`h-2.5 w-2.5 rounded-full ${dotColor}`}
              title={session.sentiment}
              data-testid="session-card-sentiment"
            />
          )}
          {duration === null ? (
            <span
              className="font-mono text-xs text-muted-foreground"
              data-testid="session-card-duration"
              data-duration="unknown"
              aria-label={t('monitor.duration_unknown')}
            >
              —
            </span>
          ) : (
            <span
              className="font-mono text-xs text-muted-foreground"
              data-testid="session-card-duration"
            >
              {duration}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="h-3 w-3 shrink-0" />
        <span className="truncate">{session.callerIdNum ?? ''}</span>
      </div>
    </button>
  );
}
