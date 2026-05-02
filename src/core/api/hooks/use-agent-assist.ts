// AGENT ASSIST: deferred to v1.7.0+ as 8-layer cross-repo activation project.
// These hooks are retained but not used in navigation. Backend is dead code:
// engine disabled, config store is a museum, session stores empty at runtime.
// DTO contracts in this file also drift from backend (`enabled`/`samplingRate`/
// `isActive` do not exist backend-side) — will be rewritten against canonical
// SDK types in v1.7.0 Layer 8.
// Full activation spec: memory/project_agent_assist_deferred.md
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface AgentAssistConfig {
  enabled: boolean;
  suggestionTimeoutMs: number;
  sentimentTimeoutMs: number;
  complianceTimeoutMs: number;
  queueNames: string[];
  samplingRate: number;
}

export interface KeywordRule {
  id: string;
  keyword: string;
  suggestionText: string;
  priority: string; // Informational, Important, Urgent, Critical
  isActive: boolean;
}

export function useAgentAssistConfig() {
  return useQuery({
    queryKey: ['agent-assist', 'config'],
    queryFn: () =>
      customFetch<AgentAssistConfig>({ url: '/api/v1/admin/agent-assist/config', method: 'GET' }),
  });
}

export function useUpdateAgentAssistConfig() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<AgentAssistConfig>) =>
      customFetch<AgentAssistConfig>({
        url: '/api/v1/admin/agent-assist/config',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist', 'config'] });
      toast.success(t('toasts.agentAssist.configUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useKeywordRules() {
  return useQuery({
    queryKey: ['agent-assist', 'keyword-rules'],
    queryFn: () =>
      customFetch<KeywordRule[]>({ url: '/api/v1/admin/agent-assist/keyword-rules', method: 'GET' }),
  });
}

export function useUpdateKeywordRules() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: KeywordRule[]) =>
      customFetch<KeywordRule[]>({
        url: '/api/v1/admin/agent-assist/keyword-rules',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist', 'keyword-rules'] });
      toast.success(t('toasts.agentAssist.keywordRulesUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface ComplianceRule {
  ruleId: string;
  pattern: string;
  severity: 'Info' | 'Warning' | 'Critical';
  action: 'Alert' | 'Block' | 'Log';
  description?: string;
}

export function useComplianceRules() {
  return useQuery({
    queryKey: ['agent-assist', 'compliance-rules'],
    queryFn: () =>
      customFetch<ComplianceRule[]>({
        url: '/api/v1/admin/agent-assist/compliance-rules',
        method: 'GET',
      }),
  });
}

export function useUpdateComplianceRules() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: ComplianceRule[]) =>
      customFetch<ComplianceRule[]>({
        url: '/api/v1/admin/agent-assist/compliance-rules',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist', 'compliance-rules'] });
      toast.success(t('toasts.agentAssist.complianceRulesUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
