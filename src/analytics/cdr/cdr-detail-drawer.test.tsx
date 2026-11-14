import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { createWrapper } from '@/test/hook-test-utils';
import fullDetail from './__fixtures__/cdr-detail-response.v1.json';
import sparseDetail from './__fixtures__/cdr-detail-response.sparse.v1.json';
import partialDetail from './__fixtures__/cdr-detail-response.partial.v1.json';
import { ApiError } from '@/core/api/api-error';
import availableFixture from '@/core/api/hooks/__fixtures__/qa-availability.available.v1.json';
import noSourceFixture from '@/core/api/hooks/__fixtures__/qa-availability.v1.json';

// The hook under the drawer is the real `useCdrDetail`; only its transport answers
// (cdr-list-reads-its-envelope B.5, spec "The CDR detail is read as the Api sends it" and
// "A failed CDR detail shows an error that tells not-found apart").
// The QA availability read answers through its
// own seam: the configured deployment by default, so the QA summary renders; a test that needs
// another answer sets `availabilityAnswer`.
const mockCustomFetch = vi.fn();
let availabilityAnswer: () => Promise<unknown> = () => Promise.resolve(availableFixture);
vi.mock('@/core/api/client', () => ({
  customFetch: (...args: unknown[]) => {
    const [config] = args as [{ url: string }];
    if (config.url === '/api/v1/analytics/qa-availability') return availabilityAnswer();
    return mockCustomFetch(...args);
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', changeLanguage: vi.fn() },
  }),
}));

// The player is tested in its own file; here it only marks that it was rendered and with which
// path, duration and file name. `suspendPlayer` holds it in its loading state (a never-settling
// lazy chunk), so the drawer's `Suspense` fallback is what renders (B.7, spec `recording-playback`
// "The loading placeholder plays nothing").
let suspendPlayer = false;
const neverSettles = new Promise<never>(() => {});
vi.mock('./stereo-waveform-player', () => ({
  default: (props: {
    src: string;
    durationMs: number;
    sessionId: string;
    recordingName?: string | null;
  }) => {
    if (suspendPlayer) throw neverSettles;
    return (
      <div
        data-testid="stereo-player"
        data-src={props.src}
        data-duration-ms={String(props.durationMs)}
        data-session-id={props.sessionId}
        data-recording-name={props.recordingName ?? ''}
      />
    );
  },
}));
vi.mock('@/core/ui/print-button', () => ({ PrintButton: () => null }));
vi.mock('@/core/ui/pdf-download-button', () => ({ PdfDownloadButton: () => null }));

import { CdrDetailDrawer } from './cdr-detail-drawer';

const FULL_ID = 'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69';
const SPARSE_ID = '0b9e4d217c3a4f58b6e192d4a7c0f3e8';
const PARTIAL_ID = '5d2a8c419e074b3fa1c67f80e2d94b15';

function answerDetail(detail: unknown) {
  mockCustomFetch.mockImplementation(() => Promise.resolve(detail));
}

function failDetail(error: Error) {
  mockCustomFetch.mockImplementation(() => Promise.reject(error));
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
  return mockCustomFetch.mock.calls.map(([config]) => (config as { url: string }).url);
}

describe('CdrDetailDrawer', () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
    suspendPlayer = false;
    availabilityAnswer = () => Promise.resolve(availableFixture);
  });

  // The print/PDF bar renders whenever a session id is given, and nothing renders without one:
  // the drawer returns early on a missing id, so the bar carries no guard of its own.
  it('RendersThePrintBar_WhenASessionIdIsGiven', async () => {
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    await waitFor(() => expect(document.querySelector('[data-print="hide"]')).not.toBeNull());
  });

  it('RendersNothing_AndRequestsNoDetail_WhenNoSessionIdIsGiven', () => {
    answerDetail(fullDetail);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MemoryRouter>
          <CdrDetailDrawer sessionId={null} open onOpenChange={() => {}} />
        </MemoryRouter>
      </Wrapper>,
    );

    expect(document.querySelector('[data-print="hide"]')).toBeNull();
    expect(detailRequestUrls()).toEqual([]);
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
    expect(
      within(screen.getByTestId('cdr-detail-qa-summary')).getByText('cdr.view_full_qa'),
    ).toBeInTheDocument();
    // The stream path is the detail's `recordingStreamUrl`, as sent. The player chunk is lazy (its
    // placeholder carries no source), so the player is awaited.
    const recording = screen.getByTestId('cdr-detail-recording');
    expect(await within(recording).findByTestId('stereo-player')).toHaveAttribute(
      'data-src',
      `/api/v1/recordings/${FULL_ID}/stream`,
    );
    expect(screen.queryByTestId('cdr-detail-error-state')).not.toBeInTheDocument();
  });

  it('HandsThePlayerTheStreamPath_TheRecordsDuration_AndTheRecordingName_WhenTheDetailHasARecording', async () => {
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    const player = await screen.findByTestId('stereo-player');
    expect(player).toHaveAttribute('data-src', `/api/v1/recordings/${FULL_ID}/stream`);
    expect(player).toHaveAttribute('data-duration-ms', '82422');
    expect(player).toHaveAttribute('data-session-id', FULL_ID);
    expect(player).toHaveAttribute('data-recording-name', `${FULL_ID}.wav`);
  });

  it('RendersANonPlayingPlaceholder_AndNoAudioElement_WhileThePlayerChunkLoads', async () => {
    suspendPlayer = true;
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    expect(await screen.findByTestId('cdr-detail-recording')).toBeInTheDocument();
    expect(screen.getByTestId('recording-player-loading')).toBeInTheDocument();
    expect(document.querySelectorAll('audio, video')).toHaveLength(0);
    for (const el of Array.from(document.querySelectorAll('[src], [href]'))) {
      expect(el.getAttribute('src') ?? el.getAttribute('href')).not.toContain(
        '/api/v1/recordings/',
      );
    }
    expect(document.querySelector('[referrerpolicy]')).toBeNull();
  });

  // The API answers `qaSummary` null for an analysis without a QA score (its QA detail is a 404),
  // so the drawer offers the full QA result only together with the summary.
  it('OffersNoFullQaLink_WhenTheDetailHasNoQaSummary', async () => {
    answerDetail({
      ...fullDetail,
      qaSummary: null,
      cdr: { ...fullDetail.cdr, hasQaScore: false, qaScore: null },
    });
    renderDrawer(FULL_ID);

    await waitFor(() => expect(screen.getAllByTestId('cdr-detail-timeline-entry')).toHaveLength(4));
    expect(screen.queryByTestId('cdr-detail-qa-summary')).not.toBeInTheDocument();
    expect(screen.queryByText('cdr.view_full_qa')).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('recording-player-loading')).not.toBeInTheDocument();
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

  // Spec "The console shows a partial record's hold figures as unknown", detail scenarios (B.3).
  it('RendersTheHoldCountAsUnknown_NotItsNumber_WhenTheDetailIsPartial', async () => {
    answerDetail(partialDetail);
    renderDrawer(PARTIAL_ID);

    await screen.findByTestId('cdr-detail-fields');
    // The fixture's `holdCount` is 2 (`cdr-detail-response.partial.v1.json:24`): the number is
    // suppressed, not merely absent.
    expect(screen.queryByText('2', { exact: true })).not.toBeInTheDocument();
    const hold = screen.getByTestId('cdr-detail-hold-count');
    expect(hold).toHaveTextContent('cdr.hold_unknown');
    expect(hold).toHaveAttribute('data-hold-unknown');
    expect(hold.textContent).not.toMatch(/\d/);
    // The other members render as usual.
    expect(screen.getByTestId('cdr-detail-fields')).toHaveTextContent('Lab Agent 1001');
  });

  it('RendersTheHoldCountAsItsNumber_WhenTheDetailIsComplete', async () => {
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    await screen.findByTestId('cdr-detail-fields');
    // The control's `holdCount` is 0 (`cdr-detail-response.v1.json:24`), a number like any other.
    const hold = screen.getByTestId('cdr-detail-hold-count');
    expect(hold).toHaveTextContent('0');
    expect(hold).not.toHaveTextContent('cdr.hold_unknown');
    expect(hold).not.toHaveAttribute('data-hold-unknown');
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

  // Spec "The console does not present QA results that cannot exist": the drawer's QA summary
  // follows `available`, even when the record carries one.
  // The Api serves no transcript route, so the drawer never asks for one, even for a detail that
  // still says `hasTranscript` true.
  it('RequestsNoTranscript_WhenTheDetailSaysItHasOne', async () => {
    answerDetail({ ...fullDetail, hasTranscript: true });
    renderDrawer(FULL_ID);

    await waitFor(() => expect(screen.getAllByTestId('cdr-detail-timeline-entry')).toHaveLength(4));
    await screen.findByTestId('stereo-player');
    expect(detailRequestUrls()).toEqual([`/api/v1/analytics/cdr/${FULL_ID}`]);
  });

  it('RendersNoQaSummary_WhenNoTranscriptSourceIsConfigured', async () => {
    availabilityAnswer = () => Promise.resolve(noSourceFixture);
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    await waitFor(() => expect(screen.getAllByTestId('cdr-detail-timeline-entry')).toHaveLength(4));
    expect(screen.queryByTestId('cdr-detail-qa-summary')).not.toBeInTheDocument();
  });

  it('RendersNoQaSummary_WhenTheAvailabilityReadFails', async () => {
    availabilityAnswer = () => Promise.reject(new ApiError(404, null));
    answerDetail(fullDetail);
    renderDrawer(FULL_ID);

    await waitFor(() => expect(screen.getAllByTestId('cdr-detail-timeline-entry')).toHaveLength(4));
    expect(screen.queryByTestId('cdr-detail-qa-summary')).not.toBeInTheDocument();
  });
});
