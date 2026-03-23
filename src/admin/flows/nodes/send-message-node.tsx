import type { NodeProps } from '@xyflow/react';
import BaseNode from './base-node';

export default function SendMessageNode({ data, selected }: NodeProps) {
  const text = (data.text as string) || 'No message';
  return (
    <BaseNode title="Send Message" headerColor="bg-blue-500" selected={selected}>
      <p className="line-clamp-2 text-muted-foreground">{text}</p>
    </BaseNode>
  );
}
