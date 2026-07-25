import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

// Dashboard
//
// The numeric union is now extinct at the source (openapi-numeric-schema-truth,
// Platform/ADR-0036), so the fully-required analytics shapes below alias their
// generated schemas directly (swap-the-T; `client.ts` untouched). `DashboardData`
// stays hand-written: `DashboardKpis` matches the generated `DashboardKpisDto`, but the
// generated `DashboardDto` types `previousPeriodKpis` as required-nullable
// (`null | DashboardKpisDto`) whereas the consumer (`dashboard-page.tsx`) treats it as
// optional (`| undefined`) — an optional-vs-nullable structural divergence the swap
// cannot bridge.
export interface DashboardData {
  kpis: DashboardKpis;
  previousPeriodKpis?: DashboardKpis;
  volumeTrend: TrendPoint[];
  slaTrend: TrendPoint[];
  channelDistribution: ChannelDistribution[];
}
export type DashboardKpis = components['schemas']['DashboardKpisDto'];
export type TrendPoint = components['schemas']['TrendPointDto'];
export type ChannelDistribution = components['schemas']['ChannelDistributionDto'];

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
export interface CdrTimelineEvent {
  event: string;
  timestamp: string;
  detail?: string;
}
export interface CdrQaSummary {
  reason?: string;
  outcome?: string;
  narrative?: string;
  qaScore?: number;
  sentimentLabel?: string;
}

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
  sentimentTimeline: TurnSentimentInfo[];
  agentTalkRatio?: number;
  silenceCount?: number;
  interruptionCount?: number;
}
export interface QaCriterion {
  category: string;
  score: number;
  weight: number;
  passed: boolean;
  feedback?: string;
}
export interface ComplianceViolationInfo {
  ruleName: string;
  severity: string;
  description: string;
  evidence?: string;
}
export type TopicInfo = components['schemas']['TopicDto'];
export type TurnSentimentInfo = components['schemas']['TurnSentimentDto'];

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

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

// Filters
export interface CdrFilters {
  queue?: string;
  agent?: string;
  channel?: string;
}
export interface QaFilters {
  minScore?: number;
  queue?: string;
  agent?: string;
}

export function useDashboard(from?: string, to?: string, queue?: string) {
  return useQuery({
    queryKey: ['analytics-dashboard', from, to, queue],
    queryFn: () =>
      customFetch<DashboardData>({
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
    queryFn: () =>
      customFetch<PagedResult<CdrRow>>({
        url: '/api/v1/analytics/cdr',
        method: 'GET',
        params: {
          ...(from && { from }),
          ...(to && { to }),
          ...(filters?.queue && { queue: filters.queue }),
          ...(filters?.agent && { agent: filters.agent }),
          ...(filters?.channel && { channel: filters.channel }),
          page: String(page),
          pageSize: '50',
        },
      }),
  });
}

export function useCdrDetail(sessionId: string) {
  return useQuery({
    queryKey: ['analytics-cdr-detail', sessionId],
    queryFn: () =>
      customFetch<CdrDetail>({ url: `/api/v1/analytics/cdr/${sessionId}`, method: 'GET' }),
    enabled: !!sessionId,
  });
}

export function useQaList(from?: string, to?: string, filters?: QaFilters, page = 1) {
  return useQuery({
    queryKey: ['analytics-qa', from, to, filters, page],
    queryFn: () =>
      customFetch<PagedResult<QaRow>>({
        url: '/api/v1/analytics/qa',
        method: 'GET',
        params: {
          ...(from && { from }),
          ...(to && { to }),
          ...(filters?.minScore != null && { minScore: String(filters.minScore) }),
          page: String(page),
          pageSize: '50',
        },
      }),
  });
}

export function useQaDetail(sessionId: string) {
  return useQuery({
    queryKey: ['analytics-qa-detail', sessionId],
    queryFn: () =>
      customFetch<QaDetail>({ url: `/api/v1/analytics/qa/${sessionId}`, method: 'GET' }),
    enabled: !!sessionId,
  });
}

export function useTranscript(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['analytics-transcript', sessionId],
    queryFn: () =>
      customFetch<TranscriptSegment[]>({
        url: `/api/v1/analytics/cdr/${sessionId}/transcript`,
        method: 'GET',
      }),
    enabled: !!sessionId && enabled,
  });
}

export function useIntervals(from?: string, to?: string, queue?: string) {
  return useQuery({
    queryKey: ['analytics-intervals', from, to, queue],
    queryFn: () =>
      customFetch<IntervalData[]>({
        url: '/api/v1/analytics/intervals',
        method: 'GET',
        params: { ...(from && { from }), ...(to && { to }), ...(queue && { queue }) },
      }),
  });
}

// ─── Live State ─────────────────────────────────────────
export type LiveState = components['schemas']['LiveStateDto'];

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
    queryFn: () =>
      customFetch<LiveState>({
        url: `/api/v1/analytics/live/${encodeURIComponent(queueName)}`,
        method: 'GET',
      }),
    enabled: !!queueName,
    refetchInterval: 15_000,
  });
}

// ─── Current Interval ───────────────────────────────────
export type CurrentInterval = components['schemas']['CurrentIntervalDto'];

export function useCurrentInterval(queueName?: string) {
  const params = queueName ? `?queueName=${encodeURIComponent(queueName)}` : '?queueName=default';
  return useQuery({
    queryKey: ['analytics', 'current-interval', queueName],
    queryFn: () =>
      customFetch<CurrentInterval>({
        url: `/api/v1/analytics/current-interval${params}`,
        method: 'GET',
      }),
    refetchInterval: 30_000,
  });
}

// ─── Agent Intervals ────────────────────────────────────
export type AgentInterval = components['schemas']['AgentIntervalDto'];

export function useAgentIntervals(filters: { from: string; to: string; agentId?: string }) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.agentId) params.set('agentId', filters.agentId);
  return useQuery({
    queryKey: ['analytics', 'agent-intervals', filters],
    queryFn: () =>
      customFetch<AgentInterval[]>({
        url: `/api/v1/analytics/intervals/agents?${params}`,
        method: 'GET',
      }),
  });
}

// ─── Speech Analytics / CallAnalytics aggregations (v1.9.3) ──────────────────

export type TopicTrendDto = components['schemas']['TopicTrendDto'];

/**
 * KEEP hand-written (structural-divergence, logged as a separate Platform contract bug):
 * the generated `TopicTrendsResponse` renames `topics`→`trends` and drops `from`/`to`, so it
 * cannot back the consumer's `{ topics, totalAnalyzed, from, to }` shape.
 */
export interface TopicTrendsResponse {
  topics: TopicTrendDto[];
  totalAnalyzed: number;
  from: string;
  to: string;
}

export type SentimentTrendPointDto = components['schemas']['SentimentTrendPointDto'];
export type SentimentTrendsResponse = components['schemas']['SentimentTrendsResponse'];

/**
 * KEEP hand-written (structural-divergence, logged as a separate Platform contract bug):
 * the generated `ComplianceRuleSummaryDto` widens `severity` from the
 * `'Info' | 'Warning' | 'Critical'` literal union to bare `string`, which the consumer's
 * severity-keyed display requires narrowed. `ComplianceSummaryResponse` transitively keeps its
 * local `rules` element type for the same reason.
 */
export interface ComplianceRuleSummaryDto {
  ruleId: string;
  ruleName: string;
  severity: 'Info' | 'Warning' | 'Critical';
  occurrences: number;
  sessionsAffected: number;
  firstSeen: string;
  lastSeen: string;
}

export type ComplianceSeverityBreakdownDto =
  components['schemas']['ComplianceSeverityBreakdownDto'];

export interface ComplianceSummaryResponse {
  rules: ComplianceRuleSummaryDto[];
  totalViolations: number;
  totalSessionsWithViolations: number;
  severityBreakdown: ComplianceSeverityBreakdownDto;
  from: string;
  to: string;
}

export function useTopicTrends(from?: string, to?: string, topN = 10) {
  return useQuery({
    queryKey: ['call-analytics', 'topics-trends', from, to, topN],
    queryFn: () =>
      customFetch<TopicTrendsResponse>({
        url: '/api/v1/call-analytics/topics/trends',
        method: 'GET',
        params: {
          ...(from && { from }),
          ...(to && { to }),
          topN: String(topN),
        },
      }),
  });
}

export function useSentimentTrends(
  from?: string,
  to?: string,
  bucket: 'day' | 'week' = 'day',
  queueName?: string,
) {
  return useQuery({
    queryKey: ['call-analytics', 'sentiment-trends', from, to, bucket, queueName],
    queryFn: () =>
      customFetch<SentimentTrendsResponse>({
        url: '/api/v1/call-analytics/sentiment/trends',
        method: 'GET',
        params: {
          ...(from && { from }),
          ...(to && { to }),
          bucket,
          ...(queueName && { queueName }),
        },
      }),
  });
}

export function useComplianceSummary(
  from?: string,
  to?: string,
  queueName?: string,
  severity?: 'Info' | 'Warning' | 'Critical',
) {
  return useQuery({
    queryKey: ['call-analytics', 'compliance-summary', from, to, queueName, severity],
    queryFn: () =>
      customFetch<ComplianceSummaryResponse>({
        url: '/api/v1/call-analytics/compliance/summary',
        method: 'GET',
        params: {
          ...(from && { from }),
          ...(to && { to }),
          ...(queueName && { queueName }),
          ...(severity && { severity }),
        },
      }),
  });
}

// ─── Bot Analytics ─────────────────────────────────────
/**
 * KEEP hand-written: no generated counterpart. The generated `BotDto` describes a bot
 * configuration entity (`id`, `name`, `defaultFlowId`, `confidenceThreshold`, …), not this
 * per-period analytics roll-up (`totalConversations`, `handoffRate`, `resolutionRate`, …).
 */
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

// ─── CSAT (csat-runner) ────────────────────────────────
/**
 * Generated wire type for the Platform read endpoint
 * `GET /api/v1/analytics/csat/queues/{queueId}` — sourced from
 * `src/core/api/generated/openapi.d.ts` (`components['schemas']['CsatResponseDto']`),
 * not hand-declared (openapi-typed-client). Field names mirror the server DTO
 * camelCased over the wire — do NOT rename without changing the consumer, or
 * deserialization silently yields `undefined`.
 *
 * `totalResponses` / `averageRating` are now single-typed `number` on the regenerated
 * document (openapi-numeric-schema-truth, Platform/ADR-0036 strips the spurious AOT
 * `string` arm at the source).
 */
export type CsatResponseDto = components['schemas']['CsatResponseDto'];

/**
 * Consumer-facing CSAT summary. `totalResponses` / `averageRating` are already `number`
 * on the regenerated `CsatResponseDto`, so this collapses to a direct alias and the former
 * `select`-normalizer coercion is retired — consumers (e.g. `CsatKpiCard`) read the fields
 * straight off the DTO.
 *
 * `averageRating` is `0` (NOT null) for a period with zero responses, so emptiness is
 * derived from `totalResponses === 0`, never from the score.
 */
export type CsatQueueSummary = CsatResponseDto;

export function useCsatQueueAnalytics(queueId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'csat', 'queue', queueId],
    queryFn: () =>
      customFetch<CsatResponseDto>({
        url: `/api/v1/analytics/csat/queues/${queueId}`,
        method: 'GET',
      }),
    enabled: !!queueId,
  });
}

// ─── CSAT scope-wide aggregate (csat-completion) ───────
/**
 * Generated wire type for the scope-wide aggregate CSAT read
 * `GET /api/v1/analytics/csat` (csat-completion, Platform/ADR-0020 — the
 * aggregate-across-queues option the product owner chose 2026-07-13). The endpoint is now in
 * the served contract, so this adopts the generated `CsatAggregateDto` (retiring the interim
 * hand-declared `CsatAggregateAnalyticsDto`): the envelope carries the scope roll-up
 * (`totalResponses`, `averageRating`, `rangeStart`, `rangeEnd`) and each `queues[]` row reuses
 * the per-queue projection {@link CsatResponseDto}. Numeric fields are single-typed `number`
 * on the regenerated document (openapi-numeric-schema-truth, Platform/ADR-0036).
 */
export type CsatAggregateSummary = components['schemas']['CsatAggregateDto'];

/**
 * Scope-wide aggregate CSAT KPI read for the supervisor wallboard (csat-completion). Mirrors
 * {@link useCsatQueueAnalytics}: the numeric fields are already `number` on the regenerated
 * `CsatAggregateDto`, so the former `select`-normalizer coercion (envelope + each `queues[]`
 * row) is retired and the hook returns the generated DTO directly.
 */
export function useCsatAggregateAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'csat', 'aggregate'],
    queryFn: () =>
      customFetch<components['schemas']['CsatAggregateDto']>({
        url: '/api/v1/analytics/csat',
        method: 'GET',
      }),
  });
}
