import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, PhoneIncoming } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import { answerCall, rejectCall, hangupCall } from '@/core/voice/softphone-manager';

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Floating call widget driven purely by the voice-call-store (Phase 3A — no
 * tracked Conversation yet). Shows an incoming-call card (answer/reject) while
 * ringing and an in-call card (caller + live timer + hangup) once answered.
 * Mounted from the agent shell so it surfaces regardless of the active route.
 */
export function CallCard() {
  const { t } = useTranslation('agent');
  const phase = useVoiceCallStore((s) => s.phase);
  const callerId = useVoiceCallStore((s) => s.callerId);
  const startedAt = useVoiceCallStore((s) => s.startedAt);
  // Tick `now` once per second while in call; elapsed is derived during render
  // so we never call setState synchronously inside the effect.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase !== 'active' || startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  if (phase !== 'ringing' && phase !== 'active') return null;

  const ringing = phase === 'ringing';
  const elapsed =
    phase === 'active' && startedAt != null ? formatElapsed(now - startedAt) : '00:00';
  const caller = callerId || t('voice.unknown_caller', 'Unknown caller');

  return (
    <div
      data-testid="voice-call-card"
      data-voice-state={phase}
      className="fixed right-4 bottom-4 z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {ringing ? <PhoneIncoming size={18} /> : <Phone size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ringing ? t('voice.incoming') : t('voice.in_call')}
          </p>
          <p
            data-testid="voice-caller-id"
            className="truncate text-sm font-medium text-slate-800 dark:text-slate-100"
          >
            {caller}
          </p>
        </div>
        {!ringing && (
          <span
            data-testid="voice-call-timer"
            className="ml-auto font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300"
          >
            {elapsed}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {ringing ? (
          <>
            <Button
              data-testid="voice-answer-btn"
              variant="default"
              className="flex-1"
              onClick={() => void answerCall()}
            >
              <Phone data-icon="inline-start" />
              {t('voice.answer')}
            </Button>
            <Button
              data-testid="voice-reject-btn"
              variant="destructive"
              className="flex-1"
              onClick={() => void rejectCall()}
            >
              <PhoneOff data-icon="inline-start" />
              {t('voice.reject')}
            </Button>
          </>
        ) : (
          <Button
            data-testid="voice-hangup-btn"
            variant="destructive"
            className="flex-1"
            onClick={() => void hangupCall()}
          >
            <PhoneOff data-icon="inline-start" />
            {t('voice.hangup')}
          </Button>
        )}
      </div>
    </div>
  );
}
