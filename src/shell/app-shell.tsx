import { Outlet } from 'react-router-dom';
import { Rail } from './rail';
import { CommandPalette } from './command-palette';
import { useSSE } from '@/core/hooks/use-sse';
import { ImpersonationBanner } from '@/core/auth/impersonation-banner';

export function AppShell() {
  useSSE();
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Rail />
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
