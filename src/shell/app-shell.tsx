import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Rail } from './rail';
import { CommandPalette } from './command-palette';
import { useSSE } from '@/core/hooks/use-sse';
import { ImpersonationBanner } from '@/core/auth/impersonation-banner';
import { SkipLink } from '@/core/ui/skip-link';
import { SessionManager } from '@/core/session/session-manager';
import { useRealtimeStore } from '@/core/stores/realtime-store';

export function AppShell() {
  useSSE();
  const { t } = useTranslation();
  // Exposed as data for end-to-end tests and diagnostics, never rendered (design D7).
  const realtimeState = useRealtimeStore((s) => s.connectionState);
  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      data-testid="app-shell"
      data-realtime-state={realtimeState}
    >
      <SkipLink targetId="main-content">{t('a11y.skipToMain')}</SkipLink>
      <SessionManager />
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Rail />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto bg-slate-50 outline-none dark:bg-slate-900"
        >
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
