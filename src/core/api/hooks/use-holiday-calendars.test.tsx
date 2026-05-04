import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useHolidayCalendars,
  useHolidayCalendar,
  useHolidayCalendarHolidays,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
  useAddHoliday,
  useRemoveHoliday,
} from './use-holiday-calendars';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleCalendar = {
  id: 1,
  name: 'US Holidays 2026',
};

const sampleHoliday = {
  id: 10,
  name: 'Independence Day',
  date: '2026-07-04',
  allowedStartTime: '09:00',
  allowedEndTime: '17:00',
};

describe('useHolidayCalendars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch holiday calendars when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleCalendar]);
    const { result } = renderHook(() => useHolidayCalendars(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleCalendar]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useHolidayCalendars(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useHolidayCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch holiday calendar by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleCalendar);
    const { result } = renderHook(() => useHolidayCalendar(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleCalendar);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars/1',
      method: 'GET',
    });
  });

  it('should not fetch when id is 0', () => {
    const { result } = renderHook(() => useHolidayCalendar(0), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useHolidayCalendar(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useHolidayCalendarHolidays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch holidays for calendar when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleHoliday]);
    const { result } = renderHook(() => useHolidayCalendarHolidays(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleHoliday]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars/1/holidays',
      method: 'GET',
    });
  });

  it('should not fetch when calendarId is 0', () => {
    const { result } = renderHook(() => useHolidayCalendarHolidays(0), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useHolidayCalendarHolidays(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleCalendar);
    const { result } = renderHook(() => useCreateCalendar(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'US Holidays 2026' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars',
      method: 'POST',
      data: { name: 'US Holidays 2026' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Conflict'));
    const { result } = renderHook(() => useCreateCalendar(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Calendar' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleCalendar);
    const { result } = renderHook(() => useUpdateCalendar(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, name: 'Updated Calendar' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars/1',
      method: 'PUT',
      data: { name: 'Updated Calendar' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateCalendar(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, name: 'X' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteCalendar(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars/1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteCalendar(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAddHoliday', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleHoliday);
    const { result } = renderHook(() => useAddHoliday(), { wrapper });
    act(() => {
      result.current.mutate({ calendarId: 1, name: 'Independence Day', date: '2026-07-04' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars/1/holidays',
      method: 'POST',
      data: { name: 'Independence Day', date: '2026-07-04' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));
    const { result } = renderHook(() => useAddHoliday(), { wrapper });
    act(() => {
      result.current.mutate({ calendarId: 1, name: 'Holiday', date: '2026-12-25' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRemoveHoliday', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveHoliday(), { wrapper });
    act(() => {
      result.current.mutate({ calendarId: 1, holidayId: 10 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/holiday-calendars/1/holidays/10',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useRemoveHoliday(), { wrapper });
    act(() => {
      result.current.mutate({ calendarId: 1, holidayId: 99 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
