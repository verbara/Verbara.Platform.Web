import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/hook-test-utils';
import noSource from '@/core/api/hooks/__fixtures__/qa-availability.v1.json';
import available from '@/core/api/hooks/__fixtures__/qa-availability.available.v1.json';

// The QA entry follows `available`, the Speech Analytics entry
// `analysisRunning`, and both stay hidden until a successful read says so.
const mockCustomFetch = vi.fn();
vi.mock('@/core/api/client', () => ({
  customFetch: (...args: unknown[]) => mockCustomFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

import { AnalyticsSidebar } from './analytics-sidebar';

function renderSidebar() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter>
        <AnalyticsSidebar />
      </MemoryRouter>
    </Wrapper>,
  );
}

describe('AnalyticsSidebar', () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
  });

  it('HidesTheQaAndSpeechEntries_WhileTheAvailabilityHasNotAnswered', () => {
    mockCustomFetch.mockReturnValue(new Promise(() => {}));
    renderSidebar();

    expect(screen.getByTestId('sidebar-link-cdr')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-qa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-speech')).not.toBeInTheDocument();
  });

  it('KeepsTheQaAndSpeechEntriesHidden_WhenTheAvailabilityReadFails', async () => {
    mockCustomFetch.mockRejectedValue(new Error('404'));
    renderSidebar();

    await waitFor(() => expect(mockCustomFetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('sidebar-link-qa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-speech')).not.toBeInTheDocument();
  });

  it('HidesTheQaAndSpeechEntries_WhenNoTranscriptSourceIsConfigured', async () => {
    mockCustomFetch.mockResolvedValue(noSource);
    renderSidebar();

    await waitFor(() => expect(mockCustomFetch).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('sidebar-link-recordings')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-qa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-speech')).not.toBeInTheDocument();
  });

  it('ShowsSpeechButNotQa_WhenAnalysisRunsWithoutAScorecard', async () => {
    mockCustomFetch.mockResolvedValue({ ...available, available: false, reason: 'no_scorecard' });
    renderSidebar();

    expect(await screen.findByTestId('sidebar-link-speech')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-link-qa')).not.toBeInTheDocument();
  });

  it('ShowsTheQaAndSpeechEntries_WhenTheAvailabilitySaysAvailable', async () => {
    mockCustomFetch.mockResolvedValue(available);
    renderSidebar();

    expect(await screen.findByTestId('sidebar-link-qa')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-speech')).toBeInTheDocument();
    expect(mockCustomFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/qa-availability',
      method: 'GET',
      suppressPaymentRequiredModal: true,
    });
  });
});
