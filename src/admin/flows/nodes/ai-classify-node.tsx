import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function AiClassifyNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const raw = (data.categories as string) || '';
  const categories = raw
    ? raw.split(',').map((c) => c.trim()).filter(Boolean)
    : [t('flows.node_body.category_default_one'), t('flows.node_body.category_default_two')];

  return (
    <BaseNode
      title={t('flows.node_types.ai_classify')}
      headerColor="bg-violet-500"
      selected={selected}
      showOutput={false}
    >
      <ul className="space-y-0.5">
        {categories.map((cat) => (
          <li key={cat} className="text-[10px] text-muted-foreground">
            &bull; {cat}
          </li>
        ))}
      </ul>

      {/* Dynamic output handles — one per category, evenly spaced */}
      {categories.map((cat, i) => (
        <Handle
          key={cat}
          type="source"
          position={Position.Bottom}
          id={cat}
          className="!h-2.5 !w-2.5 !border-2 !border-background !bg-violet-500"
          style={{ left: `${((i + 1) / (categories.length + 1)) * 100}%` }}
        />
      ))}
    </BaseNode>
  );
}
