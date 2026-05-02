import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type SurveyType = 'Csat' | 'Nps' | 'Custom' | 'CSAT' | 'NPS';
export type QuestionType = 'Scale' | 'FreeText' | 'Choice';

export interface SurveyQuestion {
  text: string;
  type: QuestionType;
  options?: string[];
}

export interface Survey {
  id: string;
  name: string;
  type: SurveyType;
  isActive: boolean;
  responseCount?: number;
  questions: SurveyQuestion[];
}

export interface SurveySummary {
  surveyId: string;
  surveyName: string;
  totalResponses: number;
  avgScore: number | null;
}

export interface SurveyAnswer {
  questionId: string;
  questionText: string;
  answer: string | number;
}

export interface SurveyResponse {
  id: number;
  surveyId: string;
  respondedAt: string;
  contactName?: string;
  agentName?: string;
  score?: number;
  answers: SurveyAnswer[];
}

export function useSurveys() {
  return useQuery({
    queryKey: ['surveys'],
    queryFn: () =>
      customFetch<Survey[]>({ url: '/api/v1/admin/surveys', method: 'GET' }),
  });
}

export function useSurvey(id: string | undefined) {
  return useQuery({
    queryKey: ['survey', id],
    queryFn: () =>
      customFetch<Survey>({ url: `/api/v1/admin/surveys/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<Omit<Survey, 'id' | 'createdAt' | 'responseCount'>>) =>
      customFetch<Survey>({ url: '/api/v1/admin/surveys', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      toast.success(t('toasts.surveys.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSurvey() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<Omit<Survey, 'id' | 'createdAt' | 'responseCount'>>) =>
      customFetch<Survey>({
        url: `/api/v1/admin/surveys/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      qc.invalidateQueries({ queryKey: ['survey', variables.id] });
      toast.success(t('toasts.surveys.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/surveys/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      toast.success(t('toasts.surveys.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleSurveyActive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) =>
      customFetch<Survey>({
        url: `/api/v1/admin/surveys/${id}/activate`,
        method: 'PATCH',
        data: { isActive },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      qc.invalidateQueries({ queryKey: ['survey', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSurveySummary(surveyId: string | undefined) {
  return useQuery({
    queryKey: ['survey-summary', surveyId],
    queryFn: () =>
      customFetch<SurveySummary>({
        url: `/api/v1/analytics/surveys/${surveyId}/summary`,
        method: 'GET',
      }),
    enabled: !!surveyId,
  });
}

export function useSurveyResponses(surveyId: string | undefined) {
  return useQuery({
    queryKey: ['survey-responses', surveyId],
    queryFn: () =>
      customFetch<SurveyResponse[]>({
        url: `/api/v1/analytics/surveys/${surveyId}/responses`,
        method: 'GET',
      }),
    enabled: !!surveyId,
  });
}
