export default function AnalyticsLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-500">Filters: Date range, queues, agents</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="mt-2 text-slate-500">Historical metrics and reports.</p>
      </div>
    </div>
  );
}
