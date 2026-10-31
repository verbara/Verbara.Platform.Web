/**
 * The two campaign SSE events (spec `operations-campaign-monitor`, design D2; Web #460), fed to the
 * real `useSSE` hook and the real campaign metrics store through a fake `EventSource`. The payloads
 * are the host fixtures `campaign-status-changed.event.json` and
 * `campaign-metrics-updated.event.json`: `campaignId` a JSON number, statuses the enum name, and the
 * event envelope (`tenantId`, `type`, `timestamp`, `metadata`, `eventType`) beside the members.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSSE } from '@/core/hooks/use-sse';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  useCampaignMetricsStore,
  type CampaignMetrics,
} from '@/operations/stores/campaign-metrics-store';
import { createWrapper } from '@/test/hook-test-utils';

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  refreshAccessToken: vi.fn(async () => false),
}));

const navigateMock = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigateMock,
}));

const t = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

function fixture<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as T;
}

const statusChanged = fixture('campaign-status-changed.event.json');
const metricsUpdated = fixture('campaign-metrics-updated.event.json');

const ENVELOPE = ['tenantId', 'type', 'timestamp', 'metadata', 'eventType'];

/** A fake `EventSource` that keeps its listeners so a test can deliver an event by name. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private readonly listeners = new Map<string, ((e: MessageEvent) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {}

  emit(type: string, payload: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) });
    this.listeners.get(type)?.forEach((l) => l(event));
  }
}

/** Campaign 11 as the monitor holds it after reading `campaign-metrics-list.response.json`. */
const HELD: CampaignMetrics = {
  campaignId: '11',
  campaignName: 'Q4 renewals',
  status: 'active',
  contactsDialed: 100,
  contactsRemaining: 400,
  connectRate: 0.4,
  abandonRate: 0.01,
  activeCalls: 1,
  pacingRate: 1,
};

function source(): FakeEventSource {
  const s = FakeEventSource.instances.at(-1);
  if (!s) throw new Error('no EventSource was opened');
  return s;
}

function row(id: string) {
  return useCampaignMetricsStore.getState().campaigns.find((c) => c.campaignId === id);
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  useCampaignMetricsStore.setState({ campaigns: [{ ...HELD }] });
  useAuthStore
    .getState()
    .setAuth(
      'T1',
      Date.now() + 15 * 60_000,
      { id: 'user-1', email: 'a@b.com', displayName: 'Sup', role: 'supervisor' },
      'tenant-1',
      [],
      {},
    );
  renderHook(() => useSSE(), { wrapper: createWrapper() });
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().logout();
  vi.unstubAllGlobals();
});

describe('useSSE campaign events', () => {
  it('UseSSE_ShouldSetTheNormalizedStatusOnTheRowKeyed11_WhenACampaignStatusChangedEventArrives', () => {
    act(() => source().emit('campaign.status_changed', { ...statusChanged, newStatus: 'Paused' }));

    expect(row('11')).toEqual({ ...HELD, status: 'paused' });
  });

  it('UseSSE_ShouldUpdateOnlyTheMetricMembers_WhenACampaignMetricsUpdatedEventArrives', () => {
    act(() => source().emit('campaign.metrics_updated', metricsUpdated));

    const updated = row('11');
    expect(updated).toEqual({
      ...HELD,
      contactsDialed: metricsUpdated.contactsDialed,
      contactsRemaining: metricsUpdated.contactsRemaining,
      connectRate: metricsUpdated.connectRate,
      abandonRate: metricsUpdated.abandonRate,
      activeCalls: metricsUpdated.activeCalls,
    });
    for (const member of ENVELOPE) expect.soft(updated, member).not.toHaveProperty(member);
  });

  it('UseSSE_ShouldChangeNothing_WhenTheEventsNameACampaignTheMonitorDoesNotHold', () => {
    act(() => {
      source().emit('campaign.status_changed', { ...statusChanged, campaignId: 99 });
      source().emit('campaign.metrics_updated', { ...metricsUpdated, campaignId: 99 });
    });

    expect(useCampaignMetricsStore.getState().campaigns).toEqual([HELD]);
  });
});
