import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { StatCard } from '@/core/ui/stat-card';

describe('StatCard', () => {
  it('Render_ShouldDisplayLabelAndValue_WhenValueIsNumberOrReactNode', () => {
    // Numeric value — StatCard must coerce to rendered text.
    const { rerender } = render(<StatCard label="Active Sessions" value={42} />);
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();

    // ReactNode value — consumers often wrap numbers with units or badges.
    rerender(
      <StatCard
        label="Throughput"
        value={<span data-testid="custom-value">128 msg/s</span>}
      />
    );
    expect(screen.getByText('Throughput')).toBeInTheDocument();
    const customValue = screen.getByTestId('custom-value');
    expect(customValue).toBeInTheDocument();
    expect(customValue.textContent).toBe('128 msg/s');
  });

  it('Trend_ShouldRenderCorrectIconAndColor_ForEachDirection', () => {
    // up — green TrendingUp
    const { container: upContainer, rerender } = render(
      <StatCard
        label="CSAT"
        value="4.6"
        trend={{ direction: 'up', value: '+0.2' }}
      />
    );
    const upSvg = upContainer.querySelector('svg.lucide-trending-up');
    expect(upSvg).not.toBeNull();
    const upWrapper = upContainer.querySelector('[data-testid="stat-card-trend"]');
    expect(upWrapper).not.toBeNull();
    expect(upWrapper!.className).toMatch(/text-green-600/);
    expect(screen.getByText('+0.2')).toBeInTheDocument();

    // down — red TrendingDown
    rerender(
      <StatCard
        label="CSAT"
        value="4.6"
        trend={{ direction: 'down', value: '-0.1' }}
      />
    );
    const downSvg = upContainer.querySelector('svg.lucide-trending-down');
    expect(downSvg).not.toBeNull();
    const downWrapper = upContainer.querySelector('[data-testid="stat-card-trend"]');
    expect(downWrapper!.className).toMatch(/text-red-600/);
    expect(screen.getByText('-0.1')).toBeInTheDocument();

    // flat — gray Minus
    rerender(
      <StatCard
        label="CSAT"
        value="4.6"
        trend={{ direction: 'flat', value: '0' }}
      />
    );
    const flatSvg = upContainer.querySelector('svg.lucide-minus');
    expect(flatSvg).not.toBeNull();
    const flatWrapper = upContainer.querySelector('[data-testid="stat-card-trend"]');
    expect(flatWrapper!.className).toMatch(/text-gray-500/);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('OnClick_ShouldFire_WhenCardClicked', () => {
    const onClick = vi.fn();
    render(<StatCard label="License" value="Active" onClick={onClick} />);

    // Clickable cards expose role=button for assistive-tech navigation.
    const card = screen.getByRole('button', { name: /license/i });
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Keyboard_ShouldTriggerOnClick_WhenEnterOrSpacePressed', () => {
    const onClick = vi.fn();
    render(<StatCard label="License" value="Active" onClick={onClick} />);
    const card = screen.getByRole('button', { name: /license/i });

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);

    // Other keys should not fire onClick.
    fireEvent.keyDown(card, { key: 'Tab' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
