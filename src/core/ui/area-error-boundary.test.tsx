import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { AreaErrorBoundary } from './area-error-boundary';

// Stub the i18n module — `i18n.t()` is called directly (boundaries are class
// components, can't use the `useTranslation` hook).
vi.mock('@/core/i18n/i18n', () => ({
  default: {
    t: (key: string, opts?: { areaName?: string; defaultValue?: string }) => {
      const table: Record<string, string> = {
        'common:errors.area_error_title': 'Something went wrong in this section',
        'common:errors.area_error_message':
          'The {{areaName}} module failed to load. The rest of the app is still available.',
        'common:errors.try_again': 'Try Again',
        'common:errors.go_home': 'Go to Home',
        'common:errors.area_names.admin': 'Administration',
        'common:errors.area_names.agent': 'Agent Workspace',
      };
      let value = table[key] ?? opts?.defaultValue ?? key;
      if (opts?.areaName) value = value.replace('{{areaName}}', opts.areaName);
      return value;
    },
  },
}));

function Bomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div data-testid="bomb-defused">defused</div>;
}

describe('AreaErrorBoundary', () => {
  // React logs caught errors via console.error — silence during these tests
  // to keep the test output readable. Verified via spy that the log fired.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('Renders_Children_When_NoError', () => {
    render(
      <AreaErrorBoundary areaName="admin">
        <div data-testid="happy-child">child rendered</div>
      </AreaErrorBoundary>,
    );
    expect(screen.getByTestId('happy-child')).toBeInTheDocument();
    expect(screen.queryByTestId('area-error-boundary-admin')).not.toBeInTheDocument();
  });

  it('Renders_FallbackUi_When_ChildThrows', () => {
    render(
      <AreaErrorBoundary areaName="admin">
        <Bomb />
      </AreaErrorBoundary>,
    );
    expect(screen.getByTestId('area-error-boundary-admin')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong in this section')).toBeInTheDocument();
    expect(
      screen.getByText(
        /The Administration module failed to load\. The rest of the app is still available\./,
      ),
    ).toBeInTheDocument();
    // Original error message bubbles into the small detail line
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('Localizes_AreaName_From_Translations', () => {
    render(
      <AreaErrorBoundary areaName="agent">
        <Bomb />
      </AreaErrorBoundary>,
    );
    expect(screen.getByTestId('area-error-boundary-agent')).toBeInTheDocument();
    // "Agent Workspace" comes from the area_names table, not the raw "agent"
    expect(
      screen.getByText(/The Agent Workspace module failed to load/),
    ).toBeInTheDocument();
  });

  it('Falls_Back_To_RawAreaName_When_TranslationMissing', () => {
    render(
      <AreaErrorBoundary areaName="custom-area">
        <Bomb />
      </AreaErrorBoundary>,
    );
    // No mapping for "custom-area" → defaultValue is the raw areaName
    expect(
      screen.getByText(/The custom-area module failed to load/),
    ).toBeInTheDocument();
  });

  it('TryAgainButton_ResetsErrorState', () => {
    let shouldThrow = true;
    function ConditionalBomb() {
      if (shouldThrow) throw new Error('boom');
      return <div data-testid="recovered">recovered</div>;
    }

    render(
      <AreaErrorBoundary areaName="admin">
        <ConditionalBomb />
      </AreaErrorBoundary>,
    );

    expect(screen.getByTestId('area-error-boundary-admin')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByTestId('area-error-retry-admin'));
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.queryByTestId('area-error-boundary-admin')).not.toBeInTheDocument();
  });

  it('LogsToConsoleError_When_ChildThrows', () => {
    consoleErrorSpy.mockClear();
    render(
      <AreaErrorBoundary areaName="admin">
        <Bomb />
      </AreaErrorBoundary>,
    );
    // componentDidCatch logs `Area error [admin]: ...`
    const adminCalls = consoleErrorSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].startsWith('Area error [admin]:'),
    );
    expect(adminCalls.length).toBeGreaterThan(0);
  });
});
