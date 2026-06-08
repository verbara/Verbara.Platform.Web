import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
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

export interface TypificationSchema {
  schemaId: string;
  name: string;
  version: number;
  isPublished: boolean;
  maxDepth: number;
  nodes: TypificationNode[];
  fields: TypificationField[];
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
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface CreateSchemaInput {
  name: string;
  maxDepth: number;
  nodes: TypificationNode[];
  fields: TypificationField[];
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
