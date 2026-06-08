import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function CollectReasonNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const schemaId = (data.schema_id as string) || t('flows.node_body.no_schema');
  const subtree = (data.subtree_root_node_id as string) || '';
  return (
    <BaseNode
      title={t('flows.node_types.collect_reason')}
      headerColor="bg-green-600"
      selected={selected}
      showOutput={false}
    >
      <p className="font-mono text-[10px] text-muted-foreground">
        {t('flows.node_body.schema_label')}{' '}
        <span className="line-clamp-1 font-semibold text-foreground">{schemaId}</span>
      </p>
      {subtree && (
        <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/70">
          {t('flows.node_body.subtree_label')} <span className="font-semibold">{subtree}</span>
        </p>
      )}

      {/* Two output handles: collected (left), error (right) */}
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>{t('flows.node_body.collected_label')}</span>
        <span>{t('flows.node_body.error_label')}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="collected"
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-green-500"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-red-500"
        style={{ left: '70%' }}
      />
    </BaseNode>
  );
}
