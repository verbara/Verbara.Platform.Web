import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function KnowledgeSearchNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const query = (data.queryVariable as string) || t('flows.node_body.query_input_default');
  return (
    <BaseNode title={t('flows.node_types.knowledge_search')} headerColor="bg-purple-500" selected={selected}>
      <p className="font-mono text-[10px] text-muted-foreground">
        {t('flows.node_body.query_label')} <span className="font-semibold text-foreground">{query}</span>
      </p>
    </BaseNode>
  );
}
