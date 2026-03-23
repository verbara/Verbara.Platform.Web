import { Outlet } from 'react-router-dom';
import { OperationsSidebar } from '@/operations/sidebar/operations-sidebar';

export default function OperationsLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <OperationsSidebar />
      </aside>
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
