import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/admin/sidebar';
import { SetupBanner } from '@/admin/setup/setup-banner';

export default function AdminLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <AdminSidebar />
      </aside>
      <div className="flex-1 overflow-auto">
        <SetupBanner />
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
