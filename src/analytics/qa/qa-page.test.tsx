import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/hook-test-utils';
import noSource from '@/core/api/hooks/__fixtures__/qa-availability.v1.json';
import available from '@/core/api/hooks/__fixtures__/qa-availability.available.v1.json';
import notLicensed from '@/core/api/hooks/__fixtures__/qa-availability.not-licensed.v1.json';
import listFixture from '@/core/api/hooks/__fixtures__/qa-list-response.v1.json';

// qa-scores-are-produced-or-not-shown (design D2, task 2.2): a direct visit names why QA results
// cannot exist instead of an empty table, and the list is read from its `data`/`hasMore` envelope
// (QA-CONSOLE arm (b) measured the page rendering 0 of 1 row while it read `items`).
const mockCustomFetch = vi.fn();
vi.mock('@/core/api/client', () => ({
  customFetch: (...args: unknown[]) => mockCustomFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

vi.mock('./qa-detail-drawer', () => ({ QaDetailDrawer: () => null }));

import QaPage from './qa-page';

function answer(availability: unknown, list: unknown = listFixture) {
  mockCustomFetch.mockImplementation(({ url }: { url: string }) => {
    if (url === '/api/v1/analytics/qa-availability') return Promise.resolve(availability);
    if (url === '/api/v1/analytics/qa') return Promise.resolve(list);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function listRequests() {
  return mockCustomFetch.mock.calls.filter(
    ([config]) => (config as { url: string }).url === '/api/v1/analytics/qa',
  );
}

function renderPage() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/analytics/qa']}>
        <QaPage />
      </MemoryRouter>
    </Wrapper>,
  );
}

describe('QaPage', () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
  });

  it.each([
    ['no transcript source', noSource, 'not_configured'],
    [
      'the analysis not registered',
      { ...noSource, reason: 'analysis_not_registered' },
      'not_configured',
    ],
    ['no call analytics licence', notLicensed, 'not_licensed'],
    ['no scorecard', { ...available, available: false, reason: 'no_scorecard' }, 'no_scorecard'],
  ])(
    'NamesTheReason_AndShowsNoTable_AndRequestsNoList_WhenTheAvailabilityAnswers %s',
    async (_name, availability, reason) => {
      answer(availability);
      renderPage();

      const state = await screen.findByTestId('qa-unavailable');
      expect(state).toHaveAttribute('data-reason', reason);
      expect(state).toHaveTextContent(`availability.${reason}`);
      expect(screen.queryByTestId('qa-table')).not.toBeInTheDocument();
      expect(listRequests()).toHaveLength(0);
    },
  );

  it('NamesAnUnknownReason_AndShowsNoTable_WhenTheAvailabilityReadFails', async () => {
    mockCustomFetch.mockRejectedValue(new Error('404'));
    renderPage();

    expect(await screen.findByTestId('qa-unavailable')).toHaveAttribute('data-reason', 'unknown');
    expect(screen.queryByTestId('qa-table')).not.toBeInTheDocument();
    expect(listRequests()).toHaveLength(0);
  });

  it('ShowsNeitherTheTableNorAReason_WhileTheAvailabilityIsPending', () => {
    mockCustomFetch.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.queryByTestId('qa-unavailable')).not.toBeInTheDocument();
    expect(screen.queryByTestId('qa-table')).not.toBeInTheDocument();
    expect(screen.getByText('status.loading')).toBeInTheDocument();
  });

  it('ShowsTheCommonLoadingText_WhileTheListIsPending', async () => {
    mockCustomFetch.mockImplementation(({ url }: { url: string }) =>
      url === '/api/v1/analytics/qa-availability'
        ? Promise.resolve(available)
        : new Promise(() => {}),
    );
    renderPage();

    await waitFor(() => expect(listRequests()).toHaveLength(1));
    expect(screen.getByText('status.loading')).toBeInTheDocument();
    expect(screen.queryByTestId('qa-table')).not.toBeInTheDocument();
  });

  it('RendersTheFixturesOneRow_AndDisablesNext_WhenTheListAnswersItsFixture', async () => {
    answer(available);
    renderPage();

    const table = await screen.findByTestId('qa-table');
    await waitFor(() => expect(within(table).getByText('Agent One')).toBeInTheDocument());
    expect(within(table).getByText('support')).toBeInTheDocument();
    expect(
      within(table).getByText('Caller asked about an invoice; the agent confirmed the amount.'),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(2); // header + the one row
    expect(screen.getByTestId('qa-page-next')).toBeDisabled();
    expect(screen.getByTestId('qa-page-previous')).toBeDisabled();
    expect(listRequests()[0][0]).toMatchObject({
      params: expect.objectContaining({ page: '1', pageSize: '50' }),
    });
    expect(listRequests()[0][0].params).not.toHaveProperty('queue');
  });

  it('EnablesNext_AndRequestsPageTwo_WhenTheListSaysHasMore', async () => {
    answer(available, { ...listFixture, hasMore: true });
    renderPage();

    const next = await screen.findByTestId('qa-page-next');
    await waitFor(() => expect(next).toBeEnabled());
    next.click();

    await waitFor(() =>
      expect(
        listRequests().some(([c]) => (c as { params: { page: string } }).params.page === '2'),
      ).toBe(true),
    );
  });

  it('ShowsTheSentimentColumn_WhenSentimentIsSupported', async () => {
    answer(available);
    renderPage();

    const table = await screen.findByTestId('qa-table');
    await waitFor(() => expect(within(table).getByText('Neutral')).toBeInTheDocument());
    expect(within(table).getByText('qa.sentiment')).toBeInTheDocument();
    expect(screen.queryByTestId('qa-sentiment-unsupported')).not.toBeInTheDocument();
  });

  // Audit round 10, F2: sentiment of a language the analysis does not support is hidden and the
  // page says why, never a column of neutral labels.
  it('HidesTheSentimentColumn_AndSaysWhy_WhenTheLanguageIsNotSupported', async () => {
    answer({ ...available, sentimentSupported: false });
    renderPage();

    const table = await screen.findByTestId('qa-table');
    await waitFor(() => expect(within(table).getByText('Agent One')).toBeInTheDocument());
    expect(within(table).queryByText('qa.sentiment')).not.toBeInTheDocument();
    expect(within(table).queryByText('Neutral')).not.toBeInTheDocument();
    expect(screen.getByTestId('qa-sentiment-unsupported')).toHaveTextContent(
      'availability.sentiment_unsupported',
    );
  });

  it('GoesBackToPageOne_WhenPreviousIsClickedOnPageTwo', async () => {
    answer(available, { ...listFixture, hasMore: true });
    renderPage();

    const next = await screen.findByTestId('qa-page-next');
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
    const previous = screen.getByTestId('qa-page-previous');
    await waitFor(() => expect(previous).toBeEnabled());
    fireEvent.click(previous);

    await waitFor(() => expect(previous).toBeDisabled());
  });

  it.each([
    ['Positive', 'text-green-600'],
    ['Negative', 'text-red-500'],
  ])('ColoursTheSentimentLabel %s', async (label, colour) => {
    answer(available, {
      ...listFixture,
      data: [{ ...listFixture.data[0], sentimentLabel: label }],
    });
    renderPage();

    const table = await screen.findByTestId('qa-table');
    await waitFor(() => expect(within(table).getByText(label)).toHaveClass(colour));
  });
});
