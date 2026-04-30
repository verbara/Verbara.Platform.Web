import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function EnqueueNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const queueName = (data.queueName as string) || (data.queueId as string) || t('flows.node_body.queue_default');
  return (
    <BaseNode title={t('flows.node_types.enqueue')} headerColor="bg-teal-500" selected={selected}>
      <p className="line-clamp-1 font-medium text-muted-foreground">{queueName}</p>
    </BaseNode>
  );
}
