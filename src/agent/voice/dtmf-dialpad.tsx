import { sendDtmf } from '@/core/voice/softphone-manager';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

/**
 * In-call DTMF dialpad (3B.2a). Each key sends a single tone on the active call via the softphone
 * manager (SIP.js INFO/RFC2833). Rendered inside the call card while a call is active; the agent
 * uses it for IVR navigation on a connected call.
 */
export function DtmfDialpad() {
  return (
    <div data-testid="voice-dtmf-dialpad" className="mt-2 grid grid-cols-3 gap-1.5">
      {KEYS.map((tone) => (
        <button
          key={tone}
          type="button"
          data-testid={`voice-dtmf-${tone}`}
          onClick={() => void sendDtmf(tone)}
          className="rounded-md border border-slate-200 py-2 text-center font-mono text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {tone}
        </button>
      ))}
    </div>
  );
}
