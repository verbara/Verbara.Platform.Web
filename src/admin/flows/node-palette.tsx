import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Node Palette — draggable node type cards grouped by category
// ---------------------------------------------------------------------------

interface PaletteItem {
  type: string;
  /** i18n key under flows.node_types.* */
  labelKey: string;
  /** Tailwind bg class matching the node header color */
  color: string;
}

interface PaletteGroup {
  /** i18n key under flows.palette_groups.* */
  titleKey: string;
  items: PaletteItem[];
}

const groups: PaletteGroup[] = [
  {
    titleKey: 'standard',
    items: [
      { type: 'SendMessage', labelKey: 'send_message', color: 'bg-blue-500' },
      { type: 'CollectInput', labelKey: 'collect_input', color: 'bg-green-500' },
      { type: 'Condition', labelKey: 'condition', color: 'bg-amber-500' },
      { type: 'SetVariable', labelKey: 'set_variable', color: 'bg-slate-500' },
      { type: 'Wait', labelKey: 'wait', color: 'bg-slate-500' },
      { type: 'End', labelKey: 'end', color: 'bg-red-500' },
    ],
  },
  {
    titleKey: 'routing',
    items: [
      { type: 'Enqueue', labelKey: 'enqueue', color: 'bg-teal-500' },
    ],
  },
  {
    titleKey: 'integration',
    items: [
      { type: 'HttpRequest', labelKey: 'http_request', color: 'bg-purple-500' },
      { type: 'KnowledgeSearch', labelKey: 'knowledge_search', color: 'bg-purple-500' },
    ],
  },
  {
    titleKey: 'ai',
    items: [
      { type: 'AiClassify', labelKey: 'ai_classify', color: 'bg-violet-500' },
      { type: 'AiGenerate', labelKey: 'ai_generate', color: 'bg-violet-500' },
    ],
  },
];

function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
}

export default function NodePalette() {
  const { t } = useTranslation('admin');
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/30 p-4 overflow-y-auto">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('flows.nodes_header')}
      </h3>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t(`flows.palette_groups.${group.titleKey}`)}
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
                  <span className="truncate">{t(`flows.node_types.${item.labelKey}`)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
