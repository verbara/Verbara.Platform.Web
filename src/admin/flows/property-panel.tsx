/* eslint-disable react-hooks/incompatible-library -- RHF watch() subscription pattern has no hook alternative */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Node } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { useTypificationSchemas } from '@/core/api/hooks/use-typification';

// ---------------------------------------------------------------------------
// Property definitions per node type
// ---------------------------------------------------------------------------

interface PropertyField {
  key: string;
  /** i18n key under flows.fields.* */
  labelKey: string;
  type: 'text' | 'textarea' | 'number' | 'queue-select' | 'schema-select';
}

const nodeProperties: Record<string, PropertyField[]> = {
  SendMessage: [{ key: 'text', labelKey: 'text', type: 'textarea' }],
  CollectInput: [
    { key: 'prompt', labelKey: 'prompt', type: 'textarea' },
    { key: 'timeout', labelKey: 'timeout', type: 'number' },
    // 'variable' here means "save the user input under this name" — use a
    // dedicated label key to avoid colliding with SetVariable's 'variable'
    // field which is conceptually a different action.
    { key: 'variable', labelKey: 'collect_input_variable', type: 'text' },
  ],
  CollectReason: [
    { key: 'schema_id', labelKey: 'schema_id', type: 'schema-select' },
    { key: 'subtree_root_node_id', labelKey: 'subtree_root_node_id', type: 'text' },
    { key: 'prompt', labelKey: 'prompt', type: 'textarea' },
    { key: 'retry_prompt', labelKey: 'retry_prompt', type: 'textarea' },
    { key: 'max_retries', labelKey: 'max_retries', type: 'number' },
  ],
  Condition: [{ key: 'expression', labelKey: 'expression', type: 'text' }],
  Enqueue: [
    { key: 'queue_id', labelKey: 'queue_id', type: 'queue-select' },
    { key: 'priority', labelKey: 'priority', type: 'number' },
  ],
  SetVariable: [
    { key: 'variable', labelKey: 'set_variable_name', type: 'text' },
    { key: 'value', labelKey: 'value', type: 'text' },
  ],
  Wait: [{ key: 'duration', labelKey: 'duration', type: 'number' }],
  End: [{ key: 'disposition', labelKey: 'disposition', type: 'text' }],
  HttpRequest: [
    { key: 'url', labelKey: 'url', type: 'text' },
    { key: 'method', labelKey: 'method', type: 'text' },
  ],
  KnowledgeSearch: [{ key: 'query_variable', labelKey: 'query_variable', type: 'text' }],
  AiClassify: [{ key: 'categories', labelKey: 'categories', type: 'text' }],
  AiGenerate: [
    { key: 'prompt', labelKey: 'prompt', type: 'textarea' },
    { key: 'output_variable', labelKey: 'output_variable', type: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// PropertyPanel — right sidebar, visible when a node is selected
// ---------------------------------------------------------------------------

interface PropertyPanelProps {
  node: Node;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
}

export default function PropertyPanel({ node, onUpdate }: PropertyPanelProps) {
  const { t } = useTranslation('admin');
  const nodeType = node.type ?? '';
  const fields = nodeProperties[nodeType] ?? [];

  // Schema list — populates the schema picker for nodes exposing a
  // schema-select field (e.g. CollectReason). The query is shared/cached
  // app-wide, so mounting it here is cheap even for node types that don't
  // render the picker.
  const { data: schemas } = useTypificationSchemas();

  // Build default values from the node's current data
  const defaults: Record<string, string> = {};
  for (const f of fields) {
    defaults[f.key] = ((node.data as Record<string, unknown>)[f.key] as string) ?? '';
  }

  const { register, reset, watch } = useForm<Record<string, string>>({
    defaultValues: defaults,
  });

  // Reset form when switching nodes
  useEffect(() => {
    const newDefaults: Record<string, string> = {};
    for (const f of fields) {
      newDefaults[f.key] = ((node.data as Record<string, unknown>)[f.key] as string) ?? '';
    }
    reset(newDefaults);
  }, [node.id, node.type, fields, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch all fields and push updates to the React Flow state
  useEffect(() => {
    const subscription = watch((values) => {
      onUpdate(node.id, { ...node.data, ...values } as Record<string, unknown>);
    });
    return () => subscription.unsubscribe();
  }, [watch, node.id, node.data, onUpdate]);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-muted/30 p-4 overflow-y-auto">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('flows.properties_header')}
      </h3>
      <p className="mb-4 text-[11px] text-muted-foreground">
        {nodeType} &middot; {node.id}
      </p>

      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('flows.no_properties')}</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={field.key} className="text-xs">
                {t(`flows.fields.${field.labelKey}`)}
              </Label>

              {field.type === 'textarea' ? (
                <Textarea id={field.key} rows={3} className="text-xs" {...register(field.key)} />
              ) : field.type === 'number' ? (
                <Input id={field.key} type="number" className="text-xs" {...register(field.key)} />
              ) : field.type === 'schema-select' ? (
                <select
                  id={field.key}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register(field.key)}
                >
                  <option value="">{t('flows.fields.schema_select_placeholder')}</option>
                  {(schemas ?? []).map((schema) => (
                    <option key={schema.schemaId} value={schema.schemaId}>
                      {schema.name} (v{schema.version})
                    </option>
                  ))}
                </select>
              ) : (
                // text and queue-select both render as plain text input
                <Input
                  id={field.key}
                  type="text"
                  className="text-xs"
                  placeholder={
                    field.type === 'queue-select' ? t('flows.queue_id_placeholder') : undefined
                  }
                  {...register(field.key)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
