import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import type { ActiveSession } from '@/core/api/hooks/use-supervisor';

interface SessionCardProps {
  session: ActiveSession;
  isSelected: boolean;
  onClick: () => void;
}

function useLiveDuration(connectedAt: string): string {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(connectedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connectedAt]);

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
  const duration = useLiveDuration(session.connectedAt);
  const dotColor =
    session.sentiment && sentimentColors[session.sentiment]
      ? sentimentColors[session.sentiment]
      : 'bg-slate-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors focus:outline-none ${
        isSelected
          ? 'border-brand bg-brand/5 dark:bg-brand/10'
          : 'border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{session.agentName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{session.queueName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {session.sentiment && (
            <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} title={session.sentiment} />
          )}
          <span className="font-mono text-xs text-muted-foreground">{duration}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="h-3 w-3 shrink-0" />
        <span className="truncate">{session.callerIdNum}</span>
      </div>
    </button>
  );
}
