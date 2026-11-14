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
//
// `GET /api/v1/analytics/cdr` and `GET /api/v1/analytics/cdr/{sessionId}` are read as their
// generated schemas (`PagedDataResponseOfCdrRowDto`, `CdrDetailDto`; design W1 of
// cdr-list-reads-its-envelope). The generator declares every member required, nullable ones
// as `null | T`, while the Api omits null members from the wire (see the change's sparse and
// partial fixtures). Until `openapi-required-follows-omitted-nulls` lands, `AbsentIsNull<T>`
// makes each nullable member optional, so an absent member reads as `null | undefined` and a
// consumer cannot assume it is present. Non-nullable members stay required, recursively.
type AbsentIsNull<T> = T extends readonly (infer E)[]
  ? AbsentIsNull<E>[]
  : T extends object
    ? { [K in keyof T as null extends T[K] ? never : K]: AbsentIsNull<T[K]> } & {
        [K in keyof T as null extends T[K] ? K : never]?: AbsentIsNull<T[K]> | undefined;
      }
    : T;

export type CdrListPage = AbsentIsNull<components['schemas']['PagedDataResponseOfCdrRowDto']>;
export type CdrRowDto = AbsentIsNull<components['schemas']['CdrRowDto']>;
export type CdrDetailDto = AbsentIsNull<components['schemas']['CdrDetailDto']>;

// QA
//
// The QA list row and its envelope are the generated schemas (`QaRowDto`,
// `PagedDataResponseOfQaRowDto`: `{ data, hasMore, page, pageSize }`), read through
// `AbsentIsNull` because the Api omits null members from the wire.
export type QaRow = AbsentIsNull<components['schemas']['QaRowDto']>;
export type QaListPage = AbsentIsNull<components['schemas']['PagedDataResponseOfQaRowDto']>;

// QA availability (qa-scores-are-produced-or-not-shown, design D1/D2). One read says whether
// post-call analysis can produce anything for the caller's tenant. Every member is always
// written (nulls included), so the generated schema is read as is.
export type QaAvailability = components['schemas']['QaAvailabilityDto'];

/** What a missing piece means to a reader: `null` while the read has not succeeded. */
export type QaUnavailableReason = 'not_configured' | 'not_licensed' | 'no_scorecard' | 'unknown';

/**
 * The console surfaces that may be shown, derived from one availability read. Hidden on doubt:
 * until a successful read says so, nothing that depends on post-call analysis is shown.
 * - `qa`: the QA entry, the CDR QA column, the CDR QA summary (`available`);
 * - `speech`: the Speech Analytics entry (`analysisRunning`);
 * - `sentiment`: every sentiment value, only when analysis runs and the tenant's call language is
 *   one the sentiment analysis supports (`sentimentSupported` true);
 * - `sentimentUnsupported`: analysis runs but sentiment is not supported for the language, so a
 *   page explains why it shows no sentiment.
 */
export interface QaSurfaces {
  qa: boolean;
  speech: boolean;
  sentiment: boolean;
  sentimentUnsupported: boolean;
  /** Why QA results cannot exist, or null when they can or while the read is pending. */
  qaReason: QaUnavailableReason | null;
  /** Why speech analysis results cannot exist, or null when they can or while the read is pending. */
  speechReason: QaUnavailableReason | null;
}

function readerReason(reason: string | null): QaUnavailableReason {
  switch (reason) {
    case 'analysis_not_registered':
    case 'no_transcript_source':
      return 'not_configured';
    case 'not_licensed':
      return 'not_licensed';
    case 'no_scorecard':
      return 'no_scorecard';
    default:
      return 'unknown';
  }
}

export function qaSurfaces(availability: QaAvailability | undefined, failed = false): QaSurfaces {
  if (!availability) {
    const reason = failed ? 'unknown' : null;
    return {
      qa: false,
      speech: false,
      sentiment: false,
      sentimentUnsupported: false,
      qaReason: reason,
      speechReason: reason,
    };
  }
  const qa = availability.available === true;
  const speech = availability.analysisRunning === true;
  return {
    qa,
    speech,
    sentiment: speech && availability.sentimentSupported === true,
    sentimentUnsupported: speech && availability.sentimentSupported === false,
    qaReason: qa ? null : readerReason(availability.reason),
    speechReason: speech ? null : readerReason(availability.reason),
  };
}

const QA_AVAILABILITY_STALE_MS = 10 * 60_000;

/**
 * Reads `GET /api/v1/analytics/qa-availability` once, with a long stale time; a page that must
 * not trust a stale answer passes `refetchOnMount` (the QA page does, design D2). Not retried:
 * a failed read keeps every surface hidden instead of waiting on retries.
 */
export function useQaAvailability(options?: { refetchOnMount?: boolean }) {
  return useQuery({
    queryKey: ['analytics-qa-availability'],
    queryFn: () =>
      customFetch<QaAvailability>({
        url: '/api/v1/analytics/qa-availability',
        method: 'GET',
      }),
    staleTime: QA_AVAILABILITY_STALE_MS,
    retry: false,
    ...(options?.refetchOnMount && { refetchOnMount: 'always' as const }),
  });
}

/** The surfaces the console may show, from the availability read (see `QaSurfaces`). */
export function useQaSurfaces(options?: { refetchOnMount?: boolean }) {
  const query = useQaAvailability(options);
  return { ...qaSurfaces(query.data, query.isError), isLoading: query.isLoading };
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

// Filters
export interface CdrFilters {
  queue?: string;
  agent?: string;
  channel?: string;
}
// `GET /api/v1/analytics/qa` takes no queue or agent, so neither is a QA filter.
export interface QaFilters {
  minScore?: number;
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
      customFetch<CdrListPage>({
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
      customFetch<CdrDetailDto>({ url: `/api/v1/analytics/cdr/${sessionId}`, method: 'GET' }),
    enabled: !!sessionId,
  });
}

export function useQaList(
  from?: string,
  to?: string,
  filters?: QaFilters,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: ['analytics-qa', from, to, filters, page],
    enabled,
    queryFn: () =>
      customFetch<QaListPage>({
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
 * Adopts the generated type (openapi-residual-contract-shapes, Platform/ADR-0036): the
 * document emits `trends` (an array of `{ topic, occurrences, avgConfidence }`) and
 * `totalAnalyzed` — no `topics`, no `from`/`to`. The earlier hand-written
 * `{ topics, totalAnalyzed, from, to }` shadow was a stale mirror of that corrected contract.
 */
export type TopicTrendsResponse = components['schemas']['TopicTrendsResponse'];

export type SentimentTrendPointDto = components['schemas']['SentimentTrendPointDto'];
export type SentimentTrendsResponse = components['schemas']['SentimentTrendsResponse'];

/**
 * Adopts the generated type (openapi-residual-contract-shapes, Platform/ADR-0036): Platform now
 * narrows `severity` back to the `Info | Warning | Critical` literal union at the source, so the
 * hand-written shadow (which existed only while the document widened it to bare `string`) is gone.
 * `ComplianceSummaryResponse` adopts transitively — its `rules` element is now the generated DTO.
 */
export type ComplianceRuleSummaryDto = components['schemas']['ComplianceRuleSummaryDto'];

export type ComplianceSeverityBreakdownDto =
  components['schemas']['ComplianceSeverityBreakdownDto'];

export type ComplianceSummaryResponse = components['schemas']['ComplianceSummaryResponse'];

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
