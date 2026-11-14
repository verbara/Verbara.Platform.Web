import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/hook-test-utils';
import available from '@/core/api/hooks/__fixtures__/qa-availability.available.v1.json';

// The QA detail shows its
// sentiment only where the tenant's call language is supported by the sentiment analysis.
let availabilityBody: unknown = available;
let detailPending = false;
const qaDetail = {
  sessionId: 's1',
  analyzedAt: '2026-11-10T02:00:00+00:00',
  agentName: 'Agent One',
  queueName: 'support',
  qaScore: 75,
  maxPossibleScore: 100,
  criteria: [],
  violations: [],
  actionItems: [],
  sentimentLabel: 'Negative',
  sentimentTrend: 'Declining',
  sentimentTimeline: [
    { turnIndex: 0, score: 0.2, label: 'Positive', speaker: 'caller' },
    { turnIndex: 1, score: -0.6, label: 'Negative', speaker: 'agent' },
  ],
  allTopics: [],
};

vi.mock('@/core/api/client', () => ({
  customFetch: ({ url }: { url: string }) =>
    url === '/api/v1/analytics/qa-availability'
      ? Promise.resolve(availabilityBody)
      : detailPending
        ? new Promise(() => {})
        : Promise.resolve(qaDetail),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
vi.mock('@/core/ui/print-button', () => ({ PrintButton: () => null }));
vi.mock('@/core/ui/pdf-download-button', () => ({ PdfDownloadButton: () => null }));

import { QaDetailDrawer } from './qa-detail-drawer';

function renderDrawer() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <QaDetailDrawer sessionId="s1" open onOpenChange={() => {}} />
    </Wrapper>,
  );
}

describe('QaDetailDrawer', () => {
  beforeEach(() => {
    availabilityBody = available;
    detailPending = false;
  });

  it('ShowsTheCommonLoadingText_WhileTheDetailIsPending', async () => {
    detailPending = true;
    renderDrawer();

    expect(await screen.findByText('status.loading')).toBeInTheDocument();
    expect(screen.queryByTestId('qa-topics')).not.toBeInTheDocument();
  });

  it('ShowsTheSentimentSection_WhenSentimentIsSupported', async () => {
    renderDrawer();

    expect(await screen.findByTestId('qa-sentiment-chart')).toBeInTheDocument();
    expect(screen.getByText('Negative')).toBeInTheDocument();
    expect(screen.getByTestId('qa-sentiment-chart-container')).toHaveAttribute('data-points', '2');
  });

  it('HidesTheSentimentSection_WhenTheLanguageIsNotSupported', async () => {
    availabilityBody = { ...available, sentimentSupported: false };
    renderDrawer();

    expect(await screen.findByTestId('qa-topics')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('qa-sentiment-chart')).not.toBeInTheDocument());
    expect(screen.queryByText('Negative')).not.toBeInTheDocument();
  });
});
