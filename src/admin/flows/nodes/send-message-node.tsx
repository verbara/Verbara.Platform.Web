import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function SendMessageNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const text = (data.text as string) || t('flows.node_body.no_message');
  return (
    <BaseNode title={t('flows.node_types.send_message')} headerColor="bg-blue-500" selected={selected}>
      <p className="line-clamp-2 text-muted-foreground">{text}</p>
    </BaseNode>
  );
}
