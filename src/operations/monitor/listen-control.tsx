import { useTranslation } from 'react-i18next';
import { Headphones, Monitor, PhoneCall, Square, Volume2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/ui/dropdown-menu';
import { useAuthStore } from '@/core/auth/auth-store';
import { getConfig } from '@/core/hooks/use-config';
import { alreadyListeningOf } from '@/core/api/supervisor-listen-refusals';
import {
  useCurrentListen,
  useStartListen,
  useStopListen,
  type ListenDestination,
} from '@/core/api/hooks/use-supervisor-listen';
import { useListenStore, type ListenRegistration } from '@/core/voice/listen-store';
import { listenHere, resumeListenAudio } from '@/core/voice/listen-agent';

const MONITOR_PERMISSION = 'contacts:conversation:monitor';

/** Why the browser destination is unavailable, as `data-reason` and its translation key. */
type BrowserReason =
  'no-wss' | 'connecting' | 'failed' | 'moved' | 'no-supervisor-endpoint' | 'not-permitted';

function hasWssUrl(): boolean {
  try {
    return Boolean(getConfig().asteriskWssUrl);
  } catch {
    return false;
  }
}

function browserReasonOf(
  registration: ListenRegistration,
  unavailableReason: 'not-permitted' | 'no-supervisor-endpoint' | null,
): BrowserReason | null {
  switch (registration) {
    case 'registered':
      return null;
    case 'unavailable':
      return unavailableReason ?? 'not-permitted';
    case 'moved':
    case 'failed':
    case 'connecting':
      return registration;
    case 'offline':
      return hasWssUrl() ? 'connecting' : 'no-wss';
  }
}

const reasonKey = (reason: BrowserReason) =>
  `monitor.listen.browser_unavailable.${reason.replaceAll('-', '_')}`;

function useCanMonitor(): boolean {
  return useAuthStore((s) => s.permissions.includes(MONITOR_PERMISSION));
}

interface ListenControlProps {
  /**
   * The conversation the listen is keyed by: a voice row's `conversationId`, or the conversation
   * detail's own `id`. `null` (the call is not tracked as a conversation) shows Listen disabled.
   */
  readonly conversationId: string | null;
}

/**
 * Listen / Stop listening on one voice call (design D6). The state shown comes only from the listen
 * store, which only a 200 of the start or current route fills: a refusal leaves it `idle`.
 */
export function ListenControl({ conversationId }: ListenControlProps) {
  const { t } = useTranslation('operations');
  const canMonitor = useCanMonitor();
  useCurrentListen(canMonitor);
  const registration = useListenStore((s) => s.registration);
  const unavailableReason = useListenStore((s) => s.unavailableReason);
  const activeListen = useListenStore((s) => s.activeListen);
  const audioBlocked = useListenStore((s) => s.audioBlocked);
  const start = useStartListen();
  const stop = useStopListen();

  if (!canMonitor) return null;

  const held =
    conversationId !== null && activeListen?.conversationId === conversationId
      ? activeListen
      : null;
  const listenState =
    held?.state === 'dialing' || held?.state === 'listening' ? held.state : 'idle';
  const browserReason = browserReasonOf(registration, unavailableReason);
  const defaultDestination: ListenDestination = browserReason === null ? 'endpoint' : 'phone';
  const existing = alreadyListeningOf(start.error);

  function startOn(destination: ListenDestination) {
    if (conversationId === null || start.isPending) return;
    if (destination === 'endpoint' && browserReason !== null) return;
    start.mutate({ conversationId, destination });
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="listen-control"
      data-listen-state={listenState}
      data-listen-destination={held?.destination ?? ''}
      data-listen-default-destination={defaultDestination}
      data-listen-registration={registration}
    >
      <div className="flex flex-wrap items-center gap-2">
        {listenState === 'idle' ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="listen-start"
              disabled={conversationId === null || start.isPending}
              render={<Button size="sm" variant="outline" />}
            >
              <Headphones className="mr-1.5 h-3.5 w-3.5" />
              {t('monitor.listen.listen')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem
                data-testid="listen-destination-endpoint"
                disabled={browserReason !== null}
                onClick={() => startOn('endpoint')}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span className="flex flex-col">
                  <span>{t('monitor.listen.in_browser')}</span>
                  {browserReason !== null && (
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid="listen-endpoint-unavailable"
                      data-reason={browserReason}
                    >
                      {t(reasonKey(browserReason))}
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="listen-destination-phone"
                onClick={() => startOn('phone')}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                {t('monitor.listen.on_phone')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              data-testid="listen-status"
            >
              <Headphones className="h-3.5 w-3.5" />
              {t(`monitor.listen.${listenState}`)}
            </span>
            <Button
              size="sm"
              variant="outline"
              data-testid="listen-stop"
              disabled={stop.isPending}
              onClick={() => stop.mutate(held!.conversationId)}
            >
              <Square className="mr-1.5 h-3.5 w-3.5" />
              {t('monitor.listen.stop')}
            </Button>
            {audioBlocked && (
              <Button
                size="sm"
                variant="secondary"
                data-testid="listen-click-to-hear"
                onClick={() => resumeListenAudio()}
              >
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                {t('monitor.listen.click_to_hear')}
              </Button>
            )}
          </>
        )}
        {existing?.conversationId && listenState === 'idle' && (
          <Button
            size="sm"
            variant="ghost"
            data-testid="listen-stop-existing"
            data-error-code="already-listening"
            disabled={stop.isPending}
            onClick={() => stop.mutate(existing.conversationId!)}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            {t('monitor.listen.already_running')}
          </Button>
        )}
      </div>

      {conversationId === null && (
        <p className="text-xs text-muted-foreground" data-testid="listen-no-conversation">
          {t('monitor.listen.no_conversation')}
        </p>
      )}

      {listenState === 'dialing' && held?.destination === 'phone' && (
        <p className="text-xs text-muted-foreground" data-testid="listen-answer-phone">
          {t('monitor.listen.answer_phone')}
        </p>
      )}

      {registration === 'moved' && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
          data-testid="listen-moved"
        >
          <span className="font-medium">{t('monitor.listen.moved')}</span>
          <span data-testid="listen-moved-reason">{t('monitor.listen.moved_reason')}</span>
          <Button
            size="sm"
            variant="outline"
            data-testid="listen-take-back"
            onClick={() => void listenHere()}
          >
            {t('monitor.listen.listen_here')}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The supervisor's one active listen, wherever it was started (another conversation, the phone, a
 * page before a reload), with Stop listening. Read from the current-listen route when the monitor
 * opens.
 */
export function ActiveListenBar() {
  const { t } = useTranslation('operations');
  const canMonitor = useCanMonitor();
  useCurrentListen(canMonitor);
  const activeListen = useListenStore((s) => s.activeListen);
  const stop = useStopListen();

  if (!canMonitor || !activeListen) return null;
  const state = activeListen.state === 'listening' ? 'listening' : 'dialing';

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs"
      data-testid="listen-active"
      data-listen-state={state}
      data-listen-destination={activeListen.destination}
      data-listen-conversation={activeListen.conversationId}
    >
      <Headphones className="h-3.5 w-3.5 text-emerald-600" />
      <span className="font-medium">{t(`monitor.listen.${state}`)}</span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        data-testid="listen-active-stop"
        disabled={stop.isPending}
        onClick={() => stop.mutate(activeListen.conversationId)}
      >
        <Square className="mr-1.5 h-3.5 w-3.5" />
        {t('monitor.listen.stop')}
      </Button>
    </div>
  );
}
