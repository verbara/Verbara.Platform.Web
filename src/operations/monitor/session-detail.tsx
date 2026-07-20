import { useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Headphones, Eye, Square } from 'lucide-react';
import { useAgentAiStore, flattenAiSessions } from '@/core/stores/agent-ai-store';
import { Button } from '@/core/ui/button';
import { useSupervisorActions } from '@/core/realtime';

interface SessionDetailProps {
  sessionId: string;
}

const speakerColors: Record<string, string> = {
  Caller: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200',
  Agent: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
};

const sentimentBarColor = (score: number): string => {
  if (score >= 0.3) return 'bg-emerald-500';
  if (score >= -0.3) return 'bg-slate-400';
  if (score >= -0.6) return 'bg-amber-500';
  return 'bg-red-500';
};

const alertSeverityColors: Record<string, string> = {
  Info: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
  Warning: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
  Critical: 'border-red-400 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200',
};

export function SessionDetail({ sessionId }: Readonly<SessionDetailProps>) {
  const { t } = useTranslation('operations');
  // Agent-assist is now keyed per conversation (3B.1 Phase C); this supervisor monitor has no
  // per-conversation scoping, so it flattens across whatever sessions exist in this browser. See
  // flattenAiSessions for the known-incomplete supervisor live-mirror caveat.
  const sessions = useAgentAiStore((s) => s.sessions);
  const { transcript, suggestions, sentiment, complianceAlerts } = useMemo(
    () => flattenAiSessions(sessions),
    [sessions],
  );
  const { startSupervision, whisper, stopSupervision } = useSupervisorActions(sessionId);
  const [whisperText, setWhisperText] = useState('');
  const [supervising, setSupervising] = useState(false);
  const [sending, setSending] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  async function handleSend() {
    const msg = whisperText.trim();
    if (!msg) return;
    setSending(true);
    try {
      await whisper(msg);
      setWhisperText('');
    } finally {
      setSending(false);
    }
  }

  async function handleStartSupervision() {
    await startSupervision('Listen');
    setSupervising(true);
  }

  async function handleStopSupervision() {
    await stopSupervision();
    setSupervising(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const sentimentScore = sentiment?.score ?? 0;
  const sentimentPct = Math.round(((sentimentScore + 1) / 2) * 100);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          <Headphones className="h-3.5 w-3.5" />
          {t('monitor.listening')}
        </span>
        {supervising ? (
          <Button size="sm" variant="destructive" onClick={handleStopSupervision}>
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handleStartSupervision}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Supervise
          </Button>
        )}
      </div>

      {/* Compliance alerts */}
      {complianceAlerts.length > 0 && (
        <div className="space-y-1.5">
          {complianceAlerts.map((alert) => (
            <div
              key={alert.ruleId}
              className={`rounded border px-3 py-2 text-xs font-medium ${
                alertSeverityColors[alert.severity] ?? alertSeverityColors.Info
              }`}
            >
              {alert.severity}: {alert.phrase ?? alert.ruleId}
            </div>
          ))}
        </div>
      )}

      {/* Sentiment gauge */}
      {sentiment && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{sentiment.label}</span>
            <span>{sentimentPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${sentimentBarColor(sentimentScore)}`}
              style={{ width: `${sentimentPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded border border-border bg-card px-3 py-2 text-xs text-foreground"
            >
              <span className="mr-2 font-medium text-muted-foreground">[{s.priority}]</span>
              {s.text}
            </div>
          ))}
        </div>
      )}

      {/* Transcript */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-3">
        {transcript.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">No transcript yet.</p>
        )}
        {transcript.map((seg, i) => (
          <div
            key={`${seg.speaker}-${i}-${seg.text.slice(0, 16)}`}
            className={`inline-block max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
              speakerColors[seg.speaker] ?? 'bg-muted text-foreground'
            } ${seg.speaker === 'Agent' ? 'ml-auto block' : 'block'}`}
          >
            <span className="mr-1.5 text-xs font-medium opacity-60">{seg.speaker}</span>
            {seg.text}
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Whisper input */}
      <div className="flex gap-2">
        <textarea
          className="min-h-[40px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          rows={1}
          placeholder={t('monitor.whisperPlaceholder')}
          value={whisperText}
          onChange={(e) => setWhisperText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button size="sm" onClick={handleSend} disabled={!whisperText.trim() || sending}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {t('monitor.send')}
        </Button>
      </div>
    </div>
  );
}
