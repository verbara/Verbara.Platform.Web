import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { components } from '@/core/api/generated/openapi';

/**
 * Verbatim-fixture guard for the host's click-to-dial and voice-transfer bodies (Platform change
 * `outbound-calls-reach-the-trunk`, design D5; task 2.4 here). Every entry of
 * `tests/fixtures/contracts/voice-dial-transfer.v1.json` must match the generated schema of its
 * `route` key for key and in JSON type. `correlationId` and `error` may be absent (the host omits a
 * null one); `trunkId` is always written. The shape tables are typed `Record<keyof Schema, Kind>`,
 * so a renamed schema field fails type-checking and a drifted copy fails here at run time
 * (precedent: `supervisor-listen-bodies.test.ts`).
 */

type Schemas = components['schemas'];
type Kind = 'boolean' | 'number|null' | 'absent|string';
type Shape<T> = Record<keyof T, Kind>;

const MACHINE_CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

const DIAL: Shape<Schemas['VoiceDialResponse']> = {
  accepted: 'boolean',
  correlationId: 'absent|string',
  error: 'absent|string',
  trunkId: 'number|null',
};
const TRANSFER: Shape<Schemas['VoiceTransferResponse']> = {
  accepted: 'boolean',
  error: 'absent|string',
  trunkId: 'number|null',
};
const SHAPES: Record<string, Record<string, Kind>> = { dial: DIAL, transfer: TRANSFER };

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/voice-dial-transfer.v1.json'),
    'utf-8',
  ),
) as Record<string, unknown>;

function kindOf(row: Record<string, unknown>, key: string): string {
  if (!(key in row)) return 'absent';
  const value = row[key];
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

describe('outbound-calls-reach-the-trunk — verbatim-fixture guard', () => {
  const entries = Object.entries(fixture).filter(([key]) => key !== '_comment');

  it('VoiceDialTransferFixture_ShouldHaveEntries_WhenCopiedFromHost', () => {
    expect(entries.map(([, e]) => (e as { route: string }).route).sort()).toEqual(
      expect.arrayContaining(['dial', 'transfer']),
    );
  });

  it.each(entries)(
    'VoiceDialTransferFixture_ShouldMatchGeneratedSchema_WhenEntryIs %s',
    (name, entry) => {
      const e = entry as { status: unknown; route: unknown; body: Record<string, unknown> };
      const shape = SHAPES[e.route as string];
      if (!shape) throw new Error(`${name}.route: unknown route ${String(e.route)}`);
      expect(e.status, `${name}.status`).toBe(e.body.accepted === true ? 200 : 409);

      const keys = Object.keys(e.body);
      expect(keys, name).not.toContain('code');
      for (const key of keys) expect(Object.keys(shape), `${name}.${key}`).toContain(key);
      for (const [key, kind] of Object.entries(shape)) {
        expect(kind.split('|'), `${name}.${key}`).toContain(kindOf(e.body, key));
      }
      if ('error' in e.body) expect(e.body.error, `${name}.error`).toMatch(MACHINE_CODE);
    },
  );
});
