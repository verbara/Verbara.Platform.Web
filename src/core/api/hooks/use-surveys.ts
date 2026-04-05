import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export type SurveyType = 'CSAT' | 'NPS' | 'Custom';
export type QuestionType = 'Scale' | 'FreeText' | 'Choice';

export interface SurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  order: number;
}

export interface Survey {
  id: number;
  name: string;
  type: SurveyType;
  isActive: boolean;
  responseCount?: number;
  questions: SurveyQuestion[];
  createdAt: string;
}

export interface SurveySummary {
  surveyId: number;
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
  surveyId: number;
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

export function useSurvey(id: number | undefined) {
  return useQuery({
    queryKey: ['survey', id],
    queryFn: () =>
      customFetch<Survey>({ url: `/api/v1/admin/surveys/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<Survey, 'id' | 'createdAt' | 'responseCount'>>) =>
      customFetch<Survey>({ url: '/api/v1/admin/surveys', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      toast.success('Survey created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<Omit<Survey, 'id' | 'createdAt' | 'responseCount'>>) =>
      customFetch<Survey>({
        url: `/api/v1/admin/surveys/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      qc.invalidateQueries({ queryKey: ['survey', variables.id] });
      toast.success('Survey updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/surveys/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      toast.success('Survey deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleSurveyActive(id: number) {
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

export function useSurveySummary(surveyId: number | undefined) {
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

export function useSurveyResponses(surveyId: number | undefined) {
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
