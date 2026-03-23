import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function EndNode({ data, selected }: NodeProps) {
  const disposition = (data.disposition as string) || 'hangup';
  return (
    <BaseNode title="End" headerColor="bg-red-500" selected={selected} showOutput={false}>
      <p className="text-center text-[10px] font-medium uppercase text-muted-foreground">
        {disposition}
      </p>
    </BaseNode>
  );
}
