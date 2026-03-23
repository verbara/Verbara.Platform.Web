import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

export default function AgentLayout() {
  const { t } = useTranslation(['agent']);
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
      <aside className="flex w-70 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('agent:inbox.title')}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* InboxPanel placeholder — Task 3 */}
        </div>
      </aside>

      {/* Conversation Panel */}
      <main className="relative flex min-w-0 flex-1 flex-col">
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
        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex h-12 items-center border-b border-slate-200 px-4 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('agent:context.contact_info')}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* ContextPanel placeholder — Task 7 */}
          </div>
        </aside>
      )}
    </div>
  );
}
