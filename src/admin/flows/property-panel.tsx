import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Node } from '@xyflow/react';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';

// ---------------------------------------------------------------------------
// Property definitions per node type
// ---------------------------------------------------------------------------

interface PropertyField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'queue-select';
}

const nodeProperties: Record<string, PropertyField[]> = {
  SendMessage: [
    { key: 'text', label: 'Message Text', type: 'textarea' },
  ],
  CollectInput: [
    { key: 'prompt', label: 'Prompt', type: 'textarea' },
    { key: 'timeout', label: 'Timeout (seconds)', type: 'number' },
    { key: 'variable', label: 'Save to Variable', type: 'text' },
  ],
  Condition: [
    { key: 'expression', label: 'Expression', type: 'text' },
  ],
  Enqueue: [
    { key: 'queue_id', label: 'Queue', type: 'queue-select' },
    { key: 'priority', label: 'Priority', type: 'number' },
  ],
  SetVariable: [
    { key: 'variable', label: 'Variable', type: 'text' },
    { key: 'value', label: 'Value', type: 'text' },
  ],
  Wait: [
    { key: 'duration', label: 'Duration (seconds)', type: 'number' },
  ],
  End: [
    { key: 'disposition', label: 'Disposition', type: 'text' },
  ],
  HttpRequest: [
    { key: 'url', label: 'URL', type: 'text' },
    { key: 'method', label: 'Method', type: 'text' },
  ],
  KnowledgeSearch: [
    { key: 'query_variable', label: 'Query Variable', type: 'text' },
  ],
  AiClassify: [
    { key: 'categories', label: 'Categories (comma-separated)', type: 'text' },
  ],
  AiGenerate: [
    { key: 'prompt', label: 'Prompt', type: 'textarea' },
    { key: 'output_variable', label: 'Output Variable', type: 'text' },
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
  const nodeType = node.type ?? '';
  const fields = nodeProperties[nodeType] ?? [];

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
        Properties
      </h3>
      <p className="mb-4 text-[11px] text-muted-foreground">
        {nodeType} &middot; {node.id}
      </p>

      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">No configurable properties.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={field.key} className="text-xs">
                {field.label}
              </Label>

              {field.type === 'textarea' ? (
                <Textarea
                  id={field.key}
                  rows={3}
                  className="text-xs"
                  {...register(field.key)}
                />
              ) : field.type === 'number' ? (
                <Input
                  id={field.key}
                  type="number"
                  className="text-xs"
                  {...register(field.key)}
                />
              ) : (
                // text and queue-select both render as plain text input
                <Input
                  id={field.key}
                  type="text"
                  className="text-xs"
                  placeholder={field.type === 'queue-select' ? 'Queue ID' : undefined}
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
