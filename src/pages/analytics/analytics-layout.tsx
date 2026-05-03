import { Outlet } from 'react-router-dom';
import { AnalyticsSidebar } from '@/analytics/sidebar/analytics-sidebar';
import { FilterBar } from '@/analytics/shared/filter-bar';
import { AreaErrorBoundary } from '@/core/ui/area-error-boundary';

export default function AnalyticsLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <AnalyticsSidebar />
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <FilterBar />
        <div className="flex-1 overflow-auto p-6">
          <AreaErrorBoundary areaName="analytics">
            <Outlet />
          </AreaErrorBoundary>
        </div>
      </div>
    </div>
  );
}
