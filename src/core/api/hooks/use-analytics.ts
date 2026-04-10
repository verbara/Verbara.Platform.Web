import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

// Dashboard
export interface DashboardData {
  kpis: DashboardKpis;
  previousPeriodKpis?: DashboardKpis;
  volumeTrend: TrendPoint[];
  slaTrend: TrendPoint[];
  channelDistribution: ChannelDistribution[];
}
export interface DashboardKpis {
  conversationsHandled: number;
  avgWaitMs: number;
  avgHandleTimeMs: number;
  slaPercent: number;
  abandonRatePercent: number;
}
export interface TrendPoint { label: string; value: number; }
export interface ChannelDistribution { channel: string; count: number; }

// CDR
export interface CdrRow {
  sessionId: string;
  startTime: string;
  answerTime?: string;
  endTime: string;
  contact?: string;
  channel: string;
  channelType?: string;
  queueName?: string;
  agentName?: string;
  durationMs: number;
  talkTimeMs?: number;
  waitTimeMs?: number;
  disposition: string;
  slaMet: boolean;
  hasQaScore: boolean;
  qaScore?: number;
  sentimentLabel?: string;
  hasRecording: boolean;
  transferredTo?: string;
  transferType?: number;
  hangupSource?: number;
  wrapUpDurationMs?: number;
  holdCount: number;
  ringDurationMs?: number;
  campaignName?: string;
  dispositionName?: string;
  recordingStreamUrl?: string;
  metadata?: Record<string, string>;
}
export interface CdrDetail {
  cdr: CdrRow;
  timeline: CdrTimelineEvent[];
  qaSummary?: CdrQaSummary;
  calledNumber?: string;
  linkedSessionId?: string;
  transferCount: number;
  recordingName?: string;
  recordingStreamUrl?: string;
  hasTranscript: boolean;
}
export interface CdrTimelineEvent { event: string; timestamp: string; detail?: string; }
export interface CdrQaSummary { reason?: string; outcome?: string; narrative?: string; qaScore?: number; sentimentLabel?: string; }

// QA
export interface QaRow {
  sessionId: string;
  analyzedAt: string;
  agentName?: string;
  queueName?: string;
  qaScore: number;
  summaryNarrative?: string;
  hasComplianceViolations: boolean;
  violationCount: number;
  sentimentLabel?: string;
  topics: string[];
}
export interface QaDetail {
  sessionId: string;
  analyzedAt: string;
  agentName?: string;
  queueName?: string;
  reason?: string;
  outcome?: string;
  narrative?: string;
  actionItems: string[];
  qaScore: number;
  maxPossibleScore: number;
  criteria: QaCriterion[];
  violations: ComplianceViolationInfo[];
  sentimentLabel?: string;
  sentimentTrend?: string;
  sentimentScore?: number;
  primaryTopic?: string;
  allTopics: TopicInfo[];
  agentTalkRatio?: number;
  silenceCount?: number;
  interruptionCount?: number;
}
export interface QaCriterion { category: string; score: number; weight: number; passed: boolean; feedback?: string; }
export interface ComplianceViolationInfo { ruleName: string; severity: string; description: string; evidence?: string; }
export interface TopicInfo { name: string; confidence: number; }

// Transcript
export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker: 'agent' | 'caller';
  text: string;
}

// Intervals
export interface IntervalData {
  queueName: string;
  intervalStart: string;
  intervalSeconds: number;
  callsOffered: number;
  callsAnswered: number;
  callsAbandoned: number;
  slaPercent: number;
  asaMs: number;
  ahtMs: number;
  abandonRatePercent: number;
  slaMetCount: number;
}

interface PagedResult<T> { items: T[]; totalCount: number; page: number; pageSize: number; hasNextPage: boolean; }

// Filters
export interface CdrFilters { queue?: string; agent?: string; channel?: string; }
export interface QaFilters { minScore?: number; queue?: string; agent?: string; }

export function useDashboard(from?: string, to?: string, queue?: string) {
  return useQuery({
    queryKey: ['analytics-dashboard', from, to, queue],
    queryFn: () => customFetch<DashboardData>({
      url: '/api/v1/analytics/dashboard',
      method: 'GET',
      params: { ...(from && { from }), ...(to && { to }), ...(queue && { queue }) },
    }),
    refetchInterval: 60000,
  });
}

export function useCdrList(from?: string, to?: string, filters?: CdrFilters, page = 1) {
  return useQuery({
    queryKey: ['analytics-cdr', from, to, filters, page],
    queryFn: () => customFetch<PagedResult<CdrRow>>({
      url: '/api/v1/analytics/cdr',
      method: 'GET',
      params: {
        ...(from && { from }), ...(to && { to }),
        ...(filters?.queue && { queue: filters.queue }),
        ...(filters?.agent && { agent: filters.agent }),
        ...(filters?.channel && { channel: filters.channel }),
        page: String(page), pageSize: '50',
      },
    }),
  });
}

export function useCdrDetail(sessionId: string) {
  return useQuery({
    queryKey: ['analytics-cdr-detail', sessionId],
    queryFn: () => customFetch<CdrDetail>({ url: `/api/v1/analytics/cdr/${sessionId}`, method: 'GET' }),
    enabled: !!sessionId,
  });
}

export function useQaList(from?: string, to?: string, filters?: QaFilters, page = 1) {
  return useQuery({
    queryKey: ['analytics-qa', from, to, filters, page],
    queryFn: () => customFetch<PagedResult<QaRow>>({
      url: '/api/v1/analytics/qa',
      method: 'GET',
      params: {
        ...(from && { from }), ...(to && { to }),
        ...(filters?.minScore != null && { minScore: String(filters.minScore) }),
        page: String(page), pageSize: '50',
      },
    }),
  });
}

export function useQaDetail(sessionId: string) {
  return useQuery({
    queryKey: ['analytics-qa-detail', sessionId],
    queryFn: () => customFetch<QaDetail>({ url: `/api/v1/analytics/qa/${sessionId}`, method: 'GET' }),
    enabled: !!sessionId,
  });
}

export function useTranscript(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['analytics-transcript', sessionId],
    queryFn: () => customFetch<TranscriptSegment[]>({ url: `/api/v1/analytics/cdr/${sessionId}/transcript`, method: 'GET' }),
    enabled: !!sessionId && enabled,
  });
}

export function useIntervals(from?: string, to?: string, queue?: string) {
  return useQuery({
    queryKey: ['analytics-intervals', from, to, queue],
    queryFn: () => customFetch<IntervalData[]>({
      url: '/api/v1/analytics/intervals',
      method: 'GET',
      params: { ...(from && { from }), ...(to && { to }), ...(queue && { queue }) },
    }),
  });
}

// ─── Live State ─────────────────────────────────────────
export interface LiveState {
  queueName: string;
  callsWaiting: number;
  longestWaitMs: number;
  agentsAvailable: number;
  agentsOnCall: number;
  agentsPaused: number;
  agentsInWrapUp: number;
}

export function useAllLiveStates() {
  return useQuery({
    queryKey: ['analytics', 'live'],
    queryFn: () => customFetch<LiveState[]>({ url: '/api/v1/analytics/live', method: 'GET' }),
    refetchInterval: 15_000,
  });
}

export function useLiveState(queueName: string) {
  return useQuery({
    queryKey: ['analytics', 'live', queueName],
    queryFn: () => customFetch<LiveState>({ url: `/api/v1/analytics/live/${encodeURIComponent(queueName)}`, method: 'GET' }),
    enabled: !!queueName,
    refetchInterval: 15_000,
  });
}

// ─── Current Interval ───────────────────────────────────
export interface CurrentInterval {
  intervalStart: string;
  intervalEnd: string;
  callsOffered: number;
  callsAnswered: number;
  callsAbandoned: number;
  ahtMs: number;
  asaMs: number;
  slaPercent: number;
  abandonRatePercent: number;
}

export function useCurrentInterval(queueName?: string) {
  const params = queueName ? `?queueName=${encodeURIComponent(queueName)}` : '?queueName=default';
  return useQuery({
    queryKey: ['analytics', 'current-interval', queueName],
    queryFn: () => customFetch<CurrentInterval>({ url: `/api/v1/analytics/current-interval${params}`, method: 'GET' }),
    refetchInterval: 30_000,
  });
}

// ─── Agent Intervals ────────────────────────────────────
export interface AgentInterval {
  agentId: string;
  intervalStart: string;
  intervalSeconds: number;
  callsHandled: number;
  ahtMs: number;
  occupancyPercent: number;
  rnaCount: number;
  transfers: number;
  totalPauseMs: number;
  loginDurationMs: number;
}

export function useAgentIntervals(filters: { from: string; to: string; agentId?: string }) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.agentId) params.set('agentId', filters.agentId);
  return useQuery({
    queryKey: ['analytics', 'agent-intervals', filters],
    queryFn: () => customFetch<AgentInterval[]>({ url: `/api/v1/analytics/intervals/agents?${params}`, method: 'GET' }),
  });
}

// ─── Bot Analytics ─────────────────────────────────────
export interface BotAnalyticsSummary {
  totalConversations: number;
  handedOff: number;
  resolved: number;
  failed: number;
  handoffRate: number;
  resolutionRate: number;
  avgTurns: number;
  failureRate: number;
}

export function useBotAnalytics(from?: string, to?: string) {
  return useQuery({
    queryKey: ['analytics', 'bot', from, to],
    queryFn: () =>
      customFetch<BotAnalyticsSummary>({
        url: '/api/v1/analytics/bot',
        method: 'GET',
        params: {
          ...(from && { from }),
          ...(to && { to }),
        },
      }),
  });
}
