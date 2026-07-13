import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

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
export interface TrendPoint {
  label: string;
  value: number;
}
export interface ChannelDistribution {
  channel: string;
  count: number;
}

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
export interface TopicInfo {
  name: string;
  confidence: number;
}
export interface TurnSentimentInfo {
  turnIndex: number;
  speaker: string;
  score: number;
  label: string;
}

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
    queryFn: () =>
      customFetch<CurrentInterval>({
        url: `/api/v1/analytics/current-interval${params}`,
        method: 'GET',
      }),
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
    queryFn: () =>
      customFetch<AgentInterval[]>({
        url: `/api/v1/analytics/intervals/agents?${params}`,
        method: 'GET',
      }),
  });
}

// ─── Speech Analytics / CallAnalytics aggregations (v1.9.3) ──────────────────

export interface TopicTrendDto {
  topic: string;
  occurrences: number;
  avgConfidence: number;
}

export interface TopicTrendsResponse {
  topics: TopicTrendDto[];
  totalAnalyzed: number;
  from: string;
  to: string;
}

export interface SentimentTrendPointDto {
  bucketStart: string;
  avgSentimentScore: number | null;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalCount: number;
}

export interface SentimentTrendsResponse {
  points: SentimentTrendPointDto[];
  bucket: string;
  from: string;
  to: string;
}

export interface ComplianceRuleSummaryDto {
  ruleId: string;
  ruleName: string;
  severity: 'Info' | 'Warning' | 'Critical';
  occurrences: number;
  sessionsAffected: number;
  firstSeen: string;
  lastSeen: string;
}

export interface ComplianceSeverityBreakdownDto {
  info: number;
  warning: number;
  critical: number;
}

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
 * Native AOT number handling means `totalResponses` / `averageRating` are
 * generated as `number | string` (the document's `["integer","string"]` /
 * `["number","string"]` union types). The JSON wire payload always sends a
 * numeric JSON value for these fields; the `string` arm exists only to cover
 * the schema's declared pattern, not an observed runtime shape.
 */
export type CsatResponseDto = components['schemas']['CsatResponseDto'];

/**
 * Consumer-facing CSAT summary: `CsatResponseDto` with `totalResponses` /
 * `averageRating` normalized to `number` (see {@link CsatResponseDto}'s doc
 * comment on the generated union). Kept as the hook's resolved type so
 * existing consumers (e.g. `CsatKpiCard`) keep doing plain numeric
 * comparisons/formatting without re-deriving the coercion at every call site.
 *
 * `averageRating` is `0` (NOT null) for a period with zero responses, so
 * emptiness is derived from `totalResponses === 0`, never from the score.
 */
export interface CsatQueueSummary extends Omit<
  CsatResponseDto,
  'totalResponses' | 'averageRating'
> {
  totalResponses: number;
  averageRating: number;
}

export function useCsatQueueAnalytics(queueId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'csat', 'queue', queueId],
    queryFn: () =>
      customFetch<CsatResponseDto>({
        url: `/api/v1/analytics/csat/queues/${queueId}`,
        method: 'GET',
      }),
    select: (data): CsatQueueSummary => ({
      ...data,
      totalResponses: Number(data.totalResponses),
      averageRating: Number(data.averageRating),
    }),
    enabled: !!queueId,
  });
}

// ─── CSAT scope-wide aggregate (csat-completion) ───────
/**
 * Wire type for the NEW scope-wide aggregate CSAT read
 * `GET /api/v1/analytics/csat` (csat-completion, Platform/ADR-0020 — the
 * aggregate-across-queues option the product owner chose 2026-07-13). The
 * envelope carries the tenant/scope roll-up (`totalResponses`, `averageRating`,
 * `rangeStart`, `rangeEnd`); each `queues[]` row reuses the per-queue
 * projection {@link CsatResponseDto} verbatim (`queueName`, `channel`,
 * `totalResponses`, `averageRating`, `rangeStart`, `rangeEnd`; `channel` is
 * `all` when unfiltered). Field names are cited VERBATIM from the frozen golden
 * fixture `Verbara.Platform/openspec/changes/csat-completion/fixtures/csat-aggregate-analytics.v1.json`
 * (verbatim-fixture-citation rule).
 *
 * INTERIM TYPING (API-first): Platform ships `GET /api/v1/analytics/csat` in
 * this same cross-repo train, so `openapi.d.ts` does NOT yet carry its schema.
 * Per `openapi-typed-client-phase2`'s interim-fixture posture ("the generated
 * file remains authoritative only for the schemas it actually covers"), this
 * shape is hand-declared here, typed 1:1 to the fixture, and MUST be replaced
 * with the generated `components['schemas']['CsatAggregateAnalyticsDto']` (or
 * whatever name Platform emits) once the endpoint is in the served contract and
 * `npm run generate:api-types` is re-run. Like {@link CsatResponseDto}, the
 * numeric fields are the AOT-safe `number | string` union (the JSON wire always
 * sends a numeric value; the `string` arm covers the declared schema pattern).
 */
export interface CsatAggregateAnalyticsDto {
  totalResponses: number | string;
  averageRating: number | string;
  rangeStart: string;
  rangeEnd: string;
  queues: CsatResponseDto[];
}

/**
 * Consumer-facing scope-wide CSAT summary: {@link CsatAggregateAnalyticsDto}
 * with `totalResponses` / `averageRating` (envelope AND each `queues[]` row)
 * normalized to `number` so consumers (`CsatKpiCard`) do plain numeric
 * formatting. As with {@link CsatQueueSummary}, `averageRating` is `0` (NOT
 * null) for a period with zero responses, so emptiness is derived from
 * `totalResponses === 0`, never from the score.
 */
export interface CsatAggregateSummary extends Omit<
  CsatAggregateAnalyticsDto,
  'totalResponses' | 'averageRating' | 'queues'
> {
  totalResponses: number;
  averageRating: number;
  queues: CsatQueueSummary[];
}

/**
 * Scope-wide aggregate CSAT KPI read for the supervisor wallboard
 * (csat-completion). Mirrors {@link useCsatQueueAnalytics} (see
 * `use-analytics.ts:508-558`): a `useQuery` fetching the aggregate DTO with a
 * `select` that normalizes the AOT-safe `number | string` union fields to
 * `number` on the envelope and on every `queues[]` row.
 *
 * This hook is the **second concrete call site** of the `number | string`
 * AOT-union normalization pattern that `openapi-typed-client-phase2` tracks as
 * an open design question (whether to introduce a shared coercion helper once
 * 2-3 sites exist). It adds the data point but does NOT itself introduce the
 * helper — that decision stays with phase2.
 */
export function useCsatAggregateAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'csat', 'aggregate'],
    queryFn: () =>
      customFetch<CsatAggregateAnalyticsDto>({
        url: '/api/v1/analytics/csat',
        method: 'GET',
      }),
    select: (data): CsatAggregateSummary => ({
      ...data,
      totalResponses: Number(data.totalResponses),
      averageRating: Number(data.averageRating),
      queues: data.queues.map((q) => ({
        ...q,
        totalResponses: Number(q.totalResponses),
        averageRating: Number(q.averageRating),
      })),
    }),
  });
}
