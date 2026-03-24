import { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@/core/api/hooks/use-analytics';

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface SyncedTranscriptProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export function SyncedTranscript({ segments, currentTime, onSeek }: SyncedTranscriptProps) {
  const activeIndex = segments.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  );

  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  if (segments.length === 0) return null;

  return (
    <div className="flex max-h-64 flex-col overflow-y-auto rounded-md border bg-muted/20 p-1">
      {segments.map((seg, i) => {
        const isActive = i === activeIndex;
        const isAgent = seg.speaker === 'agent';

        return (
          <button
            key={i}
            type="button"
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(seg.startTime)}
            className={[
              'flex w-full gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-muted',
              isActive ? 'bg-blue-50 dark:bg-blue-950/40' : '',
            ].join(' ')}
          >
            <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {formatTimestamp(seg.startTime)}
            </span>
            <span
              className={[
                'shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase leading-none',
                isAgent
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              ].join(' ')}
            >
              {isAgent ? 'Agent' : 'Caller'}
            </span>
            <span className="flex-1 text-xs leading-relaxed text-foreground">{seg.text}</span>
          </button>
        );
      })}
    </div>
  );
}
