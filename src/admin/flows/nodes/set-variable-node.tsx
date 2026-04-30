import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import BaseNode from './base-node';

export default function SetVariableNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('admin');
  const variable = (data.variable as string) || t('flows.node_body.set_var_default');
  const value = (data.value as string) || t('flows.node_body.set_value_default');
  return (
    <BaseNode title={t('flows.node_types.set_variable')} headerColor="bg-slate-500" selected={selected}>
      <p className="font-mono text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground">{variable}</span> = {value}
      </p>
    </BaseNode>
  );
}
