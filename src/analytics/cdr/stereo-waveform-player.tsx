import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { cn } from '@/lib/utils';
import { fetchRecording, recordingFileName, saveBlob } from '@/core/api/recording-download';

interface StereoWaveformPlayerProps {
  /** The recording's stream path (`/api/v1/recordings/{sessionId}/stream`). Fetched, never rendered. */
  readonly src: string;
  /** The record's `durationMs`, handed to WaveSurfer with the bytes. */
  readonly durationMs: number;
  readonly sessionId: string;
  /** The detail's `recordingName`, the saved file's name when known. */
  readonly recordingName?: string | null;
  readonly onTimeUpdate?: (seconds: number) => void;
  readonly seekRef?: React.RefObject<((time: number) => void) | null>;
}

type Channel = 'agent' | 'both' | 'customer';

/**
 * - `idle`: nothing fetched yet; play fetches.
 * - `loading`: the bytes are being fetched or decoded.
 * - `ready`: WaveSurfer holds the bytes; play and pause are local.
 * - `unsupported`: the browser cannot play the type, or WaveSurfer could not load the bytes.
 * - `error`: the fetch failed (a second 401 after the client's forced refresh included).
 */
type LoadStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

const SPEED_OPTIONS = [1, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Whether this browser reports it can play `type` (an empty answer means it cannot). */
function browserCanPlay(type: string): boolean {
  if (!type) return false;
  return document.createElement('audio').canPlayType(type) !== '';
}

/**
 * The recording player (change `cdr-list-reads-its-envelope`, design W5, spec `recording-playback`).
 * The console owns the fetch: play fetches the bytes once through the authenticated client, and
 * WaveSurfer is created with no `url` and no `fetchParams` and only ever receives the blob, so no
 * media element is handed the stream URL. Nothing is retried: a type the browser cannot play, or
 * bytes WaveSurfer cannot load, show the unsupported state with a download of the bytes already
 * fetched; a failed fetch shows the error state.
 */
export default function StereoWaveformPlayer({
  src,
  durationMs,
  sessionId,
  recordingName,
  onTimeUpdate,
  seekRef,
}: StereoWaveformPlayerProps) {
  const { t } = useTranslation('analytics');
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const gainLRef = useRef<GainNode | null>(null);
  const gainRRef = useRef<GainNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs / 1000);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const blobRef = useRef<Blob | null>(null);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [channel, setChannel] = useState<Channel>('both');

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
    });

    wsRef.current = ws;
    blobRef.current = null;
    setStatus('idle');
    setPlaying(false);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      try {
        const media = ws.getMediaElement();
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(media);
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const gainL = ctx.createGain();
        const gainR = ctx.createGain();

        source.connect(splitter);
        splitter.connect(gainL, 0);
        splitter.connect(gainR, 1);
        gainL.connect(merger, 0, 0);
        gainR.connect(merger, 0, 1);
        merger.connect(ctx.destination);

        gainLRef.current = gainL;
        gainRRef.current = gainR;
      } catch {
        // fallback: no stereo control if Web Audio unavailable
      }
    });

    ws.on('timeupdate', (time: number) => {
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    ws.on('finish', () => {
      setPlaying(false);
    });

    // A decode or media failure after the bytes were handed over: the same unsupported state.
    ws.on('error', () => {
      if (wsRef.current !== ws || blobRef.current === null) return;
      setPlaying(false);
      setStatus('unsupported');
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
      gainLRef.current = null;
      gainRRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !seekRef) return;
    seekRef.current = (time: number) => {
      const dur = ws.getDuration();
      if (dur > 0) ws.seekTo(time / dur);
    };
  }, [seekRef]);

  useEffect(() => {
    const gainL = gainLRef.current;
    const gainR = gainRRef.current;
    if (!gainL || !gainR) return;
    gainL.gain.value = channel === 'customer' ? 0 : 1;
    gainR.gain.value = channel === 'agent' ? 0 : 1;
  }, [channel]);

  const loadAndPlay = useCallback(
    async (ws: WaveSurfer) => {
      setStatus('loading');
      let blob: Blob;
      try {
        blob = await fetchRecording(src);
      } catch {
        if (wsRef.current === ws) setStatus('error');
        return;
      }
      if (wsRef.current !== ws) return;
      blobRef.current = blob;
      if (!browserCanPlay(blob.type)) {
        setStatus('unsupported');
        return;
      }
      try {
        await ws.loadBlob(blob, undefined, durationMs / 1000);
      } catch {
        if (wsRef.current === ws) setStatus('unsupported');
        return;
      }
      if (wsRef.current !== ws) return;
      setStatus('ready');
      try {
        await ws.play();
        setPlaying(true);
      } catch {
        // Autoplay refused: the bytes are loaded; the next press plays them.
      }
    },
    [src, durationMs],
  );

  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (status === 'idle') {
      void loadAndPlay(ws);
      return;
    }
    if (status !== 'ready') return;
    void ws.playPause();
    setPlaying((p) => !p);
  }, [status, loadAndPlay]);

  const downloadFetched = useCallback(() => {
    const blob = blobRef.current;
    if (!blob) return;
    saveBlob(blob, recordingFileName(blob.type, sessionId, recordingName));
  }, [sessionId, recordingName]);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => {
      const next = (prev + 1) % SPEED_OPTIONS.length;
      wsRef.current?.setPlaybackRate(SPEED_OPTIONS[next] ?? 1);
      return next;
    });
  }, []);

  const channelOptions: { key: Channel; label: string }[] = [
    { key: 'agent', label: t('recording.player.channelAgent') },
    { key: 'both', label: t('recording.player.channelBoth') },
    { key: 'customer', label: t('recording.player.channelCustomer') },
  ];

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-3">
      <div ref={containerRef} className="w-full" />

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={togglePlay}
          aria-label="play-pause"
          aria-busy={status === 'loading'}
          disabled={status === 'loading' || status === 'unsupported' || status === 'error'}
          data-status={status}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <span className="min-w-[3rem] text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)}
        </span>

        <div
          className="flex items-center gap-0.5"
          title={t('recording.player.stereoTooltip')}
          data-testid="channel-selector"
        >
          {channelOptions.map((opt) => (
            <Button
              key={opt.key}
              variant="ghost"
              size="sm"
              className={cn(channel === opt.key && 'bg-muted')}
              onClick={() => setChannel(opt.key)}
              data-testid={`channel-${opt.key}`}
              data-active={channel === opt.key}
            >
              {opt.label}
            </Button>
          ))}
        </div>

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

      {status === 'unsupported' && (
        <div
          data-testid="recording-unsupported-state"
          role="status"
          className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
        >
          <span>{t('recording.player.unsupportedFormat')}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadFetched}
            data-testid="recording-download"
          >
            <Download className="mr-1 h-4 w-4" />
            {t('recording.player.download')}
          </Button>
        </div>
      )}

      {status === 'error' && (
        <p data-testid="recording-player-error" role="alert" className="text-sm text-destructive">
          {t('recording.player.error')}
        </p>
      )}
    </div>
  );
}
