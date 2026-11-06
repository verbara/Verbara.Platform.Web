import { describe, it, expect } from 'vitest';
import listFull from './__fixtures__/cdr-list-response.v1.json';
import listPartial from './__fixtures__/cdr-list-response.partial.v1.json';
import listEmpty from './__fixtures__/cdr-list-response.empty.v1.json';
import detailFull from './__fixtures__/cdr-detail-response.v1.json';
import detailPartial from './__fixtures__/cdr-detail-response.partial.v1.json';
import detailSparse from './__fixtures__/cdr-detail-response.sparse.v1.json';

// The six fixtures are the host change's (Verbara.Platform `call-records-are-written-once`), copied
// byte-identical. These facts pin the identity rules the console relies on; never edit a fixture to
// make a test pass.

const SESSION_ID = /^[0-9a-f]{32}$/;

interface FixtureDetail {
  cdr: { sessionId: string };
  recordingName?: string;
  recordingStreamUrl?: string;
}

const lists: Record<string, { data: { sessionId: string }[] }> = {
  'cdr-list-response.v1.json': listFull,
  'cdr-list-response.partial.v1.json': listPartial,
  'cdr-list-response.empty.v1.json': listEmpty,
};

const details: Record<string, FixtureDetail> = {
  'cdr-detail-response.v1.json': detailFull,
  'cdr-detail-response.partial.v1.json': detailPartial,
  'cdr-detail-response.sparse.v1.json': detailSparse,
};

describe('CDR fixtures', () => {
  it.each(Object.entries(lists))('%s: every row sessionId is 32 lowercase hex', (_name, list) => {
    for (const row of list.data) {
      expect(row.sessionId).toMatch(SESSION_ID);
    }
  });

  it('the non-empty lists carry rows to check', () => {
    expect(listFull.data.length).toBeGreaterThan(0);
    expect(listPartial.data.length).toBeGreaterThan(0);
    expect(listEmpty.data).toEqual([]);
  });

  it.each(Object.entries(details))('%s: the cdr sessionId is 32 lowercase hex', (_name, detail) => {
    expect(detail.cdr.sessionId).toMatch(SESSION_ID);
  });

  it.each(Object.entries(details))(
    '%s: the recording name stem and stream segment equal the sessionId',
    (_name, detail) => {
      const { sessionId } = detail.cdr;
      if (detail.recordingName === undefined) {
        expect(detail.recordingStreamUrl).toBeUndefined();
        return;
      }
      const dot = detail.recordingName.lastIndexOf('.');
      const stem = dot === -1 ? detail.recordingName : detail.recordingName.slice(0, dot);
      expect(stem).toBe(sessionId);
      expect(detail.recordingStreamUrl).toBe(`/api/v1/recordings/${sessionId}/stream`);
      const segments = (detail.recordingStreamUrl ?? '').split('/');
      expect(segments[segments.length - 2]).toBe(sessionId);
    },
  );

  it('the recorded details carry a recording, the sparse one does not', () => {
    expect(detailFull.recordingName).toBeDefined();
    expect(detailPartial.recordingName).toBeDefined();
    expect('recordingName' in detailSparse).toBe(false);
  });
});
