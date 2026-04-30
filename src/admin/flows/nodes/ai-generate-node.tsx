import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function AiGenerateNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const prompt = (data.prompt as string) || t('flows.node_body.generate_placeholder');
  return (
    <BaseNode title={t('flows.node_types.ai_generate')} headerColor="bg-violet-500" selected={selected}>
      <p className="line-clamp-2 text-muted-foreground">{prompt}</p>
    </BaseNode>
  );
}
