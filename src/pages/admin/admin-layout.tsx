import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/admin/sidebar';

export default function AdminLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <AdminSidebar />
      </aside>
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
