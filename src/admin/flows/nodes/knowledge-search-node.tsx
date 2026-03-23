import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function KnowledgeSearchNode({ data, selected }: NodeProps) {
  const query = (data.queryVariable as string) || 'input';
  return (
    <BaseNode title="Knowledge Search" headerColor="bg-purple-500" selected={selected}>
      <p className="font-mono text-[10px] text-muted-foreground">
        query: <span className="font-semibold text-foreground">{query}</span>
      </p>
    </BaseNode>
  );
}
