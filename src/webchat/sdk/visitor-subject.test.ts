import { describe, it, expect, beforeEach } from 'vitest';
import {
  decideForget,
  readExternalId,
  subjectMac,
  subjectKeyStorageKey,
  type TokenStatement,
} from './visitor-subject';

function segment(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
const token = (payload: unknown) => `${segment({ alg: 'HS256' })}.${segment(payload)}.sig`;

beforeEach(() => {
  localStorage.clear();
});

describe('readExternalId', () => {
  it('ReadExternalId_ShouldReadTheClaim_WhenThePayloadDecodes', () => {
    expect(readExternalId(token({ external_id: 'cust-48151623' }))).toBe('cust-48151623');
  });

  it('ReadExternalId_ShouldDecodeUtf8AndBase64Url_WhenTheIdNeedsThem', () => {
    expect(readExternalId(token({ external_id: 'Pérez>>>???' }))).toBe('Pérez>>>???');
  });

  it('ReadExternalId_ShouldReadTheClaim_OfAnUnsignedToken', () => {
    expect(readExternalId(`${segment({ alg: 'none' })}.${segment({ external_id: 'c1' })}.`)).toBe(
      'c1',
    );
  });

  it.each([
    ['one segment', 'not-a-token'],
    ['two segments', 'aaa.bbb'],
    ['a payload that is not base64url', 'aaa.@@@.ccc'],
    ['a payload that is not JSON', `aaa.${btoa('not json')}.ccc`],
    ['a payload that is not an object', token(7)],
    ['a null payload', token(null)],
    ['no external_id', token({ aud: 't1' })],
    ['a numeric external_id', token({ external_id: 7 })],
    ['a blank external_id', token({ external_id: '  ' })],
  ])('ReadExternalId_ShouldBeNull_WhenTheTokenHas_%s', (_name, value) => {
    expect(readExternalId(value)).toBeNull();
  });
});

describe('subjectMac', () => {
  it('SubjectMac_ShouldBeBase64UrlOfAnHmacSha256_AndNeverHoldTheId', async () => {
    const mac = await subjectMac('t1', 'cust-48151623');
    expect(mac).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mac).not.toContain('cust');
  });

  it('SubjectMac_ShouldKeepThirtyTwoRandomBytes_PerBrowserAndTenant', async () => {
    await subjectMac('t1', 'c');
    await subjectMac('t2', 'c');
    const key = localStorage.getItem(subjectKeyStorageKey('t1'));
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(localStorage.getItem(subjectKeyStorageKey('t2'))).not.toBe(key);
  });

  it('SubjectMac_ShouldBeStable_InOneBrowser', async () => {
    const first = await subjectMac('t1', 'cust-48151623');
    expect(await subjectMac('t1', 'cust-48151623')).toBe(first);
    expect(await subjectMac('t1', 'cust-other')).not.toBe(first);
  });

  it('SubjectMac_ShouldDiffer_BetweenTwoBrowsers', async () => {
    const first = await subjectMac('t1', 'cust-48151623');
    localStorage.clear(); // the second browser: nothing shared
    expect(await subjectMac('t1', 'cust-48151623')).not.toBe(first);
  });
});

describe('decideForget: one test per row of the table', () => {
  const S: TokenStatement = { kind: 'subject', subject: 'S' };
  const S2: TokenStatement = { kind: 'subject', subject: 'S2' };
  const OMITTED: TokenStatement = { kind: 'omitted' };
  const NULL: TokenStatement = { kind: 'signed-out' };
  const UNREADABLE: TokenStatement = { kind: 'unreadable' };

  it.each([
    ['none | none', null, OMITTED, false, 'init', false, null, undefined],
    ['none | null', null, NULL, true, 'setVisitor', false, null, undefined],
    ['none | S, no prior state', null, S, false, 'init', false, 'S', undefined],
    ['none | S, prior state', null, S, true, 'init', true, 'S', undefined],
    ['S | S', 'S', S, true, 'setVisitor', false, 'S', undefined],
    ['S | S2', 'S', S2, true, 'setVisitor', true, 'S2', undefined],
    ['S | null in init', 'S', NULL, true, 'init', true, null, undefined],
    ['S | null in setVisitor', 'S', NULL, true, 'setVisitor', true, null, undefined],
    ['S | omitted in init', 'S', OMITTED, true, 'init', true, null, 'omitted'],
    ['S | omitted in setVisitor', 'S', OMITTED, true, 'setVisitor', false, 'S', undefined],
    ['none | undecodable', null, UNREADABLE, true, 'init', false, null, undefined],
    ['S | undecodable in init', 'S', UNREADABLE, true, 'init', true, null, 'unreadable'],
    [
      'S | undecodable in setVisitor',
      'S',
      UNREADABLE,
      true,
      'setVisitor',
      true,
      null,
      'unreadable',
    ],
  ] as const)(
    'DecideForget_ShouldFollowTheRow_%s',
    (_name, recorded, statement, prior, call, forget, record, warning) => {
      expect(decideForget(recorded, statement, prior, call)).toEqual({ forget, record, warning });
    },
  );
});
