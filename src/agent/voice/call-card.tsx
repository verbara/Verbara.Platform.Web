import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Pause,
  Play,
  Mic,
  MicOff,
  Grid3x3,
  ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import { useConversationStore } from '@/agent/stores/conversation-store';
import {
  answerCall,
  rejectCall,
  hangupCall,
  holdCall,
  unholdCall,
  muteCall,
  unmuteCall,
} from '@/core/voice/softphone-manager';
import { DtmfDialpad } from './dtmf-dialpad';
import { VoiceTransferDialog } from './voice-transfer-dialog';

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
  const direction = useVoiceCallStore((s) => s.direction);
  const callerId = useVoiceCallStore((s) => s.callerId);
  const associatedConversationId = useVoiceCallStore((s) => s.associatedConversationId);
  const startedAt = useVoiceCallStore((s) => s.startedAt);
  const isHeld = useVoiceCallStore((s) => s.isHeld);
  const isMuted = useVoiceCallStore((s) => s.isMuted);
  const navigate = useNavigate();
  const select = useConversationStore((s) => s.select);
  // Tick `now` once per second while in call; elapsed is derived during render
  // so we never call setState synchronously inside the effect.
  const [now, setNow] = useState(() => Date.now());
  const [dialpadOpen, setDialpadOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    if (phase !== 'active' || startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  if (phase !== 'ringing' && phase !== 'active') return null;

  const ringing = phase === 'ringing';
  const dialing = ringing && direction === 'outbound';
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
          {ringing && !dialing ? <PhoneIncoming size={18} /> : <Phone size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dialing
              ? t('voice.dialing', 'Dialing')
              : ringing
                ? t('voice.incoming')
                : t('voice.in_call')}
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
        {dialing ? (
          <Button
            data-testid="voice-cancel-dial-btn"
            variant="destructive"
            className="flex-1"
            onClick={() => void hangupCall()}
          >
            <PhoneOff data-icon="inline-start" />
            {t('voice.cancel_dial', 'Cancel')}
          </Button>
        ) : ringing ? (
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

      {/* In-call control row (3B.2a) — hold/mute/dialpad. Client-side via SIP.js; the store mirrors
          the toggle state. Only while a call is active. */}
      {!ringing && (
        <>
          <div className="mt-2 flex gap-2">
            <Button
              data-testid="voice-hold-btn"
              variant={isHeld ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              aria-pressed={isHeld}
              onClick={() => void (isHeld ? unholdCall() : holdCall())}
            >
              {isHeld ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
              {isHeld ? t('voice.resume') : t('voice.hold')}
            </Button>
            <Button
              data-testid="voice-mute-btn"
              variant={isMuted ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              aria-pressed={isMuted}
              onClick={() => (isMuted ? unmuteCall() : muteCall())}
            >
              {isMuted ? <MicOff data-icon="inline-start" /> : <Mic data-icon="inline-start" />}
              {isMuted ? t('voice.unmute') : t('voice.mute')}
            </Button>
            <Button
              data-testid="voice-dialpad-btn"
              variant={dialpadOpen ? 'default' : 'outline'}
              size="sm"
              aria-pressed={dialpadOpen}
              aria-label={t('voice.dialpad')}
              onClick={() => setDialpadOpen((open) => !open)}
            >
              <Grid3x3 />
            </Button>
          </div>
          {dialpadOpen && <DtmfDialpad />}
          {/* Blind transfer (3B.2c) — only once the call is correlated to its tracked Conversation
              (the transfer POSTs to /conversations/{id}/voice-transfer). Server-side AMI redirect of
              the customer leg; the agent leg then drops into the existing wrap-up flow. */}
          {associatedConversationId && (
            <Button
              data-testid="voice-transfer-btn"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowRightLeft data-icon="inline-start" />
              {t('voice.transfer.open', 'Transfer')}
            </Button>
          )}
        </>
      )}

      {/* Re-entry to the screen-popped voice Conversation (3B.1 G3) — available once the call is
          correlated to its tracked Conversation. */}
      {!ringing && associatedConversationId && (
        <button
          type="button"
          data-testid="voice-open-conversation"
          onClick={() => {
            select(associatedConversationId);
            navigate(`/agent/conversation/${associatedConversationId}`);
          }}
          className="mt-2 w-full text-center text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          {t('voice.open_conversation')}
        </button>
      )}

      {associatedConversationId && (
        <VoiceTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          conversationId={associatedConversationId}
        />
      )}
    </div>
  );
}
