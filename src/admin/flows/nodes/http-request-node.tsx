import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function HttpRequestNode({ data, selected }: NodeProps) {
  const method = (data.method as string) || 'GET';
  const url = (data.url as string) || 'https://...';
  return (
    <BaseNode title="HTTP Request" headerColor="bg-purple-500" selected={selected}>
      <p className="font-mono text-[10px]">
        <span className="font-bold text-purple-600">{method}</span>{' '}
        <span className="line-clamp-1 text-muted-foreground">{url}</span>
      </p>
    </BaseNode>
  );
}
