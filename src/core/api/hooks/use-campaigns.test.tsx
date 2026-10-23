import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  type CampaignMetrics,
  type ContactList,
  type DispositionCode,
} from './use-campaigns';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Platform's campaign responses as the host change's fixtures record them
 * (`tests/fixtures/contracts/`, dialer-places-calls-end-to-end): `status` is the enum name,
 * PascalCase (`Active`, `Draft`).
 */
function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as T;
}

type CampaignItem = { id: number; status: string } & Record<string, unknown>;
const campaignList = fixture<{ items: CampaignItem[] } & Record<string, unknown>>(
  'campaign-list.response.json',
);
const campaignDetail = fixture<CampaignItem>('campaign-detail.response.json');

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
      vi.mocked(client.customFetch).mockResolvedValue(campaignList);
      const { result } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map((c) => c.id)).toEqual([11, 12]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
    });

    it('useCampaigns_ShouldReturnStatusLowercase_WhenPlatformSendsTheEnumName', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(campaignList);
      const { result } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map((c) => c.status)).toEqual(['active', 'draft']);
      expect(result.current.data?.[0]).toEqual({ ...campaignList.items[0], status: 'active' });
    });

    it('useCampaigns_ShouldReturnArchivedLowercase_AndPassAnUnknownStatusThrough', async () => {
      vi.mocked(client.customFetch).mockResolvedValue({
        ...campaignList,
        items: [
          { ...campaignList.items[0], status: 'Archived' },
          { ...campaignList.items[1], status: 'Suspended' },
        ],
      });
      const { result } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map((c) => c.status)).toEqual(['archived', 'Suspended']);
    });
  });

  describe('useCampaign', () => {
    it('should fetch campaign detail when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(campaignDetail);
      const { result } = renderHook(() => useCampaign(11), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.id).toBe(11);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/admin/campaigns/11',
        method: 'GET',
      });
    });

    it('useCampaign_ShouldReturnStatusLowercase_WhenPlatformSendsTheEnumName', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(campaignDetail);
      const { result } = renderHook(() => useCampaign(11), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ ...campaignDetail, status: 'draft' });
    });

    it.each([
      ['Archived', 'archived'],
      ['Suspended', 'Suspended'],
    ])('useCampaign_ShouldReturn_%s_As_%s', async (sent, read) => {
      vi.mocked(client.customFetch).mockResolvedValue({ ...campaignDetail, status: sent });
      const { result } = renderHook(() => useCampaign(11), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.status).toBe(read);
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
      vi.mocked(client.customFetch).mockResolvedValue(campaignDetail);
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
      vi.mocked(client.customFetch).mockResolvedValue(campaignDetail);
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
