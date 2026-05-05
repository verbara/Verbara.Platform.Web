import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const table: Record<string, string> = {
        'sseDiagnostic.title': 'SSE Diagnostics',
        'sseDiagnostic.description': 'Real-time SSE connection monitoring',
        'sseDiagnostic.clearLog': 'Clear Log',
        'sseDiagnostic.connectionState': 'Connection',
        'sseDiagnostic.status.disconnected': 'Disconnected',
        'sseDiagnostic.status.connected': 'Connected',
        'sseDiagnostic.status.reconnecting': 'Reconnecting',
        'sseDiagnostic.totalEvents': 'Total Events',
        'sseDiagnostic.uptime': 'Uptime',
        'sseDiagnostic.lastEvent': 'Last Event',
        'sseDiagnostic.eventCounters': 'Event Counters',
        'sseDiagnostic.eventLog': 'Event Log',
        'sseDiagnostic.columns.timestamp': 'Timestamp',
        'sseDiagnostic.columns.eventType': 'Event Type',
        'sseDiagnostic.columns.payload': 'Payload',
        'sseDiagnostic.noEvents': 'No events received yet.',
      };
      return table[key] ?? key;
    },
  }),
}));

vi.mock('@/core/hooks/use-sse', () => ({
  onSseEvent: () => () => {},
}));

import SseDiagnosticPage from './sse-diagnostic-page';

describe('SseDiagnosticPage', () => {
  it('should_RenderStatusIndicator_WhenPageMounts', () => {
    render(<SseDiagnosticPage />);
    expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('status-label')).toBeInTheDocument();
  });

  it('should_RenderClearButton_WhenPageMounts', () => {
    render(<SseDiagnosticPage />);
    expect(screen.getByTestId('clear-log-button')).toBeInTheDocument();
  });

  it('should_RenderEventLog_WhenPageMounts', () => {
    render(<SseDiagnosticPage />);
    expect(screen.getByTestId('event-log')).toBeInTheDocument();
  });

  it('should_RenderConnectionStatusCard_WhenPageMounts', () => {
    render(<SseDiagnosticPage />);
    expect(screen.getByTestId('connection-status-card')).toBeInTheDocument();
  });

  it('should_ShowEmptyState_WhenNoEventsReceived', () => {
    render(<SseDiagnosticPage />);
    expect(screen.getByText('No events received yet.')).toBeInTheDocument();
  });
});
