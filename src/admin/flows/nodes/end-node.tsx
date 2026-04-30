import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function EndNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const disposition = (data.disposition as string) || t('flows.node_body.hangup_default');
  return (
    <BaseNode title={t('flows.node_types.end')} headerColor="bg-red-500" selected={selected} showOutput={false}>
      <p className="text-center text-[10px] font-medium uppercase text-muted-foreground">
        {disposition}
      </p>
    </BaseNode>
  );
}
