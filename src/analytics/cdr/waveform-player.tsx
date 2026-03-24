import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/core/ui/button';

interface WaveformPlayerProps {
  src: string;
  onTimeUpdate?: (seconds: number) => void;
  seekRef?: React.MutableRefObject<((time: number) => void) | null>;
}

const SPEED_OPTIONS = [1, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WaveformPlayer({ src, onTimeUpdate, seekRef }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      waveColor: '#d1d5db',
      progressColor: '#3b82f6',
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      height: 80,
      url: src,
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });

    ws.on('timeupdate', (time: number) => {
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    ws.on('finish', () => {
      setPlaying(false);
    });

    if (seekRef) {
      seekRef.current = (time: number) => {
        const dur = ws.getDuration();
        if (dur > 0) ws.seekTo(time / dur);
      };
    }

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Keep seekRef and onTimeUpdate in sync without recreating the instance
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !seekRef) return;
    seekRef.current = (time: number) => {
      const dur = ws.getDuration();
      if (dur > 0) ws.seekTo(time / dur);
    };
  }, [seekRef]);

  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.playPause();
    setPlaying((p) => !p);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => {
      const next = (prev + 1) % SPEED_OPTIONS.length;
      wsRef.current?.setPlaybackRate(SPEED_OPTIONS[next] ?? 1);
      return next;
    });
  }, []);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-3">
      <div ref={containerRef} className="w-full" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <span className="min-w-[3rem] text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)}
        </span>

        <span className="flex-1" />

        <span className="min-w-[3rem] text-right text-xs tabular-nums text-muted-foreground">
          {formatTime(duration)}
        </span>

        <button
          type="button"
          onClick={cycleSpeed}
          className="min-w-[2.5rem] rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          {SPEED_OPTIONS[speedIndex]}x
        </button>
      </div>
    </div>
  );
}
