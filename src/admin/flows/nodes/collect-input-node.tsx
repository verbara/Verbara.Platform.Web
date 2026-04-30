import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function CollectInputNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const prompt = (data.prompt as string) || t('flows.node_body.ask_placeholder');
  const variable = (data.variable as string) || t('flows.node_body.unknown_var');
  return (
    <BaseNode title={t('flows.node_types.collect_input')} headerColor="bg-green-500" selected={selected}>
      <p className="line-clamp-1 text-muted-foreground">{prompt}</p>
      <p className="mt-1 font-mono text-[10px] text-foreground/70">
        &rarr; <span className="font-semibold">{variable}</span>
      </p>
    </BaseNode>
  );
}
