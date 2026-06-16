import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { PaymentRequiredError } from '@/core/licensing';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types — mirror the Platform typification DTOs (camelCase over the wire).
// ---------------------------------------------------------------------------

export interface TypificationCondition {
  refType: 'Field' | 'NodeSelected';
  ref: string;
  op: 'Eq' | 'Neq' | 'In' | 'Contains' | 'Exists' | 'GreaterThan' | 'LessThan';
  value?: string;
}

export interface TypificationFieldValidation {
  regex?: string;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface TypificationFieldOption {
  value: string;
  label: string;
}

/**
 * Auto-fill source for a field (B1 flow-vars → metadata → field-prefill).
 * P1 only emits `kind: 'Metadata'` (AiEntity / DataDip are future phases);
 * `ref` is the conversation metadata key (e.g. "patientId").
 */
export interface TypificationFieldPrefillSource {
  kind: 'Metadata' | 'AiEntity' | 'DataDip';
  ref: string;
}

export type TypificationFieldType =
  | 'Text'
  | 'Textarea'
  | 'Number'
  | 'Date'
  | 'Boolean'
  | 'Select'
  | 'MultiSelect'
  | 'Phone'
  | 'Lookup';

export interface TypificationField {
  fieldId: string;
  key: string;
  label: string;
  type: TypificationFieldType;
  required: boolean;
  options?: TypificationFieldOption[];
  validation?: TypificationFieldValidation;
  attachToNodeId?: string;
  visibleWhen?: TypificationCondition;
  prefillSource?: TypificationFieldPrefillSource;
  sortOrder: number;
}

export interface LeafOutcome {
  category: 'Success' | 'Failure' | 'FollowUp' | 'Retry' | 'SystemResult';
  triggerRetry: boolean;
  retryDelayMinutes?: number;
  triggerCallback: boolean;
  dialerCode?: string;
  isActive: boolean;
}

export interface TypificationNode {
  nodeId: string;
  parentNodeId?: string;
  label: string;
  code: string;
  sortOrder: number;
  isLeaf: boolean;
  channelApplicability?: string[];
  leaf?: LeafOutcome;
}

/**
 * AI auto-disposition configuration carried on the schema admin DTO (P2b).
 * `mode` is one of {@link TypificationAiMode}. The three thresholds are graduated
 * confidence bands (each a 0–1 fraction): below `suggestThreshold` nothing is
 * surfaced; at/above `suggestThreshold` the agent sees a suggestion; at/above
 * `autoApplyThreshold` the form may auto-fill (gated by calibration); at/above
 * `autonomousThreshold` the disposition may commit without an agent (Batch E).
 * `autonomous` is the autonomous-commit flag; `dailyTokenBudget` caps spend.
 */
export type TypificationAiMode = 'Off' | 'Shadow' | 'SuggestOnly' | 'AutoFill';

export interface TypificationAiConfig {
  enabled: boolean;
  mode: string; // one of TypificationAiMode; string for tolerance
  suggestThreshold: number; // 0–1
  autoApplyThreshold: number; // 0–1
  autonomousThreshold: number; // 0–1
  autonomous: boolean;
  sentimentGating: boolean;
  dailyTokenBudget?: number | null;
  /** AI-entity-name → schema field Key (drives entity extraction/prefill). */
  entityFieldMap?: Record<string, string>;
  /** PiiType names the tenant allows the AI to store unmasked (default empty = mask all). */
  piiAllowStore?: string[];
}

/**
 * Calibration status for a schema (C4-api). Drives the AutoFill mode gate and
 * the designer's status panel. Returns all-zero / not-ready for an uncalibrated
 * schema; gated by `typification:ai:configure`.
 */
export interface TypificationCalibrationStatus {
  samples: number;
  accuracy: number; // 0–1 fraction
  autoFillReady: boolean;
  autonomousReady: boolean;
}

export interface TypificationSchema {
  schemaId: string;
  name: string;
  version: number;
  isPublished: boolean;
  maxDepth: number;
  nodes: TypificationNode[];
  fields: TypificationField[];
  aiConfig?: TypificationAiConfig;
  createdAt: string;
  updatedAt?: string;
}

export interface SchemaBinding {
  bindingId: string;
  scope: 'Tenant' | 'Queue' | 'Campaign' | 'Channel' | 'Direction';
  scopeRef?: string;
  schemaId: string;
  subtreeRootNodeId?: string;
  priority: number;
}

export interface PublishError {
  field: string;
  message: string;
}

export interface PublishResult {
  ok: boolean;
  errors: PublishError[];
}

export interface TypificationFormResponse {
  schema: TypificationSchema;
  subtreeRootNodeId?: string;
  /**
   * Server-provided FULL root→leaf node-id path to preselect the cascade
   * (longest-valid-prefix; may be partial). Null when nothing is preselectable.
   */
  prefilledNodePath?: string[];
  /** Server-provided field values keyed by field Key. Null when none. */
  prefilledFieldValues?: Record<string, string>;
}

/**
 * AI disposition suggestion (P2a). All members are null when there is no
 * suggestion (AI disabled / no schema / no transcript / low-confidence /
 * sentiment-gated) and on 402 (unlicensed tenant — see useTypificationSuggestion).
 */
export interface TypificationSuggestionResponse {
  /** FULL root→leaf node-id path the AI suggests (same shape as prefilledNodePath). */
  suggestedNodePath?: string[];
  /** Suggested field values keyed by field Key. */
  suggestedFieldValues?: Record<string, string>;
  /** Model confidence as a 0–1 fraction. */
  confidence?: number;
  /**
   * Detected sentiment label, emitted verbatim by the LLM classifier as a
   * lowercase snake_case token: "positive" | "neutral" | "negative" |
   * "very_negative". Passed through with no casing transform.
   */
  sentiment?: string;
  /**
   * Server-authoritative delivery band (P2b). 'None' = nothing surfaced;
   * 'Suggest' = show the Accept banner (agent confirms); 'AutoFill' = the form
   * may be pre-filled automatically. The client MUST NOT escalate the band.
   */
  band?: 'None' | 'Suggest' | 'AutoFill';
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface CreateSchemaInput {
  name: string;
  maxDepth: number;
  nodes: TypificationNode[];
  fields: TypificationField[];
  aiConfig?: TypificationAiConfig;
}

export type UpdateSchemaInput = CreateSchemaInput;

export interface CreateBindingInput {
  scope: SchemaBinding['scope'];
  scopeRef?: string;
  schemaId: string;
  subtreeRootNodeId?: string;
  priority: number;
}

export type UpdateBindingInput = CreateBindingInput;

export interface TypifyInput {
  selectedNodePath: string[];
  fieldValues: Record<string, string>;
  notes?: string;
  aiAccepted?: boolean;
  /** P2a: an AI suggestion was surfaced for this disposition (sets Source=AutoAi). */
  aiSuggested?: boolean;
  /** P2a: the suggestion's confidence (0–1) at the moment the agent acted on it. */
  aiConfidence?: number;
}

// ---------------------------------------------------------------------------
// Schemas — admin (gated; 402 surfaces globally via customFetch)
// ---------------------------------------------------------------------------

export function useTypificationSchemas() {
  return useQuery({
    queryKey: ['typification', 'schemas'],
    queryFn: () =>
      customFetch<TypificationSchema[]>({
        url: '/api/v1/admin/typification/schemas',
        method: 'GET',
      }),
  });
}

export function useTypificationSchema(id: string | undefined) {
  return useQuery({
    queryKey: ['typification', 'schema', id],
    queryFn: () =>
      customFetch<TypificationSchema>({
        url: `/api/v1/admin/typification/schemas/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCalibrationStatus(schemaId: string | undefined) {
  return useQuery({
    queryKey: ['typification', 'calibration', schemaId],
    queryFn: () =>
      customFetch<TypificationCalibrationStatus>({
        url: `/api/v1/admin/typification/schemas/${schemaId}/calibration-status`,
        method: 'GET',
      }),
    enabled: !!schemaId,
  });
}

export function useCreateTypificationSchema() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateSchemaInput) =>
      customFetch<TypificationSchema>({
        url: '/api/v1/admin/typification/schemas',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['typification', 'schemas'] });
      toast.success(t('toasts.typification.schemaCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTypificationSchema() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateSchemaInput) =>
      customFetch<TypificationSchema>({
        url: `/api/v1/admin/typification/schemas/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['typification', 'schemas'] });
      qc.invalidateQueries({ queryKey: ['typification', 'schema', variables.id] });
      toast.success(t('toasts.typification.schemaUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTypificationSchema() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/admin/typification/schemas/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['typification', 'schemas'] });
      toast.success(t('toasts.typification.schemaDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePublishTypificationSchema() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<PublishResult>({
        url: `/api/v1/admin/typification/schemas/${id}/publish`,
        method: 'POST',
      }),
    onSuccess: (result, id) => {
      qc.invalidateQueries({ queryKey: ['typification', 'schemas'] });
      qc.invalidateQueries({ queryKey: ['typification', 'schema', id] });
      if (result.ok) {
        toast.success(t('toasts.typification.schemaPublished'));
      } else {
        toast.error(t('toasts.typification.schemaPublishFailed'));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ---------------------------------------------------------------------------
// Bindings — admin (gated)
// ---------------------------------------------------------------------------

export function useTypificationBindings() {
  return useQuery({
    queryKey: ['typification', 'bindings'],
    queryFn: () =>
      customFetch<SchemaBinding[]>({
        url: '/api/v1/admin/typification/bindings',
        method: 'GET',
      }),
  });
}

export function useCreateTypificationBinding() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateBindingInput) =>
      customFetch<SchemaBinding>({
        url: '/api/v1/admin/typification/bindings',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['typification', 'bindings'] });
      toast.success(t('toasts.typification.bindingCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTypificationBinding() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateBindingInput) =>
      customFetch<SchemaBinding>({
        url: `/api/v1/admin/typification/bindings/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['typification', 'bindings'] });
      toast.success(t('toasts.typification.bindingUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTypificationBinding() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/admin/typification/bindings/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['typification', 'bindings'] });
      toast.success(t('toasts.typification.bindingDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ---------------------------------------------------------------------------
// Runtime — conversation wrap-up (NOT gated)
// ---------------------------------------------------------------------------

export function useTypificationForm(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: ['typification', 'form', conversationId],
    queryFn: () =>
      customFetch<TypificationFormResponse>({
        url: `/api/v1/conversations/${conversationId}/typification-form`,
        method: 'GET',
      }),
    enabled: enabled && !!conversationId,
  });
}

/**
 * Fires the AI disposition-suggestion request for a conversation (P2a). It is a
 * POST that triggers an LLM call, so it is modelled as a mutation the wrap-up
 * form fires ONCE after the form loads (guarded by the form's hydration key).
 *
 * License gating: the endpoint requires AdvancedTypification + TypificationAi
 * and returns 402 for unlicensed tenants. AI is a purely additive affordance —
 * an unlicensed tenant simply has no AI banner — so a 402 resolves to an EMPTY
 * suggestion (NO toast, NO upgrade modal). `suppressPaymentRequiredModal` keeps
 * the global upgrade dialog from popping; the thrown PaymentRequiredError is
 * caught here and mapped to `{}`. Any other error also resolves empty (silent)
 * so a transient AI failure never blocks manual wrap-up.
 */
export function useTypificationSuggestion() {
  return useMutation({
    mutationFn: async (conversationId: string): Promise<TypificationSuggestionResponse> => {
      try {
        return await customFetch<TypificationSuggestionResponse>({
          url: `/api/v1/conversations/${conversationId}/typification-suggestion`,
          method: 'POST',
          suppressPaymentRequiredModal: true,
        });
      } catch (err) {
        // 402 (unlicensed) → no AI affordance, resolve empty silently.
        if (err instanceof PaymentRequiredError) return {};
        // Any other failure must not block manual wrap-up; degrade to no suggestion.
        return {};
      }
    },
  });
}

export function useTypify() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ conversationId, ...data }: { conversationId: string } & TypifyInput) =>
      customFetch<void>({
        url: `/api/v1/conversations/${conversationId}/typify`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['typification', 'form', variables.conversationId],
      });
      toast.success(t('toasts.typification.typified'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
