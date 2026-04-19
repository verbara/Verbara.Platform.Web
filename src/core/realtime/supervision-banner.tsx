import { Eye } from 'lucide-react';
import { useRealtimeStore } from '@/core/stores/realtime-store';

/**
 * Shown inside agent-facing layouts when the server notifies this client that a
 * supervisor is actively observing one of their conversations. Data arrives via
 * `IPlatformHubClient.OnSupervisionStarted` and is cleared when
 * `useRealtimeStore.setObservedSupervision(null)` is dispatched (e.g. from a
 * future `OnSupervisionStopped` hook once the server emits it).
 */
export function SupervisionBanner() {
  const observed = useRealtimeStore((s) => s.observedSupervision);

  if (!observed) return null;

  return (
    <div
      data-testid="supervision-banner"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <Eye className="h-3.5 w-3.5" />
      <span>
        Supervisor is observing this conversation ({observed.mode.toLowerCase()}).
      </span>
    </div>
  );
}
