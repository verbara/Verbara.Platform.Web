import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useCampaigns,
  useCampaign,
  useCampaignMetrics,
  useActiveCampaignMetrics,
  useCampaignContactLists,
  useCampaignDispositions,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  useCreateContactList,
  useImportContacts,
  useCreateDispositionCode,
  useUpdateDispositionCode,
  useDeleteDispositionCode,
  useCallbacks,
  useCreateCallback,
  type CampaignSummary,
  type CampaignDetail,
  type CampaignMetrics,
  type ContactList,
  type DispositionCode,
} from './use-campaigns';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleCampaign: CampaignSummary = {
  id: 1,
  name: 'Test Campaign',
  status: 'active',
  queueName: 'Sales',
  mode: 'predictive',
  totalContacts: 500,
  contactsDialed: 120,
};

const sampleDetail: CampaignDetail = {
  ...sampleCampaign,
  maxConcurrentCalls: 10,
  timezone: 'America/New_York',
  schedule: [{ day: 'Monday', enabled: true, start: '09:00', end: '17:00' }],
  holidays: [],
  dncEnabled: true,
  maxAttemptsPerContact: 3,
  retryIntervalMinutes: 30,
  timeBetweenAttemptsMinutes: 60,
  createdAt: '2026-01-01T00:00:00Z',
};

const sampleMetrics: CampaignMetrics = {
  campaignId: 1,
  campaignName: 'Test Campaign',
  status: 'active',
  contactsDialed: 120,
  contactsRemaining: 380,
  connectRate: 0.45,
  abandonRate: 0.02,
  activeCalls: 5,
  pacingRate: 1.5,
};

const sampleContactList: ContactList = {
  id: 10,
  name: 'List A',
  totalContacts: 200,
  pendingContacts: 150,
  completedContacts: 50,
  createdAt: '2026-01-05T00:00:00Z',
};

const sampleDisposition: DispositionCode = {
  id: 1,
  code: 'SALE',
  label: 'Sale Completed',
  category: 'Success',
  isSuccess: true,
  triggerRetry: false,
  triggerCallback: false,
  isActive: true,
  sortOrder: 1,
};

describe('use-campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCampaigns', () => {
    it('should fetch campaigns when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue({
        items: [sampleCampaign],
        totalCount: 1,
        page: 1,
        pageSize: 100,
      });
      const { result } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleCampaign]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
    });
  });

  describe('useCampaign', () => {
    it('should fetch campaign detail when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleDetail);
      const { result } = renderHook(() => useCampaign(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(sampleDetail);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1',
        method: 'GET',
      });
    });

    it('should not fetch when id is 0', () => {
      const { result } = renderHook(() => useCampaign(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCampaignMetrics', () => {
    it('should fetch campaign metrics when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleMetrics);
      const { result } = renderHook(() => useCampaignMetrics(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(sampleMetrics);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/metrics',
        method: 'GET',
      });
    });

    it('should not fetch when id is 0', () => {
      const { result } = renderHook(() => useCampaignMetrics(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useActiveCampaignMetrics', () => {
    it('should fetch active campaign metrics when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleMetrics]);
      const { result } = renderHook(() => useActiveCampaignMetrics(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleMetrics]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/operations/campaigns/metrics',
        method: 'GET',
      });
    });
  });

  describe('useCampaignContactLists', () => {
    it('should fetch contact lists when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleContactList]);
      const { result } = renderHook(() => useCampaignContactLists(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleContactList]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/contact-lists',
        method: 'GET',
      });
    });

    it('should not fetch when campaignId is 0', () => {
      const { result } = renderHook(() => useCampaignContactLists(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCampaignDispositions', () => {
    it('should fetch dispositions when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue([sampleDisposition]);
      const { result } = renderHook(() => useCampaignDispositions(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleDisposition]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/dispositions',
        method: 'GET',
      });
    });

    it('should not fetch when campaignId is 0', () => {
      const { result } = renderHook(() => useCampaignDispositions(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleDetail);
      const { result } = renderHook(() => useCreateCampaign(), { wrapper });
      act(() => {
        result.current.mutate({ name: 'New Campaign', mode: 'predictive' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns',
        method: 'POST',
        data: { name: 'New Campaign', mode: 'predictive' },
      });
    });
  });

  describe('useUpdateCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleDetail);
      const { result } = renderHook(() => useUpdateCampaign(), { wrapper });
      act(() => {
        result.current.mutate({ id: 1, name: 'Updated Campaign' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1',
        method: 'PUT',
        data: { name: 'Updated Campaign' },
      });
    });
  });

  describe('useDeleteCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteCampaign(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1',
        method: 'DELETE',
      });
    });
  });

  describe('useStartCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useStartCampaign(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/start',
        method: 'POST',
      });
    });
  });

  describe('usePauseCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => usePauseCampaign(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/pause',
        method: 'POST',
      });
    });
  });

  describe('useResumeCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useResumeCampaign(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/resume',
        method: 'POST',
      });
    });
  });

  describe('useStopCampaign', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useStopCampaign(), { wrapper });
      act(() => {
        result.current.mutate(1);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/stop',
        method: 'POST',
      });
    });
  });

  describe('useCreateContactList', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleContactList);
      const { result } = renderHook(() => useCreateContactList(), { wrapper });
      act(() => {
        result.current.mutate({
          campaignId: 1,
          name: 'New List',
          totalContacts: 0,
          pendingContacts: 0,
          completedContacts: 0,
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/contact-lists',
        method: 'POST',
        data: { name: 'New List', totalContacts: 0, pendingContacts: 0, completedContacts: 0 },
      });
    });
  });

  describe('useImportContacts', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const contacts = [{ firstName: 'John', phone: '+15551234567' }];
      const { result } = renderHook(() => useImportContacts(), { wrapper });
      act(() => {
        result.current.mutate({ campaignId: 1, listId: 10, contacts });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/contact-lists/10/import',
        method: 'POST',
        data: contacts,
      });
    });
  });

  describe('useCreateDispositionCode', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleDisposition);
      const { result } = renderHook(() => useCreateDispositionCode(), { wrapper });
      act(() => {
        result.current.mutate({ campaignId: 1, code: 'SALE', label: 'Sale' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/dispositions',
        method: 'POST',
        data: { code: 'SALE', label: 'Sale' },
      });
    });
  });

  describe('useUpdateDispositionCode', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleDisposition);
      const { result } = renderHook(() => useUpdateDispositionCode(), { wrapper });
      act(() => {
        result.current.mutate({ campaignId: 1, codeId: 5, label: 'Updated Label' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/dispositions/5',
        method: 'PUT',
        data: { label: 'Updated Label' },
      });
    });
  });

  describe('useDeleteDispositionCode', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteDispositionCode(), { wrapper });
      act(() => {
        result.current.mutate({ campaignId: 1, codeId: 5 });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/dispositions/5',
        method: 'DELETE',
      });
    });
  });

  describe('useCallbacks', () => {
    it('should fetch callbacks when called', async () => {
      const callbacks = [{ campaignId: 1, contactId: 2, scheduledAt: '2026-05-01T10:00:00Z' }];
      vi.mocked(client.customFetch).mockResolvedValue(callbacks);
      const { result } = renderHook(() => useCallbacks(1), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(callbacks);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/callbacks',
        method: 'GET',
      });
    });

    it('should not fetch when campaignId is 0', () => {
      const { result } = renderHook(() => useCallbacks(0), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateCallback', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useCreateCallback(), { wrapper });
      act(() => {
        result.current.mutate({
          campaignId: 1,
          contactId: 2,
          phone: '+15551234567',
          scheduledAt: '2026-05-01T10:00:00Z',
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/1/callbacks',
        method: 'POST',
        data: {
          contactId: 2,
          phone: '+15551234567',
          agentId: undefined,
          scheduledAt: '2026-05-01T10:00:00Z',
        },
      });
    });
  });
});
