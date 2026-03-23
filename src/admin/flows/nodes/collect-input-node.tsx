import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function CollectInputNode({ data, selected }: NodeProps) {
  const prompt = (data.prompt as string) || 'Ask...';
  const variable = (data.variable as string) || '?';
  return (
    <BaseNode title="Collect Input" headerColor="bg-green-500" selected={selected}>
      <p className="line-clamp-1 text-muted-foreground">{prompt}</p>
      <p className="mt-1 font-mono text-[10px] text-foreground/70">
        &rarr; <span className="font-semibold">{variable}</span>
      </p>
    </BaseNode>
  );
}
