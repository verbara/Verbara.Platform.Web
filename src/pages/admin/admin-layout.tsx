export default function AdminLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <p className="p-4 text-sm font-medium text-slate-500">Admin Center</p>
      </aside>
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin</h1>
        <p className="mt-2 text-slate-500">Select a section from the sidebar.</p>
      </div>
    </div>
  );
}
