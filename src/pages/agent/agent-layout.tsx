export default function AgentLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-64 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <p className="p-4 text-sm font-medium text-slate-500">Conversations</p>
      </aside>
      <div className="flex-1 overflow-auto p-6">
        <p className="text-slate-400">Select a conversation to begin.</p>
      </div>
      <aside className="w-72 border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <p className="p-4 text-sm font-medium text-slate-500">Contact Details</p>
      </aside>
    </div>
  );
}
