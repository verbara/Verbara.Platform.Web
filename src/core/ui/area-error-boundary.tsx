import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/core/i18n/i18n';
import { captureAreaError } from '@/core/observability/sentry';
import { Button } from '@/core/ui/button';

interface Props {
  /** Translation key suffix for area name (e.g. `admin`, `agent`, `analytics`, `operations`). */
  areaName: string;
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-area error boundary. Wraps each layout shell so a crash in one area
 * (e.g. /admin/cluster) does NOT tumble the whole app — other areas keep
 * working. Distinct from `RouteErrorBoundary`, which is the route-level
 * fallback wired via `errorElement`.
 */
export class AreaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Area error [${this.props.areaName}]:`, error, errorInfo);
    captureAreaError(error, this.props.areaName, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const areaLabel = i18n.t(`common:errors.area_names.${this.props.areaName}`, {
        defaultValue: this.props.areaName,
      });
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-4 p-8"
          data-testid={`area-error-boundary-${this.props.areaName}`}
        >
          <h2 className="text-lg font-semibold">{i18n.t('common:errors.area_error_title')}</h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {i18n.t('common:errors.area_error_message', { areaName: areaLabel })}
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-muted-foreground/80">{this.state.error.message}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              data-testid={`area-error-retry-${this.props.areaName}`}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              {i18n.t('common:errors.try_again')}
            </Button>
            <Button
              variant="ghost"
              data-testid={`area-error-home-${this.props.areaName}`}
              onClick={() => (window.location.href = '/')}
            >
              {i18n.t('common:errors.go_home')}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
