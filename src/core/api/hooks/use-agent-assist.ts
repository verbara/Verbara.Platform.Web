import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
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
      customFetch<AgentAssistConfig>({ url: '/api/admin/agent-assist/config', method: 'GET' }),
  });
}

export function useUpdateAgentAssistConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AgentAssistConfig>) =>
      customFetch<AgentAssistConfig>({
        url: '/api/admin/agent-assist/config',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist', 'config'] });
      toast.success('Agent Assist config updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useKeywordRules() {
  return useQuery({
    queryKey: ['agent-assist', 'keyword-rules'],
    queryFn: () =>
      customFetch<KeywordRule[]>({ url: '/api/admin/agent-assist/keyword-rules', method: 'GET' }),
  });
}

export function useUpdateKeywordRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: KeywordRule[]) =>
      customFetch<KeywordRule[]>({
        url: '/api/admin/agent-assist/keyword-rules',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist', 'keyword-rules'] });
      toast.success('Keyword rules updated');
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
        url: '/api/admin/agent-assist/compliance-rules',
        method: 'GET',
      }),
  });
}

export function useUpdateComplianceRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ComplianceRule[]) =>
      customFetch<ComplianceRule[]>({
        url: '/api/admin/agent-assist/compliance-rules',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-assist', 'compliance-rules'] });
      toast.success('Compliance rules updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
