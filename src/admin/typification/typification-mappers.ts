import type {
  TypificationSchema,
  TypificationNode,
  TypificationField,
  TypificationCondition,
  CreateSchemaInput,
} from '@/core/api/hooks/use-typification';
import type {
  TypificationSchemaFormValues,
  NodeFormValue,
  FieldFormValue,
} from './typification-schema';
import { AI_MODES } from './typification-schema';

/** Sentinel select value for "no parent / root node" and "not attached". */
export const NONE_VALUE = '__none__';

function newClientId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyNode(sortOrder: number): NodeFormValue {
  return {
    nodeId: newClientId('node'),
    parentNodeId: NONE_VALUE,
    label: '',
    code: '',
    sortOrder,
    isLeaf: false,
    leafCategory: 'Success',
    triggerRetry: false,
    retryDelayMinutes: undefined,
    triggerCallback: false,
    dialerCode: '',
    isActive: true,
  };
}

export function emptyField(sortOrder: number): FieldFormValue {
  return {
    fieldId: newClientId('field'),
    key: '',
    label: '',
    type: 'Text',
    required: false,
    options: [],
    regex: '',
    min: undefined,
    max: undefined,
    maxLength: undefined,
    attachToNodeId: NONE_VALUE,
    visibleWhen: {
      enabled: false,
      refType: 'Field',
      ref: '',
      op: 'Eq',
      value: '',
    },
    prefill: {
      enabled: false,
      ref: '',
    },
    sortOrder,
  };
}

export const DEFAULT_FORM_VALUES: TypificationSchemaFormValues = {
  name: '',
  maxDepth: 5,
  nodes: [],
  fields: [],
  aiConfig: {
    enabled: false,
    // A new schema starts in Shadow — the safe band that accumulates calibration
    // without surfacing anything, so enabling AI does something useful (not Off).
    mode: 'Shadow',
    // Stored as PERCENTS in the form (0–100); mapped to 0–1 fractions in the DTO.
    suggestThresholdPercent: 60,
    autoApplyThresholdPercent: 85,
    autonomousThresholdPercent: 95,
    sentimentGating: true,
  },
};

// ---------------------------------------------------------------------------
// DTO -> form
// ---------------------------------------------------------------------------

function nodeToForm(node: TypificationNode): NodeFormValue {
  return {
    nodeId: node.nodeId,
    parentNodeId: node.parentNodeId ?? NONE_VALUE,
    label: node.label,
    code: node.code,
    sortOrder: node.sortOrder,
    isLeaf: node.isLeaf,
    leafCategory: node.leaf?.category ?? 'Success',
    triggerRetry: node.leaf?.triggerRetry ?? false,
    retryDelayMinutes: node.leaf?.retryDelayMinutes,
    triggerCallback: node.leaf?.triggerCallback ?? false,
    dialerCode: node.leaf?.dialerCode ?? '',
    isActive: node.leaf?.isActive ?? true,
  };
}

function fieldToForm(field: TypificationField): FieldFormValue {
  const vw = field.visibleWhen;
  return {
    fieldId: field.fieldId,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options ? field.options.map((o) => ({ value: o.value, label: o.label })) : [],
    regex: field.validation?.regex ?? '',
    min: field.validation?.min,
    max: field.validation?.max,
    maxLength: field.validation?.maxLength,
    attachToNodeId: field.attachToNodeId ?? NONE_VALUE,
    visibleWhen: {
      enabled: !!vw,
      refType: vw?.refType ?? 'Field',
      ref: vw?.ref ?? '',
      op: vw?.op ?? 'Eq',
      value: vw?.value ?? '',
    },
    prefill: {
      // P1 surfaces only the Metadata kind; hydrate the control whenever a
      // prefill source is present so existing config round-trips.
      enabled: !!field.prefillSource,
      ref: field.prefillSource?.ref ?? '',
    },
    sortOrder: field.sortOrder,
  };
}

/**
 * Map a persisted AI mode tolerantly onto the P2b vocabulary. The 4 P2b modes
 * pass through; the legacy P2a `AutoApplyAboveThreshold` maps to `AutoFill`;
 * anything else (incl. absent) defaults to the safe `Shadow` band.
 */
function toAiMode(mode: string | undefined): (typeof AI_MODES)[number] {
  if (mode === 'Off' || mode === 'Shadow' || mode === 'SuggestOnly' || mode === 'AutoFill') {
    return mode;
  }
  if (mode === 'AutoApplyAboveThreshold') return 'AutoFill';
  return 'Shadow';
}

export function schemaToForm(schema: TypificationSchema): TypificationSchemaFormValues {
  const ai = schema.aiConfig;
  return {
    name: schema.name,
    maxDepth: schema.maxDepth,
    nodes: schema.nodes.map(nodeToForm),
    fields: schema.fields.map(fieldToForm),
    aiConfig: {
      enabled: ai?.enabled ?? false,
      mode: toAiMode(ai?.mode),
      // DTO carries 0–1 fractions; the form edits 0–100 percents.
      suggestThresholdPercent: ai ? Math.round(ai.suggestThreshold * 100) : 60,
      autoApplyThresholdPercent: ai ? Math.round(ai.autoApplyThreshold * 100) : 85,
      autonomousThresholdPercent: ai ? Math.round(ai.autonomousThreshold * 100) : 95,
      sentimentGating: ai?.sentimentGating ?? true,
    },
  };
}

// ---------------------------------------------------------------------------
// form -> DTO (CreateSchemaInput / UpdateSchemaInput share the same shape)
// ---------------------------------------------------------------------------

function formToNode(node: NodeFormValue, index: number): TypificationNode {
  const dto: TypificationNode = {
    nodeId: node.nodeId,
    parentNodeId: node.parentNodeId === NONE_VALUE ? undefined : node.parentNodeId,
    label: node.label.trim(),
    code: node.code.trim(),
    sortOrder: index,
    isLeaf: node.isLeaf,
  };
  if (node.isLeaf) {
    dto.leaf = {
      category: node.leafCategory,
      triggerRetry: node.triggerRetry,
      retryDelayMinutes: node.triggerRetry ? node.retryDelayMinutes : undefined,
      triggerCallback: node.triggerCallback,
      dialerCode: node.dialerCode?.trim() ? node.dialerCode.trim() : undefined,
      isActive: node.isActive,
    };
  }
  return dto;
}

function formToField(field: FieldFormValue, index: number): TypificationField {
  const supportsOptions = field.type === 'Select' || field.type === 'MultiSelect';
  const hasValidation =
    !!field.regex?.trim() ||
    field.min !== undefined ||
    field.max !== undefined ||
    field.maxLength !== undefined;

  const dto: TypificationField = {
    fieldId: field.fieldId,
    key: field.key.trim(),
    label: field.label.trim(),
    type: field.type,
    required: field.required,
    sortOrder: index,
  };

  if (supportsOptions && field.options.length > 0) {
    dto.options = field.options
      .filter((o) => o.value.trim() || o.label.trim())
      .map((o) => ({ value: o.value.trim(), label: o.label.trim() }));
  }

  if (hasValidation) {
    dto.validation = {
      regex: field.regex?.trim() ? field.regex.trim() : undefined,
      min: field.min,
      max: field.max,
      maxLength: field.maxLength,
    };
  }

  if (field.attachToNodeId !== NONE_VALUE) {
    dto.attachToNodeId = field.attachToNodeId;
  }

  if (field.visibleWhen.enabled && field.visibleWhen.ref.trim()) {
    const condition: TypificationCondition = {
      refType: field.visibleWhen.refType,
      ref: field.visibleWhen.ref.trim(),
      op: field.visibleWhen.op,
      value: field.visibleWhen.value?.trim() ? field.visibleWhen.value.trim() : undefined,
    };
    dto.visibleWhen = condition;
  }

  if (field.prefill.enabled && field.prefill.ref.trim()) {
    // P1: kind is fixed to "Metadata" (AiEntity / DataDip are future phases).
    dto.prefillSource = { kind: 'Metadata', ref: field.prefill.ref.trim() };
  }

  return dto;
}

export function formToInput(values: TypificationSchemaFormValues): CreateSchemaInput {
  const ai = values.aiConfig;
  return {
    name: values.name.trim(),
    maxDepth: values.maxDepth,
    nodes: values.nodes.map((n, i) => formToNode(n, i)),
    fields: values.fields.map((f, i) => formToField(f, i)),
    aiConfig: {
      enabled: ai.enabled,
      mode: ai.mode,
      // Form edits 0–100 percents; the DTO carries 0–1 fractions.
      suggestThreshold: ai.suggestThresholdPercent / 100,
      autoApplyThreshold: ai.autoApplyThresholdPercent / 100,
      autonomousThreshold: ai.autonomousThresholdPercent / 100,
      // C4-web does NOT edit the autonomous-commit flag or the daily token
      // budget — both arrive in Batch E. Always emit autonomous:false; omit
      // dailyTokenBudget entirely (the API treats absent as null).
      autonomous: false,
      sentimentGating: ai.sentimentGating,
    },
  };
}
