import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export type ReportType = 'CDRSummary' | 'QASummary' | 'IntervalReport' | 'AgentPerformance';
export type ReportFormat = 'CSV' | 'PDF';

export interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  schedule: string;
  cronExpression?: string;
  filters?: string;
  recipients?: string;
  format: ReportFormat;
  isActive: boolean;
  createdAt: string;
}

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () =>
      customFetch<ScheduledReport[]>({ url: '/api/v1/admin/reports', method: 'GET' }),
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () =>
      customFetch<ScheduledReport>({ url: `/api/v1/admin/reports/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ScheduledReport, 'id' | 'createdAt'>) =>
      customFetch<ScheduledReport>({ url: '/api/v1/admin/reports', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<Omit<ScheduledReport, 'id' | 'createdAt'>>) =>
      customFetch<ScheduledReport>({
        url: `/api/v1/admin/reports/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['report', variables.id] });
      toast.success('Report updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/reports/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRunReport() {
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/reports/${id}/run`, method: 'POST' }),
    onSuccess: () => toast.success('Report execution started'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface ReportExecution {
  id: string;
  reportId: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export function useReportHistory(reportId: string | undefined) {
  return useQuery({
    queryKey: ['report-history', reportId],
    queryFn: () =>
      customFetch<ReportExecution[]>({
        url: `/api/v1/admin/reports/${reportId}/history`,
        method: 'GET',
        params: { limit: '25' },
      }),
    enabled: !!reportId,
  });
}
