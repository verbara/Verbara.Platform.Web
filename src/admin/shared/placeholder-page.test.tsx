import { render, screen } from '@testing-library/react';
import { PlaceholderPage } from './placeholder-page';

describe('PlaceholderPage', () => {
  it('should_RenderTheTitleAndTheFeatureIdentifier_WhenMounted', () => {
    render(<PlaceholderPage title="Speech analytics" featureName="analytics.speech" />);

    expect(screen.getByTestId('placeholder-page')).toBeInTheDocument();
    expect(screen.getByText('Speech analytics')).toBeInTheDocument();
    // The feature id is the point of the stub: it is what release QA greps for.
    expect(screen.getByText('analytics.speech')).toBeInTheDocument();
  });

  it('should_RenderTheDescription_WhenOneIsSupplied', () => {
    render(
      <PlaceholderPage
        title="Speech analytics"
        featureName="analytics.speech"
        description="Lands in a later phase."
      />,
    );

    expect(screen.getByText('Lands in a later phase.')).toBeInTheDocument();
  });
});
