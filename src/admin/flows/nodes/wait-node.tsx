import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function WaitNode({ data, selected }: NodeProps) {
  const duration = (data.duration as string) || '0s';
  return (
    <BaseNode title="Wait" headerColor="bg-slate-500" selected={selected}>
      <p className="text-center text-sm font-medium text-muted-foreground">{duration}</p>
    </BaseNode>
  );
}
