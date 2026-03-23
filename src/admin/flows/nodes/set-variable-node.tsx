import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function SetVariableNode({ data, selected }: NodeProps) {
  const variable = (data.variable as string) || 'var';
  const value = (data.value as string) || '""';
  return (
    <BaseNode title="Set Variable" headerColor="bg-slate-500" selected={selected}>
      <p className="font-mono text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground">{variable}</span> = {value}
      </p>
    </BaseNode>
  );
}
