import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { components } from '@/core/api/generated/openapi';

/**
 * Verbatim-fixture guard for the host's silent-listen wire (Platform change
 * `supervisor-silent-listen`, design D12; task 2.4 here). The six copies in
 * `tests/fixtures/contracts/` must match the generated schemas key for key and in JSON type; every
 * refusal carries a kebab machine code in `error` and no `code` key. The shape tables are typed
 * `Record<keyof Schema, Kind>`, so a renamed schema field fails type-checking and a drifted copy
 * fails here at run time (precedent: `refusal-bodies.test.ts`).
 */

type Schemas = components['schemas'];
type Kind = 'string' | 'string|null' | 'number|null';
type Shape<T> = Record<keyof T, Kind>;

const MACHINE_CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

const readJson = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, unknown>;

const ENDPOINT: Shape<Schemas['SupervisorListenEndpointDto']> = {
  endpointId: 'string',
  authorizationUsername: 'string',
  sipPassword: 'string',
  displayName: 'string',
  listenCallerName: 'string',
};
const LISTEN: Shape<Schemas['SupervisorListenDto']> = {
  listenId: 'string',
  conversationId: 'string',
  destination: 'string',
  state: 'string',
  startedAt: 'string',
  listeningSince: 'string|null',
};
const STOPPED: Shape<Schemas['SupervisorListenStoppedDto']> = {
  listenId: 'string',
  conversationId: 'string',
  stoppedAt: 'string',
  endReason: 'string',
};
const LISTEN_PHONE: Shape<Schemas['ListenPhoneDto']> = {
  userId: 'string',
  phoneNumber: 'string|null',
};
/**
 * INTERIM (task 2.3 of `outbound-calls-reach-the-trunk` removes it): the host adds `trunkId`
 * (integer|null) to `SupervisorListenRefusal`, but `openapi.d.ts` is regenerated only after the
 * Platform side merges. Until then the column is typed locally; after the regeneration this is a
 * plain `Shape<Schemas['SupervisorListenRefusal']>`.
 */
type InterimSupervisorListenRefusal = Schemas['SupervisorListenRefusal'] & {
  trunkId?: number | null;
};
const LISTEN_REFUSAL: Shape<Required<InterimSupervisorListenRefusal>> = {
  error: 'string',
  conversationId: 'string|null',
  listenId: 'string|null',
  trunkId: 'number|null',
};
const PHONE_REFUSAL: Shape<Schemas['ListenPhoneRefusal']> = {
  error: 'string',
  phoneNumber: 'string|null',
};
const ACTIVE_SESSION: Shape<Schemas['ActiveSessionDto']> = {
  sessionId: 'string',
  agentId: 'string|null',
  queueName: 'string|null',
  callerIdNum: 'string|null',
  connectedAt: 'string|null',
  conversationId: 'string|null',
};

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function expectShape(body: unknown, shape: Record<string, Kind>, where: string) {
  expect(kindOf(body), where).toBe('object');
  const row = body as Record<string, unknown>;
  expect(Object.keys(row).sort(), where).toEqual(Object.keys(shape).sort());
  for (const [key, kind] of Object.entries(shape)) {
    expect(kind.split('|'), `${where}.${key}`).toContain(kindOf(row[key]));
  }
}

function expectEntry(entry: unknown, status: number, shape: Record<string, Kind>, where: string) {
  expect(kindOf(entry), where).toBe('object');
  const e = entry as { status: unknown; body: unknown };
  expect(e.status, `${where}.status`).toBe(status);
  expectShape(e.body, shape, `${where}.body`);
}

function expectRefusalBody(body: unknown, where: string) {
  const row = body as Record<string, unknown>;
  expect(row.error, `${where}.error`).toMatch(MACHINE_CODE);
  expect(Object.keys(row), where).not.toContain('code');
}

describe('supervisor-silent-listen — verbatim-fixture guard', () => {
  it('ListenEndpointFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    expectEntry(readJson('supervisor-sip-credentials.v1.json'), 200, ENDPOINT, 'endpoint');
  });

  it('ListenStartFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    const fixture = readJson('supervisor-listen-start.v1.json');
    expectEntry(fixture.start, 200, LISTEN, 'start');
    expectEntry(fixture.current, 200, LISTEN, 'current');
    const request = (fixture.start as { request: Record<string, unknown> }).request;
    const requestShape: Shape<Schemas['SupervisorListenStartRequest']> = {
      destination: 'string|null',
    };
    expectShape(request, requestShape, 'start.request');
  });

  it('ListenStopFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    expectEntry(readJson('supervisor-listen-stop.v1.json'), 200, STOPPED, 'stop');
  });

  it('ListenPhoneFixture_ShouldMatchGeneratedSchemas_WhenCopiedFromHost', () => {
    const fixture = readJson('supervisor-listen-phone.v1.json');
    expectEntry(fixture.get, 200, LISTEN_PHONE, 'get');
    expectEntry(fixture.set, 200, LISTEN_PHONE, 'set');
    const requestShape: Shape<Schemas['ListenPhoneRequest']> = { phoneNumber: 'string|null' };
    expectShape((fixture.set as { request: unknown }).request, requestShape, 'set.request');
    expectEntry(fixture.invalid, 400, PHONE_REFUSAL, 'invalid');
    expectRefusalBody((fixture.invalid as { body: unknown }).body, 'invalid.body');
  });

  it('ListenRefusalsFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    const fixture = readJson('supervisor-listen-refusals.json');
    const entries = Object.entries(fixture).filter(([key]) => key !== '_comment');
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, entry] of entries) {
      const { status, body } = entry as { status: number; body: unknown };
      expectEntry(entry, status, LISTEN_REFUSAL, name);
      expectRefusalBody(body, `${name}.body`);
    }
  });

  it('ActiveSessionFixture_ShouldMatchGeneratedSchema_WhenCopiedFromHost', () => {
    const fixture = readJson('active-session.v1.json');
    expect(fixture.status).toBe(200);
    const rows = fixture.body as unknown[];
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row, i) => expectShape(row, ACTIVE_SESSION, `body[${i}]`));
  });
});
