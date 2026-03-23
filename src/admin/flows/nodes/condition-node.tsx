import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import BaseNode from './base-node';

export default function ConditionNode({ data, selected }: NodeProps) {
  const expression = (data.expression as string) || 'if ...';
  return (
    <BaseNode
      title="Condition"
      headerColor="bg-amber-500"
      selected={selected}
      showOutput={false}
    >
      <p className="line-clamp-2 font-mono text-[10px] text-muted-foreground">{expression}</p>

      {/* Two output handles: true (left), false (right) */}
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>True</span>
        <span>False</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-green-500"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-red-500"
        style={{ left: '70%' }}
      />
    </BaseNode>
  );
}
