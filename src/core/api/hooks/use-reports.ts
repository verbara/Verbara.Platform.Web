import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export type ReportType = 'CDRSummary' | 'QASummary' | 'IntervalReport' | 'AgentPerformance';
export type ReportFormat = 'CSV' | 'PDF';
export type ReportSchedule = 'daily_8am' | 'weekly_monday' | 'monthly_1st' | 'custom';

export interface ScheduledReport {
  id: number;
  name: string;
  type: ReportType;
  schedule: ReportSchedule;
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
      customFetch<ScheduledReport[]>({ url: '/api/admin/reports', method: 'GET' }),
  });
}

export function useReport(id: number | undefined) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () =>
      customFetch<ScheduledReport>({ url: `/api/admin/reports/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ScheduledReport, 'id' | 'createdAt'>) =>
      customFetch<ScheduledReport>({ url: '/api/admin/reports', method: 'POST', data }),
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
    }: { id: number } & Partial<Omit<ScheduledReport, 'id' | 'createdAt'>>) =>
      customFetch<ScheduledReport>({
        url: `/api/admin/reports/${id}`,
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
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/admin/reports/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleReportActive(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) =>
      customFetch<ScheduledReport>({
        url: `/api/admin/reports/${id}/activate`,
        method: 'PATCH',
        data: { isActive },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['report', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
