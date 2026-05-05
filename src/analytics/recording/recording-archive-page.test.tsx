import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseCdrList = vi.fn();

vi.mock('@/core/api/hooks/use-analytics', () => ({
  useCdrList: (...args: unknown[]) => mockUseCdrList(...args),
}));

vi.mock('@/core/api/hooks/use-recording', () => ({
  recordingStreamUrl: (id: string) => `/api/v1/recordings/${id}/stream`,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/analytics/cdr/stereo-waveform-player', () => ({
  default: ({ src }: { src: string }) => <div data-testid="waveform-player">{src}</div>,
}));

import RecordingArchivePage from './recording-archive-page';

const mockRecordings = [
  {
    sessionId: 'ses-001',
    startTime: '2026-05-01T10:00:00Z',
    contact: '+1234567890',
    agentName: 'Alice',
    queueName: 'Support',
    durationMs: 185000,
    hasRecording: true,
    recordingStreamUrl: '/api/v1/recordings/ses-001/stream',
    channel: 'voice',
    endTime: '2026-05-01T10:03:05Z',
    disposition: 'answered',
    slaMet: true,
    hasQaScore: false,
    holdCount: 0,
  },
  {
    sessionId: 'ses-002',
    startTime: '2026-05-01T11:00:00Z',
    agentName: 'Bob',
    queueName: 'Sales',
    durationMs: 60000,
    hasRecording: true,
    recordingStreamUrl: '/api/v1/recordings/ses-002/stream',
    channel: 'voice',
    endTime: '2026-05-01T11:01:00Z',
    disposition: 'answered',
    slaMet: true,
    hasQaScore: false,
    holdCount: 0,
  },
  {
    sessionId: 'ses-003',
    startTime: '2026-05-01T12:00:00Z',
    agentName: 'Charlie',
    queueName: 'Billing',
    durationMs: 30000,
    hasRecording: false,
    channel: 'voice',
    endTime: '2026-05-01T12:00:30Z',
    disposition: 'answered',
    slaMet: true,
    hasQaScore: false,
    holdCount: 0,
  },
];

describe('RecordingArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_RenderPageHeader_WhenMounted', () => {
    mockUseCdrList.mockReturnValue({ data: undefined, isLoading: true });
    render(<RecordingArchivePage />);
    expect(screen.getByTestId('page-header-title')).toHaveTextContent('Recording Archive');
  });

  it('should_ShowEmptyState_WhenNoRecordings', () => {
    mockUseCdrList.mockReturnValue({
      data: { items: [], totalCount: 0, page: 1, pageSize: 20, hasNextPage: false },
      isLoading: false,
    });
    render(<RecordingArchivePage />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No recordings found');
  });

  it('should_ShowEmptyState_WhenAllRowsLackRecording', () => {
    mockUseCdrList.mockReturnValue({
      data: {
        items: [mockRecordings[2]],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      },
      isLoading: false,
    });
    render(<RecordingArchivePage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('should_RenderRecordingRows_WhenDataAvailable', () => {
    mockUseCdrList.mockReturnValue({
      data: {
        items: mockRecordings,
        totalCount: 3,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      },
      isLoading: false,
    });
    render(<RecordingArchivePage />);
    // Only 2 rows with hasRecording=true
    expect(screen.getByTestId('play-ses-001')).toBeInTheDocument();
    expect(screen.getByTestId('play-ses-002')).toBeInTheDocument();
    expect(screen.queryByTestId('play-ses-003')).not.toBeInTheDocument();
    // Download buttons
    expect(screen.getByTestId('download-ses-001')).toBeInTheDocument();
    expect(screen.getByTestId('download-ses-002')).toBeInTheDocument();
  });

  it('should_ExpandPlayerSection_WhenPlayClicked', async () => {
    mockUseCdrList.mockReturnValue({
      data: {
        items: mockRecordings,
        totalCount: 3,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      },
      isLoading: false,
    });
    render(<RecordingArchivePage />);
    expect(screen.queryByTestId('player-row-ses-001')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('play-ses-001'));
    expect(screen.getByTestId('player-row-ses-001')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('waveform-player')).toHaveTextContent(
        '/api/v1/recordings/ses-001/stream',
      );
    });
  });

  it('should_CollapsePlayer_WhenSamePlayClickedAgain', () => {
    mockUseCdrList.mockReturnValue({
      data: {
        items: mockRecordings,
        totalCount: 3,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      },
      isLoading: false,
    });
    render(<RecordingArchivePage />);

    fireEvent.click(screen.getByTestId('play-ses-001'));
    expect(screen.getByTestId('player-row-ses-001')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('play-ses-001'));
    expect(screen.queryByTestId('player-row-ses-001')).not.toBeInTheDocument();
  });

  it('should_SwitchPlayer_WhenDifferentPlayClicked', () => {
    mockUseCdrList.mockReturnValue({
      data: {
        items: mockRecordings,
        totalCount: 3,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      },
      isLoading: false,
    });
    render(<RecordingArchivePage />);

    fireEvent.click(screen.getByTestId('play-ses-001'));
    expect(screen.getByTestId('player-row-ses-001')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('play-ses-002'));
    expect(screen.queryByTestId('player-row-ses-001')).not.toBeInTheDocument();
    expect(screen.getByTestId('player-row-ses-002')).toBeInTheDocument();
  });

  it('should_FormatDurationCorrectly_WhenRendered', () => {
    mockUseCdrList.mockReturnValue({
      data: {
        items: [mockRecordings[0]],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      },
      isLoading: false,
    });
    render(<RecordingArchivePage />);
    // 185000ms = 3:05
    expect(screen.getByText('3:05')).toBeInTheDocument();
  });

  it('should_RenderFilterBar_WhenMounted', () => {
    mockUseCdrList.mockReturnValue({ data: undefined, isLoading: true });
    render(<RecordingArchivePage />);
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Agent')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Queue')).toBeInTheDocument();
  });
});
