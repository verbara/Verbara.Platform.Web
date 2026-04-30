import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function WaitNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const duration = (data.duration as string) || t('flows.node_body.zero_seconds');
  return (
    <BaseNode title={t('flows.node_types.wait')} headerColor="bg-slate-500" selected={selected}>
      <p className="text-center text-sm font-medium text-muted-foreground">{duration}</p>
    </BaseNode>
  );
}
