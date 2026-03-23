import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { InboxPanel } from '@/agent/inbox/inbox-panel';
import { ContextPanel } from '@/agent/context/context-panel';
import { AgentTour } from '@/agent/tour/agent-tour';

export default function AgentLayout() {
  const [contextOpen, setContextOpen] = useState(true);

  const toggleContext = useCallback(() => {
    setContextOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        toggleContext();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleContext]);

  return (
    <div className="flex h-full">
      {/* Inbox Panel */}
      <aside data-tour="inbox" className="flex w-70 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <InboxPanel />
      </aside>

      {/* Conversation Panel */}
      <main data-tour="conversation" className="relative flex min-w-0 flex-1 flex-col">
        {/* Context panel toggle */}
        <button
          type="button"
          onClick={toggleContext}
          className="absolute top-2 right-2 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          title="Toggle context panel (Ctrl+I)"
        >
          {contextOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
        <Outlet />
      </main>

      {/* Context Panel */}
      {contextOpen && (
        <aside data-tour="context" className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <ContextPanel />
        </aside>
      )}

      <AgentTour />
    </div>
  );
}
