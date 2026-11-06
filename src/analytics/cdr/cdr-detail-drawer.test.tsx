import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { createWrapper } from '@/test/hook-test-utils';
import fullDetail from './__fixtures__/cdr-detail-response.v1.json';
import sparseDetail from './__fixtures__/cdr-detail-response.sparse.v1.json';
import { ApiError } from '@/core/api/api-error';

// The hook under the drawer is the real `useCdrDetail`; only its transport answers
// (cdr-list-reads-its-envelope B.5, spec "The CDR detail is read as the Api sends it" and
// "A failed CDR detail shows an error that tells not-found apart").
const mockCustomFetch = vi.fn();
vi.mock('@/core/api/client', () => ({
  customFetch: (...args: unknown[]) => mockCustomFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', changeLanguage: vi.fn() },
  }),
}));

// The players are B.7's; here they only mark that a player was rendered and with which path.
vi.mock('./stereo-waveform-player', () => ({
  default: ({ src }: { src: string }) => <div data-testid="stereo-player" data-src={src} />,
}));
vi.mock('./audio-player', () => ({
  AudioPlayer: ({ src }: { src: string }) => <div data-testid="audio-player" data-src={src} />,
}));
vi.mock('./synced-transcript', () => ({ SyncedTranscript: () => null }));
vi.mock('@/core/ui/print-button', () => ({ PrintButton: () => null }));
vi.mock('@/core/ui/pdf-download-button', () => ({ PdfDownloadButton: () => null }));

import { CdrDetailDrawer } from './cdr-detail-drawer';

const FULL_ID = 'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69';
const SPARSE_ID = '0b9e4d217c3a4f58b6e192d4a7c0f3e8';

function answerDetail(detail: unknown) {
  mockCustomFetch.mockImplementation(({ url }: { url: string }) => {
    if (url.endsWith('/transcript')) return Promise.resolve([]);
    return Promise.resolve(detail);
  });
}

function failDetail(error: Error) {
  mockCustomFetch.mockImplementation(({ url }: { url: string }) => {
    if (url.endsWith('/transcript')) return Promise.resolve([]);
    return Promise.reject(error);
  });
}

function renderDrawer(sessionId: string) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter>
        <CdrDetailDrawer sessionId={sessionId} open onOpenChange={() => {}} />
      </MemoryRouter>
    </Wrapper>,
  );
}

function detailRequestUrls(): string[] {
  return mockCustomFetch.mock.calls
    .map(([config]) => (config as { url: string }).url)
    .filter((url) => !url.endsWith('/transcript'));
}

describe('CdrDetailDrawer', () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
  });

  it('RendersFourTimelineEntries_TheNarrative_AndThePlayer_WhenTheDetailAnswersItsFullFixture', async () => {
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    await waitFor(() => expect(screen.getAllByTestId('cdr-detail-timeline-entry')).toHaveLength(4));
    const entries = screen.getAllByTestId('cdr-detail-timeline-entry');
    expect(entries.map((e) => e.getAttribute('data-event'))).toEqual([
      'started',
      'answered',
      'transferred',
      'ended',
    ]);
    expect(screen.getByTestId('cdr-detail-qa-summary')).toHaveTextContent(
      'The caller asked about an invoice; the agent explained the charge.',
    );
    // The stream path is the detail's `recordingStreamUrl`, as sent.
    expect(screen.getByTestId('cdr-detail-recording')).toBeInTheDocument();
    expect(screen.getByTestId('cdr-detail-recording').querySelector('[data-src]')).toHaveAttribute(
      'data-src',
      `/api/v1/recordings/${FULL_ID}/stream`,
    );
    expect(screen.queryByTestId('cdr-detail-error-state')).not.toBeInTheDocument();
  });

  it('RendersTwoTimelineEntries_NoQaSummary_AndNoPlayer_WhenTheDetailAnswersItsSparseFixture', async () => {
    answerDetail(sparseDetail);
    renderDrawer(SPARSE_ID);

    await waitFor(() => expect(screen.getAllByTestId('cdr-detail-timeline-entry')).toHaveLength(2));
    expect(
      screen.getAllByTestId('cdr-detail-timeline-entry').map((e) => e.getAttribute('data-event')),
    ).toEqual(['started', 'ended']);
    expect(screen.queryByTestId('cdr-detail-qa-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cdr-detail-recording')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stereo-player')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audio-player')).not.toBeInTheDocument();
    // An absent member never renders as a literal.
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  it('ShowsTheNotFoundText_AndNoTimeline_WhenTheDetailAnswers404', async () => {
    failDetail(new ApiError(404, null));
    renderDrawer(FULL_ID);

    // No row-built timeline or field stands in for the record while it fails.
    await waitFor(() => expect(detailRequestUrls()).toHaveLength(1));
    expect(screen.queryByText('Call started')).not.toBeInTheDocument();
    expect(screen.queryByText('Lab Agent 1001')).not.toBeInTheDocument();
    const errorState = await screen.findByTestId('cdr-detail-error-state');
    expect(errorState).toHaveTextContent('cdr.detail.not_found');
    expect(errorState).not.toHaveTextContent('cdr.detail.error');
    expect(screen.queryAllByTestId('cdr-detail-timeline-entry')).toHaveLength(0);
    expect(screen.queryByTestId('cdr-detail-fields')).not.toBeInTheDocument();
  });

  it('ShowsTheGenericText_NotTheNotFoundText_WhenTheDetailAnswers500', async () => {
    failDetail(new ApiError(500, null));
    renderDrawer(FULL_ID);

    const errorState = await screen.findByTestId('cdr-detail-error-state');
    expect(errorState).toHaveTextContent('cdr.detail.error');
    expect(errorState).not.toHaveTextContent('cdr.detail.not_found');
    expect(screen.queryAllByTestId('cdr-detail-timeline-entry')).toHaveLength(0);
    expect(screen.queryByTestId('cdr-detail-fields')).not.toBeInTheDocument();
  });

  it('ShowsTheLocalizedLoadingText_WhileTheDetailIsPending', async () => {
    mockCustomFetch.mockImplementation(() => new Promise(() => {}));
    renderDrawer(FULL_ID);

    expect(await screen.findByTestId('cdr-detail-loading')).toHaveTextContent('cdr.detail.loading');
    expect(screen.queryAllByTestId('cdr-detail-timeline-entry')).toHaveLength(0);
  });

  it.each([FULL_ID, SPARSE_ID, '5d2a8c419e074b3fa1c67f80e2d94b15'])(
    'RequestsTheDetailPathWithTheSessionIdUnencoded_WhenOpenedFor_%s',
    async (sessionId) => {
      answerDetail(fullDetail);
      renderDrawer(sessionId);

      await waitFor(() => expect(detailRequestUrls()).toHaveLength(1));
      expect(detailRequestUrls()).toEqual([`/api/v1/analytics/cdr/${sessionId}`]);
    },
  );
});
