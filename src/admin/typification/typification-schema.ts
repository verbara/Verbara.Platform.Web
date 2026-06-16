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

// AI auto-disposition modes (P2b graduated bands).
//   Off        — AI disabled for this schema's disposition flow.
//   Shadow     — AI runs silently to accumulate calibration; nothing surfaced.
//   SuggestOnly— the agent always confirms the suggestion.
//   AutoFill   — the form auto-fills; gated behind the calibration bar.
export const AI_MODES = ['Off', 'Shadow', 'SuggestOnly', 'AutoFill'] as const;

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
// Prefill source (auto-fill from captured data) — optional sub-form.
// P1 fixes the kind to "Metadata"; `ref` is the conversation metadata key.
// ---------------------------------------------------------------------------

export const prefillSchema = z.object({
  enabled: z.boolean(),
  ref: z.string(),
});

export type PrefillFormValue = z.infer<typeof prefillSchema>;

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
  prefill: prefillSchema,
  sortOrder: z.number(),
});

export type FieldFormValue = z.infer<typeof fieldSchema>;

// ---------------------------------------------------------------------------
// AI auto-disposition config — optional sub-form on the schema (P2b bands).
// The three thresholds are 0–100 PERCENTS in the form for UX; the mapper
// converts each to the 0–1 fraction the DTO carries. The `autonomous` flag and
// `dailyTokenBudget` are NOT edited here (Batch E concerns) — they exist purely
// to round-trip the server-persisted values so a designer save (a FULL REPLACE
// on the API) never silently clobbers them.
// ---------------------------------------------------------------------------

export const aiConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(AI_MODES),
  suggestThresholdPercent: z
    .number()
    .min(0, 'admin:typification.ai.validation.thresholdRange')
    .max(100, 'admin:typification.ai.validation.thresholdRange'),
  autoApplyThresholdPercent: z
    .number()
    .min(0, 'admin:typification.ai.validation.thresholdRange')
    .max(100, 'admin:typification.ai.validation.thresholdRange'),
  autonomousThresholdPercent: z
    .number()
    .min(0, 'admin:typification.ai.validation.thresholdRange')
    .max(100, 'admin:typification.ai.validation.thresholdRange'),
  // Passthrough fields — no input control. They round-trip the server's value so
  // a save preserves whatever was persisted until Batch E adds editors for them.
  autonomous: z.boolean(),
  dailyTokenBudget: z.number().nullable(),
  sentimentGating: z.boolean(),
});

export type AiConfigFormValue = z.infer<typeof aiConfigSchema>;

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
  aiConfig: aiConfigSchema,
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
