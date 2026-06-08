import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum tuples — mirror the Platform typification DTO vocabularies.
// ---------------------------------------------------------------------------

export const FIELD_TYPES = [
  'Text',
  'Textarea',
  'Number',
  'Date',
  'Boolean',
  'Select',
  'MultiSelect',
  'Phone',
  'Lookup',
] as const;

export const LEAF_CATEGORIES = ['Success', 'Failure', 'FollowUp', 'Retry', 'SystemResult'] as const;

export const CONDITION_REF_TYPES = ['Field', 'NodeSelected'] as const;

export const CONDITION_OPS = [
  'Eq',
  'Neq',
  'In',
  'Contains',
  'Exists',
  'GreaterThan',
  'LessThan',
] as const;

export const BINDING_SCOPES = ['Tenant', 'Queue', 'Campaign', 'Channel', 'Direction'] as const;

// ---------------------------------------------------------------------------
// Condition (visibleWhen) — optional sub-form.
// ---------------------------------------------------------------------------

export const conditionSchema = z.object({
  enabled: z.boolean(),
  refType: z.enum(CONDITION_REF_TYPES),
  ref: z.string(),
  op: z.enum(CONDITION_OPS),
  value: z.string().optional(),
});

export type ConditionFormValue = z.infer<typeof conditionSchema>;

// ---------------------------------------------------------------------------
// Node editor row.
// ---------------------------------------------------------------------------

export const nodeSchema = z.object({
  nodeId: z.string(),
  parentNodeId: z.string(),
  label: z.string().min(1, 'admin:typification.validation.nodeLabelRequired'),
  code: z.string().min(1, 'admin:typification.validation.nodeCodeRequired'),
  sortOrder: z.number(),
  isLeaf: z.boolean(),
  // Leaf outcome — only meaningful when isLeaf is true.
  leafCategory: z.enum(LEAF_CATEGORIES),
  triggerRetry: z.boolean(),
  retryDelayMinutes: z.number().optional(),
  triggerCallback: z.boolean(),
  dialerCode: z.string().optional(),
  isActive: z.boolean(),
});

export type NodeFormValue = z.infer<typeof nodeSchema>;

// ---------------------------------------------------------------------------
// Field editor row.
// ---------------------------------------------------------------------------

export const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const fieldSchema = z.object({
  fieldId: z.string(),
  key: z.string().min(1, 'admin:typification.validation.fieldKeyRequired'),
  label: z.string().min(1, 'admin:typification.validation.fieldLabelRequired'),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  options: z.array(fieldOptionSchema),
  // Validation block (collapsible / optional).
  regex: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().optional(),
  attachToNodeId: z.string(),
  visibleWhen: conditionSchema,
  sortOrder: z.number(),
});

export type FieldFormValue = z.infer<typeof fieldSchema>;

// ---------------------------------------------------------------------------
// Top-level schema designer form.
// ---------------------------------------------------------------------------

export const typificationSchemaForm = z.object({
  name: z.string().min(1, 'admin:typification.validation.nameRequired'),
  maxDepth: z
    .number()
    .min(1, 'admin:typification.validation.maxDepthRange')
    .max(8, 'admin:typification.validation.maxDepthRange'),
  nodes: z.array(nodeSchema),
  fields: z.array(fieldSchema),
});

export type TypificationSchemaFormValues = z.infer<typeof typificationSchemaForm>;

// ---------------------------------------------------------------------------
// Binding form.
// ---------------------------------------------------------------------------

export const bindingSchemaForm = z.object({
  scope: z.enum(BINDING_SCOPES),
  scopeRef: z.string().optional(),
  schemaId: z.string().min(1, 'admin:typification.bindings.validation.schemaRequired'),
  subtreeRootNodeId: z.string().optional(),
  priority: z.number(),
});

export type BindingFormValues = z.infer<typeof bindingSchemaForm>;
