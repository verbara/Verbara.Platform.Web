import type { DragEvent } from 'react';

// ---------------------------------------------------------------------------
// Node Palette — draggable node type cards grouped by category
// ---------------------------------------------------------------------------

interface PaletteItem {
  type: string;
  label: string;
  /** Tailwind bg class matching the node header color */
  color: string;
}

interface PaletteGroup {
  title: string;
  items: PaletteItem[];
}

const groups: PaletteGroup[] = [
  {
    title: 'Standard',
    items: [
      { type: 'SendMessage', label: 'Send Message', color: 'bg-blue-500' },
      { type: 'CollectInput', label: 'Collect Input', color: 'bg-green-500' },
      { type: 'Condition', label: 'Condition', color: 'bg-amber-500' },
      { type: 'SetVariable', label: 'Set Variable', color: 'bg-slate-500' },
      { type: 'Wait', label: 'Wait', color: 'bg-slate-500' },
      { type: 'End', label: 'End', color: 'bg-red-500' },
    ],
  },
  {
    title: 'Routing',
    items: [
      { type: 'Enqueue', label: 'Enqueue', color: 'bg-teal-500' },
    ],
  },
  {
    title: 'Integration',
    items: [
      { type: 'HttpRequest', label: 'HTTP Request', color: 'bg-purple-500' },
      { type: 'KnowledgeSearch', label: 'Knowledge Search', color: 'bg-purple-500' },
    ],
  },
  {
    title: 'AI',
    items: [
      { type: 'AiClassify', label: 'AI Classify', color: 'bg-violet-500' },
      { type: 'AiGenerate', label: 'AI Generate', color: 'bg-violet-500' },
    ],
  },
];

function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
}

export default function NodePalette() {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/30 p-4 overflow-y-auto">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Nodes
      </h3>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <div
                  key={item.type}
                  className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
