import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function AiGenerateNode({ data, selected }: NodeProps) {
  const prompt = (data.prompt as string) || 'Generate...';
  return (
    <BaseNode title="AI Generate" headerColor="bg-violet-500" selected={selected}>
      <p className="line-clamp-2 text-muted-foreground">{prompt}</p>
    </BaseNode>
  );
}
