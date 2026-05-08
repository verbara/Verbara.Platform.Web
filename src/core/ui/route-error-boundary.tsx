import { Component, createRef, type ErrorInfo, type ReactNode, type RefObject } from 'react';
import i18n from '@/core/i18n/i18n';
import { captureRouteError } from '@/core/observability/sentry';
import { Button } from '@/core/ui/button';

interface Props {
  readonly children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  private readonly alertRef: RefObject<HTMLDivElement | null> = createRef();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route error:', error, errorInfo);
    captureRouteError(error, errorInfo);
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.alertRef.current?.focus();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          ref={this.alertRef}
          role="alert"
          tabIndex={-1}
          className="flex h-full flex-col items-center justify-center gap-4 p-8 outline-none"
          data-testid="route-error-boundary"
        >
          <h2 className="text-lg font-semibold">{i18n.t('common:errors.route_error_title')}</h2>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message ?? i18n.t('common:errors.route_error_fallback')}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              data-testid="route-error-retry"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              {i18n.t('common:errors.try_again')}
            </Button>
            <Button
              variant="ghost"
              data-testid="route-error-home"
              onClick={() => (window.location.href = '/admin')}
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
