import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { activeSessionV2Rows } from './active-session-v2.contract';

describe('active-session.v2.json — type-level contract literals', () => {
  it('ActiveSessionV2Rows_ShouldEqualTheFixtureBody_WhenCopiedFromHost', () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'tests/fixtures/contracts/active-session.v2.json'),
        'utf-8',
      ),
    ) as { status: number; body: unknown[] };
    expect(fixture.status).toBe(200);
    expect(activeSessionV2Rows).toEqual(fixture.body);
  });
});
