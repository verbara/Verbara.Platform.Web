import { Outlet } from 'react-router-dom';
import { Rail } from './rail';
import { CommandPalette } from './command-palette';
import { useSSE } from '@/core/hooks/use-sse';

export function AppShell() {
  useSSE();
  return (
    <div className="flex h-screen overflow-hidden">
      <Rail />
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
