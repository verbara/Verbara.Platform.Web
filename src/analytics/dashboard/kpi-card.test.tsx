import { render, screen } from '@testing-library/react';
import { KpiCard } from './kpi-card';

describe('KpiCard', () => {
  it('should_RenderLabelAndValueOnly_WhenNoDeltaIsSupplied', () => {
    render(<KpiCard label="Answered" value="1,204" />);

    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(screen.getByText('1,204')).toBeInTheDocument();
    // The whole delta row is gated on `delta != null`, so no comparison copy leaks in.
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('should_RenderASignedDeltaAndItsLabel_WhenDeltaIsPositive', () => {
    render(<KpiCard label="Answered" value="1,204" delta={12} deltaLabel="vs last week" />);

    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('should_RenderTheDeltaWithoutALabel_WhenDeltaLabelIsOmitted', () => {
    // `deltaLabel &&` guards its own span — a delta with no label must still render the delta.
    render(<KpiCard label="Abandoned" value="37" delta={-4} />);

    expect(screen.getByText('-4%')).toBeInTheDocument();
  });

  it('should_TreatZeroAsPositive_WhenDeltaIsExactlyZero', () => {
    // `delta >= 0` — a flat period reads as "no decline", not as a drop.
    render(<KpiCard label="SLA" value="92%" delta={0} deltaLabel="flat" />);

    expect(screen.getByText('+0%')).toBeInTheDocument();
    expect(screen.getByText('flat')).toBeInTheDocument();
  });
});
