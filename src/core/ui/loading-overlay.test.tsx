import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlay } from './loading-overlay';

describe('LoadingOverlay', () => {
  it('Renders_ChildrenOnly_WhenInactive', () => {
    render(
      <LoadingOverlay active={false}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
  });

  it('Renders_ChildrenAndOverlay_WhenActive', () => {
    render(
      <LoadingOverlay active={true}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
  });

  it('Overlay_HasAriaLabel_ForAccessibility', () => {
    render(
      <LoadingOverlay active={true}>
        <p>content</p>
      </LoadingOverlay>,
    );
    const overlay = screen.getByTestId('loading-overlay');
    expect(overlay.getAttribute('role')).toBe('status');
    expect(overlay.getAttribute('aria-label')).toBe('Loading');
    expect(overlay.getAttribute('aria-busy')).toBe('true');
  });

  it('Wraps_InRelativeContainer_WhenActive', () => {
    render(
      <LoadingOverlay active={true}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    const wrapper = screen.getByTestId('child').parentElement;
    expect(wrapper?.className).toContain('relative');
  });

  it('NoWrapper_WhenInactive', () => {
    const { container } = render(
      <LoadingOverlay active={false}>
        <p data-testid="child">content</p>
      </LoadingOverlay>,
    );
    // The <p> should be a direct child — no wrapping div
    expect(container.firstChild?.nodeName).toBe('P');
  });
});
