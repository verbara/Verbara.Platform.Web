/**
 * Type-level contract for `GET /api/v1/supervisor/sessions/active` against the host fixture
 * `tests/fixtures/contracts/active-session.v2.json` (spec `voice-monitor-session-list`,
 * requirement 1). A non-test module on purpose: `tsconfig.app.json` compiles it, so `tsc -b`
 * (the type-check half of `npm run build`) fails when the generated `ActiveSessionDto` drifts from
 * the fixture's eight members or a row stops being a value of it. `*.test.ts(x)` files are
 * excluded from every compiler project and would gate nothing.
 */
import type { components } from '@/core/api/generated/openapi';

type ActiveSessionDto = components['schemas']['ActiveSessionDto'];

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

/** The eight member names of `active-session.v2.json`, no more and no fewer. */
type ActiveSessionV2Keys =
  | 'sessionId'
  | 'agentId'
  | 'agentName'
  | 'queueName'
  | 'callerIdNum'
  | 'connectedAt'
  | 'conversationId'
  | 'sentiment';

export type ActiveSessionV2KeySetHolds = Expect<Equal<keyof ActiveSessionDto, ActiveSessionV2Keys>>;

/** Both `body` rows of `active-session.v2.json`, verbatim. */
export const activeSessionV2Rows = [
  {
    sessionId: '1712345678.42',
    agentId: '0651f84b6f284a1c9b8d658330fa8310',
    agentName: 'Ana Gómez',
    queueName: 'acme-support',
    callerIdNum: '+573009876543',
    connectedAt: '2026-10-12T15:01:00.000+00:00',
    conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
    sentiment: 'Frustrated',
  },
  {
    sessionId: '1712345699.07',
    agentId: null,
    agentName: null,
    queueName: null,
    callerIdNum: null,
    connectedAt: null,
    conversationId: null,
    sentiment: null,
  },
] as const satisfies readonly ActiveSessionDto[];

/** Negative control: a numeric `sentiment` is not a value of the generated type. */
export const activeSessionV2NumericSentimentIsRefused: ActiveSessionDto = {
  ...activeSessionV2Rows[1],
  // @ts-expect-error -- sentiment is `null | string`, never a number
  sentiment: 42,
};
