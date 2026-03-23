import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function EnqueueNode({ data, selected }: NodeProps) {
  const queueName = (data.queueName as string) || (data.queueId as string) || 'Queue';
  return (
    <BaseNode title="Enqueue" headerColor="bg-teal-500" selected={selected}>
      <p className="line-clamp-1 font-medium text-muted-foreground">{queueName}</p>
    </BaseNode>
  );
}
