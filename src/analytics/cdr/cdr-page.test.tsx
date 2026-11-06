import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/hook-test-utils';
import listFixture from './__fixtures__/cdr-list-response.v1.json';
import partialListFixture from './__fixtures__/cdr-list-response.partial.v1.json';
import emptyListFixture from './__fixtures__/cdr-list-response.empty.v1.json';
import { ApiError } from '@/core/api/api-error';

// The hook under the page is the real `useCdrList`; only its transport answers the fixture
// (cdr-list-reads-its-envelope B.1, spec "The CDR list is read from its data/hasMore envelope").
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

// The drawer is B.5's; the page test only needs the grid and its pagination.
vi.mock('./cdr-detail-drawer', () => ({ CdrDetailDrawer: () => null }));
vi.mock('@/core/ui/contact-search-panel', () => ({ ContactSearchPanel: () => null }));

import CdrPage from './cdr-page';

function renderPage() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <CdrPage />
    </Wrapper>,
  );
}

function gridRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.ag-center-cols-container [role="row"][row-id]'),
  );
}

function nextButton(): HTMLElement {
  return within(screen.getByTestId('cdr-pagination')).getByRole('button', { name: /next/i });
}

describe('CdrPage', () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
  });

  it('RendersOneRowPerDataElement_AndEnablesNext_WhenTheListAnswersItsFixture', async () => {
    mockCustomFetch.mockResolvedValue(listFixture);
    const { container } = renderPage();

    await waitFor(() => expect(gridRows(container)).toHaveLength(2));
    const rows = gridRows(container);
    expect(rows.map((r) => r.getAttribute('row-id'))).toEqual([
      'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69',
      '0b9e4d217c3a4f58b6e192d4a7c0f3e8',
    ]);

    // The first row carries its agent and talk time.
    expect(rows[0].querySelector('[col-id="agent"]')).toHaveTextContent('Lab Agent 1001');
    expect(rows[0].querySelector('[col-id="talkTimeMs"]')).toHaveTextContent('1:14');

    // The unanswered call has no agentName and no talkTimeMs: both cells render empty.
    const agentCell = rows[1].querySelector('[col-id="agent"]');
    const talkCell = rows[1].querySelector('[col-id="talkTimeMs"]');
    expect(agentCell).not.toBeNull();
    expect(talkCell).not.toBeNull();
    for (const cell of [agentCell, talkCell]) {
      expect(cell!.textContent?.trim()).toBe('');
      expect(cell!.textContent).not.toMatch(/undefined|NaN|null/);
    }

    // The row's channel is read from `channel`.
    expect(rows[0].querySelector('[col-id="channel"]')).toHaveTextContent('voice');
    expect(screen.queryByTestId('cdr-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cdr-error-state')).not.toBeInTheDocument();

    expect(nextButton()).toBeEnabled();
  });

  it('DisablesNext_WhenHasMoreIsFalse', async () => {
    mockCustomFetch.mockResolvedValue(partialListFixture);
    const { container } = renderPage();

    await waitFor(() => expect(gridRows(container)).toHaveLength(1));
    expect(gridRows(container)[0].getAttribute('row-id')).toBe('5d2a8c419e074b3fa1c67f80e2d94b15');
    expect(nextButton()).toBeDisabled();
  });

  // cdr-list-reads-its-envelope B.2 (host B.8b, D17), spec "The console shows a partial record's hold
  // figures as unknown": the partial fixture's holdCount is 1, so the cell must suppress a number the
  // Api did send, not merely fill an absent one.
  it('RendersTheHoldCountAsUnknown_AndTheOtherColumns_WhenTheRowIsPartial', async () => {
    mockCustomFetch.mockResolvedValue(partialListFixture);
    const { container } = renderPage();

    await waitFor(() => expect(gridRows(container)).toHaveLength(1));
    const row = gridRows(container)[0];
    const holdCell = row.querySelector('[col-id="holdCount"]');
    expect(holdCell).not.toBeNull();
    expect(holdCell).toHaveTextContent('cdr.hold_unknown');
    expect(holdCell!.textContent).not.toMatch(/\d/);
    expect(holdCell!.querySelector('[data-hold-unknown]')).not.toBeNull();

    // Every other member renders as usual.
    expect(row.querySelector('[col-id="agent"]')).toHaveTextContent('Lab Agent 1001');
    expect(row.querySelector('[col-id="talkTimeMs"]')).toHaveTextContent('1:14');
    expect(row.querySelector('[col-id="channel"]')).toHaveTextContent('voice');
    expect(row.querySelector('[col-id="qaScore"]')).toHaveTextContent('88/100');
    expect(row.querySelector('[col-id="wrapUpDurationMs"]')).toHaveTextContent('0:15');
  });

  it('RendersTheHoldCountAsItsNumber_WhenTheRowIsComplete', async () => {
    mockCustomFetch.mockResolvedValue(listFixture);
    const { container } = renderPage();

    await waitFor(() => expect(gridRows(container)).toHaveLength(2));
    for (const row of gridRows(container)) {
      const holdCell = row.querySelector('[col-id="holdCount"]');
      expect(holdCell).not.toBeNull();
      expect(holdCell!.textContent?.trim()).toBe('0');
      expect(holdCell!.querySelector('[data-hold-unknown]')).toBeNull();
    }
  });

  it('RequestsTheListRoute_WithPageAndPageSize', async () => {
    mockCustomFetch.mockResolvedValue(listFixture);
    renderPage();

    await waitFor(() => expect(mockCustomFetch).toHaveBeenCalled());
    expect(mockCustomFetch.mock.calls[0][0]).toMatchObject({
      url: '/api/v1/analytics/cdr',
      method: 'GET',
      params: expect.objectContaining({ page: '1', pageSize: '50' }),
    });
  });

  // cdr-list-reads-its-envelope B.4, spec "A failed CDR list shows an error, not an empty list":
  // a failure, a network error and an empty page are three different screens.
  it('ShowsTheErrorState_AndNotTheEmptyState_WhenTheListAnswers500', async () => {
    mockCustomFetch.mockRejectedValue(new ApiError(500, { error: 'boom' }));
    renderPage();

    expect(await screen.findByTestId('cdr-error-state')).toHaveTextContent('cdr.error');
    expect(screen.queryByTestId('cdr-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cdr-table')).not.toBeInTheDocument();
  });

  it('ShowsTheErrorState_AndNotTheEmptyState_WhenTheListFailsOnTheNetwork', async () => {
    mockCustomFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();

    expect(await screen.findByTestId('cdr-error-state')).toHaveTextContent('cdr.error');
    expect(screen.queryByTestId('cdr-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cdr-table')).not.toBeInTheDocument();
  });

  it('ShowsTheEmptyState_AndNotTheErrorState_WhenTheListAnswersItsEmptyFixture', async () => {
    mockCustomFetch.mockResolvedValue(emptyListFixture);
    renderPage();

    expect(await screen.findByTestId('cdr-empty-state')).toHaveTextContent('cdr.empty');
    expect(screen.queryByTestId('cdr-error-state')).not.toBeInTheDocument();
    // The empty state is the grid's no-rows overlay: the grid and its pagination stay.
    expect(screen.getByTestId('cdr-table')).toContainElement(screen.getByTestId('cdr-empty-state'));
    expect(nextButton()).toBeDisabled();
  });
});
