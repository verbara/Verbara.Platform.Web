import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminSidebar } from '@/admin/sidebar';
import { SetupBanner } from '@/admin/setup/setup-banner';
import { AreaErrorBoundary } from '@/core/ui/area-error-boundary';
import { useDocumentTitle } from '@/core/hooks/use-document-title';

export default function AdminLayout() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.admin'));
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <AdminSidebar />
      </aside>
      <div className="flex-1 overflow-auto">
        <SetupBanner />
        <div className="p-6">
          <AreaErrorBoundary areaName="admin">
            <Outlet />
          </AreaErrorBoundary>
        </div>
      </div>
    </div>
  );
}
