import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import {
  useSurveys,
  useSurvey,
  useCreateSurvey,
  useUpdateSurvey,
  useDeleteSurvey,
  useToggleSurveyActive,
  useSurveySummary,
  useSurveyResponses,
} from './use-surveys';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSurveys', () => {
  it('should fetch all surveys', async () => {
    const mockData = [
      {
        id: 's1',
        name: 'CSAT Survey',
        type: 'Csat',
        isActive: true,
        responseCount: 50,
        questions: [{ text: 'Rate us', type: 'Scale' }],
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSurveys(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/surveys',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSurveys(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSurvey', () => {
  it('should fetch a single survey', async () => {
    const mockData = {
      id: 's1',
      name: 'CSAT Survey',
      type: 'Csat',
      isActive: true,
      questions: [{ text: 'Rate us', type: 'Scale' }],
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSurvey('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/surveys/s1',
      method: 'GET',
    });
  });

  it('should be disabled when id is undefined', () => {
    const { result } = renderHook(() => useSurvey(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateSurvey', () => {
  it('should create a survey', async () => {
    const created = {
      id: 's2',
      name: 'NPS Survey',
      type: 'Nps',
      isActive: true,
      questions: [{ text: 'Would you recommend?', type: 'Scale' }],
    };
    vi.mocked(client.customFetch).mockResolvedValue(created);

    const { result } = renderHook(() => useCreateSurvey(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'NPS Survey',
        type: 'Nps',
        isActive: true,
        questions: [{ text: 'Would you recommend?', type: 'Scale' }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/surveys',
      method: 'POST',
      data: {
        name: 'NPS Survey',
        type: 'Nps',
        isActive: true,
        questions: [{ text: 'Would you recommend?', type: 'Scale' }],
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('creation failed'));

    const { result } = renderHook(() => useCreateSurvey(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Fail', type: 'Csat', isActive: false, questions: [] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateSurvey', () => {
  it('should update a survey', async () => {
    const updated = {
      id: 's1',
      name: 'Updated CSAT',
      type: 'Csat',
      isActive: true,
      questions: [{ text: 'Rate us 1-10', type: 'Scale' }],
    };
    vi.mocked(client.customFetch).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateSurvey(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 's1',
        name: 'Updated CSAT',
        questions: [{ text: 'Rate us 1-10', type: 'Scale' }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/surveys/s1',
      method: 'PUT',
      data: { name: 'Updated CSAT', questions: [{ text: 'Rate us 1-10', type: 'Scale' }] },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useUpdateSurvey(), { wrapper });

    act(() => {
      result.current.mutate({ id: 's1', name: 'Fail' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteSurvey', () => {
  it('should delete a survey', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteSurvey(), { wrapper });

    act(() => {
      result.current.mutate('s1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/surveys/s1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useDeleteSurvey(), { wrapper });

    act(() => {
      result.current.mutate('s1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useToggleSurveyActive', () => {
  it('should toggle survey active state', async () => {
    const toggled = { id: 's1', name: 'CSAT', type: 'Csat', isActive: false, questions: [] };
    vi.mocked(client.customFetch).mockResolvedValue(toggled);

    const { result } = renderHook(() => useToggleSurveyActive('s1'), { wrapper });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/surveys/s1/activate',
      method: 'PATCH',
      data: { isActive: false },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('toggle failed'));

    const { result } = renderHook(() => useToggleSurveyActive('s1'), { wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSurveySummary', () => {
  it('should fetch survey summary', async () => {
    const mockData = { surveyId: 's1', surveyName: 'CSAT', totalResponses: 100, avgScore: 4.2 };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSurveySummary('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/surveys/s1/summary',
      method: 'GET',
    });
  });

  it('should be disabled when surveyId is undefined', () => {
    const { result } = renderHook(() => useSurveySummary(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useSurveyResponses', () => {
  it('should fetch survey responses', async () => {
    const mockData = [
      {
        id: 1,
        surveyId: 's1',
        respondedAt: '2026-01-15',
        score: 5,
        answers: [{ questionId: 'q1', questionText: 'Rate us', answer: 5 }],
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSurveyResponses('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/surveys/s1/responses',
      method: 'GET',
    });
  });

  it('should be disabled when surveyId is undefined', () => {
    const { result } = renderHook(() => useSurveyResponses(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
