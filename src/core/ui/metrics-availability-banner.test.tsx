import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetricsAvailabilityBanner } from './metrics-availability-banner';

// Stub react-i18next so the component renders without the HTTP backend.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const table: Record<string, string> = {
        'wallboard.metrics_unavailable':
          'Live metrics unavailable — historical data may be stale.',
      };
      return table[key] ?? key;
    },
  }),
}));

describe('MetricsAvailabilityBanner', () => {
  it('Renders_Banner_When_NotAvailable', () => {
    render(<MetricsAvailabilityBanner isAvailable={false} />);
    expect(screen.getByTestId('metrics-availability-banner')).toBeInTheDocument();
    expect(
      screen.getByText('Live metrics unavailable — historical data may be stale.'),
    ).toBeInTheDocument();
  });

  it('RendersNothing_When_Available', () => {
    const { container } = render(<MetricsAvailabilityBanner isAvailable={true} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('metrics-availability-banner')).not.toBeInTheDocument();
  });

  it('Renders_Role_Status_For_Accessibility', () => {
    render(<MetricsAvailabilityBanner isAvailable={false} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
