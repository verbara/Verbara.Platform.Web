import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Checkbox } from '@/core/ui/checkbox';
import { PhoneInput } from '@/core/ui/phone-input';
import { Textarea } from '@/core/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useConversationStore } from '@/agent/stores/conversation-store';
import {
  useTypificationForm,
  useTypify,
  type TypificationCondition,
  type TypificationField,
  type TypificationNode,
} from '@/core/api/hooks/use-typification';

interface DynamicTypificationFormProps {
  readonly conversationId: string;
  readonly enabled?: boolean;
  readonly onCompleted?: () => void;
}

// ---------------------------------------------------------------------------
// Condition evaluator — client mirror of the server (UX only; the server
// re-validates authoritatively on /typify).
// ---------------------------------------------------------------------------

function evalCondition(
  expr: TypificationCondition,
  fieldValues: Record<string, string>,
  selectedNodeCodes: Set<string>,
): boolean {
  let left: string;
  if (expr.refType === 'NodeSelected') {
    left = selectedNodeCodes.has(expr.ref) ? 'true' : 'false';
  } else {
    left = fieldValues[expr.ref] ?? '';
  }
  const value = expr.value ?? '';

  switch (expr.op) {
    case 'Eq':
      return left === value;
    case 'Neq':
      return left !== value;
    case 'In':
      return value
        .split(',')
        .map((v) => v.trim())
        .includes(left);
    case 'Contains':
      return left.toLowerCase().includes(value.toLowerCase());
    case 'Exists':
      return left !== '';
    case 'GreaterThan': {
      const l = Number(left);
      const r = Number(value);
      if (Number.isNaN(l) || Number.isNaN(r)) return false;
      return l > r;
    }
    case 'LessThan': {
      const l = Number(left);
      const r = Number(value);
      if (Number.isNaN(l) || Number.isNaN(r)) return false;
      return l < r;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Field-level client validation (UX). Returns an error message key or null.
// ---------------------------------------------------------------------------

function validateFieldValue(field: TypificationField, value: string): string | null {
  if (value === '') return null; // emptiness is handled by the required gate separately
  const v = field.validation;
  if (!v) return null;

  if (v.maxLength != null && value.length > v.maxLength) {
    return 'typification.validation.maxLength';
  }
  if (v.regex != null && v.regex !== '') {
    try {
      if (!new RegExp(v.regex).test(value)) return 'typification.validation.pattern';
    } catch {
      // an invalid regex in the schema must not crash the agent UI
    }
  }
  if (v.min != null || v.max != null) {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      if (v.min != null && n < v.min) return 'typification.validation.min';
      if (v.max != null && n > v.max) return 'typification.validation.max';
    }
  }
  return null;
}

export function DynamicTypificationForm({
  conversationId,
  enabled = true,
  onCompleted,
}: DynamicTypificationFormProps) {
  const { t } = useTranslation('agent');
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const { data: form, isLoading, isError } = useTypificationForm(conversationId, enabled);
  const typify = useTypify();

  const [selectedNodePath, setSelectedNodePath] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const schema = form?.schema;

  // Index nodes by id and group by parent for O(1) cascade lookups.
  const { nodeById, childrenByParent, rootNodes } = useMemo(() => {
    const byId = new Map<string, TypificationNode>();
    const byParent = new Map<string, TypificationNode[]>();
    const roots: TypificationNode[] = [];

    if (schema) {
      for (const node of schema.nodes) {
        byId.set(node.nodeId, node);
      }
      for (const node of schema.nodes) {
        if (node.parentNodeId != null) {
          const bucket = byParent.get(node.parentNodeId) ?? [];
          bucket.push(node);
          byParent.set(node.parentNodeId, bucket);
        }
      }
      for (const bucket of byParent.values()) {
        bucket.sort((a, b) => a.sortOrder - b.sortOrder);
      }

      const subtreeRoot = form?.subtreeRootNodeId;
      if (subtreeRoot != null && byParent.has(subtreeRoot)) {
        roots.push(...(byParent.get(subtreeRoot) ?? []));
      } else if (subtreeRoot == null) {
        roots.push(...schema.nodes.filter((n) => n.parentNodeId == null));
      }
      roots.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return { nodeById: byId, childrenByParent: byParent, rootNodes: roots };
  }, [schema, form?.subtreeRootNodeId]);

  // Build the per-level option lists from the selected path. Level 0 = roots;
  // each subsequent level = the children of the previously selected node.
  const levels = useMemo(() => {
    const result: { options: TypificationNode[]; selected: string }[] = [];
    if (rootNodes.length === 0) return result;

    result.push({ options: rootNodes, selected: selectedNodePath[0] ?? '' });

    for (let i = 0; i < selectedNodePath.length; i += 1) {
      const nodeId = selectedNodePath[i];
      if (nodeId == null) break;
      const children = childrenByParent.get(nodeId) ?? [];
      if (children.length === 0) break; // selected a leaf — no further level
      result.push({ options: children, selected: selectedNodePath[i + 1] ?? '' });
    }

    return result;
  }, [rootNodes, childrenByParent, selectedNodePath]);

  const selectedNodeCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const id of selectedNodePath) {
      const node = nodeById.get(id);
      if (node) codes.add(node.code);
    }
    return codes;
  }, [selectedNodePath, nodeById]);

  const lastSelectedNodeId = selectedNodePath.at(-1);
  const lastSelectedNode =
    lastSelectedNodeId != null && lastSelectedNodeId !== ''
      ? nodeById.get(lastSelectedNodeId)
      : undefined;
  const pathEndsAtLeaf = lastSelectedNode?.isLeaf === true;

  // Active fields: attached to a node on the path (or unattached) AND passing
  // their visibility condition.
  const activeFields = useMemo(() => {
    if (!schema) return [];
    return [...schema.fields]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((field) => {
        const attachOk =
          field.attachToNodeId == null || selectedNodePath.includes(field.attachToNodeId);
        if (!attachOk) return false;
        if (field.visibleWhen == null) return true;
        return evalCondition(field.visibleWhen, fieldValues, selectedNodeCodes);
      });
  }, [schema, selectedNodePath, fieldValues, selectedNodeCodes]);

  // Submit gate: must end at a leaf, all active required fields must be filled,
  // and no active field may have a client validation error.
  const requiredMissing = activeFields.some(
    (f) => f.required && (fieldValues[f.key] ?? '').trim() === '',
  );
  const hasValidationError = activeFields.some(
    (f) => validateFieldValue(f, fieldValues[f.key] ?? '') != null,
  );
  const canSubmit = pathEndsAtLeaf && !requiredMissing && !hasValidationError;

  function handleSelectNode(levelIndex: number, nodeId: string) {
    setSelectedNodePath((prev) => {
      // Replace at this level and reset all deeper levels.
      const next = prev.slice(0, levelIndex);
      if (nodeId !== '') next.push(nodeId);
      return next;
    });
  }

  function setFieldValue(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    typify.mutate(
      {
        conversationId,
        selectedNodePath,
        fieldValues,
        notes,
        aiAccepted: false,
      },
      {
        onSuccess: () => {
          removeConversation(conversationId);
          toast.success(t('wrap_up.success'));
          onCompleted?.();
        },
        // Errors (incl. 400 server validation) surface via the global toast in useTypify.
      },
    );
  }

  // --- Loading state -------------------------------------------------------
  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-10 text-muted-foreground"
        data-testid="typification-loading"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // --- No schema bound (404 / missing) -> friendly state, typify disabled ---
  if (isError || !schema) {
    return (
      <div className="flex flex-col gap-4 px-4" data-testid="typification-no-schema">
        <p className="text-sm text-muted-foreground">{t('typification.no_schema')}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wrapup-notes">{t('wrap_up.notes')}</Label>
          <Textarea
            id="wrapup-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('wrap_up.notes_placeholder')}
            rows={4}
            data-testid="typification-notes"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => onCompleted?.()}
            variant="outline"
            data-testid="typification-close"
          >
            {t('conversation.cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
      data-testid="typification-form"
    >
      {/* Cascading node selectors (depth-aware) */}
      {levels.map((level, levelIndex) => (
        <div className="flex flex-col gap-1.5" key={`level-${levelIndex}`}>
          <Label htmlFor={`typification-node-${levelIndex}`} required={levelIndex === 0}>
            {levelIndex === 0
              ? t('typification.outcome')
              : t('typification.refine', { level: levelIndex + 1 })}
          </Label>
          <select
            id={`typification-node-${levelIndex}`}
            data-testid={`typification-node-${levelIndex}`}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={level.selected}
            onChange={(e) => handleSelectNode(levelIndex, e.target.value)}
          >
            <option value="">{t('typification.select_outcome')}</option>
            {level.options.map((node) => (
              <option key={node.nodeId} value={node.nodeId}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Conditional fields */}
      {activeFields.map((field) => (
        <FieldRenderer
          key={field.fieldId}
          field={field}
          value={fieldValues[field.key] ?? ''}
          onChange={(v) => setFieldValue(field.key, v)}
          errorKey={validateFieldValue(field, fieldValues[field.key] ?? '')}
        />
      ))}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wrapup-notes">{t('wrap_up.notes')}</Label>
        <Textarea
          id="wrapup-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('wrap_up.notes_placeholder')}
          rows={4}
          data-testid="typification-notes"
        />
      </div>

      {/* Submit */}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onCompleted?.()} data-testid="typification-cancel">
          {t('conversation.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || typify.isPending}
          data-testid="typification-submit"
        >
          {t('wrap_up.submit')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field renderer — one ACTIVE field, dispatched by type.
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  readonly field: TypificationField;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly errorKey: string | null;
}

function FieldRenderer({ field, value, onChange, errorKey }: FieldRendererProps) {
  const { t } = useTranslation('agent');
  const inputId = `typification-field-${field.fieldId}`;

  function renderControl() {
    switch (field.type) {
      case 'Textarea':
        return (
          <Textarea
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            value={value}
            rows={3}
            maxLength={field.validation?.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'Number':
        return (
          <Input
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            type="number"
            value={value}
            min={field.validation?.min}
            max={field.validation?.max}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'Date':
        return (
          <Input
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'Boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={inputId}
              data-testid={`typification-field-${field.key}`}
              checked={value === 'true'}
              onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
            />
            <Label htmlFor={inputId} className="font-normal">
              {field.label}
            </Label>
          </div>
        );
      case 'Select':
        return (
          <Select value={value === '' ? undefined : value} onValueChange={(v) => onChange(v ?? '')}>
            <SelectTrigger className="w-full" data-testid={`typification-field-${field.key}`}>
              <SelectValue placeholder={t('typification.select_value')} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'MultiSelect': {
        const selected = new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        );
        return (
          <div
            className="flex flex-col gap-1.5 rounded-lg border border-input p-2"
            data-testid={`typification-field-${field.key}`}
          >
            {(field.options ?? []).map((opt) => {
              const optionId = `${inputId}-${opt.value}`;
              return (
                <div className="flex items-center gap-2" key={opt.value}>
                  <Checkbox
                    id={optionId}
                    data-option={opt.value}
                    checked={selected.has(opt.value)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(opt.value);
                      else next.delete(opt.value);
                      onChange([...next].join(','));
                    }}
                  />
                  <Label htmlFor={optionId} className="font-normal">
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </div>
        );
      }
      case 'Phone':
        return (
          <PhoneInput
            value={value}
            onChange={onChange}
            data-testid={`typification-field-${field.key}`}
          />
        );
      case 'Text':
      case 'Lookup':
      default:
        return (
          <Input
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            type="text"
            value={value}
            maxLength={field.validation?.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  }

  return (
    <div className="flex flex-col gap-1.5" data-field-key={field.key}>
      {/* Boolean renders its own inline label next to the checkbox. */}
      {field.type !== 'Boolean' && (
        <Label htmlFor={inputId} required={field.required}>
          {field.label}
        </Label>
      )}
      {renderControl()}
      {errorKey && (
        <p className="text-xs text-destructive" data-testid={`typification-error-${field.key}`}>
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}
