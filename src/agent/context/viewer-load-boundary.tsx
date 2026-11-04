import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureRouteError } from '@/core/observability/sentry';
import { ReadRefusal } from './read-refusal';

interface Props {
  readonly children?: ReactNode;
}

interface State {
  readonly error: Error | null;
}

/**
 * Keeps a viewer that cannot load inside its `Sheet`: a chunk gone after a deploy would otherwise reach
 * the area boundary and replace the live workspace. The message is the reads' generic one.
 */
export class ViewerLoadBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('History viewer error:', error, errorInfo);
    captureRouteError(error, errorInfo);
  }

  render() {
    return this.state.error ? <ReadRefusal error={this.state.error} /> : this.props.children;
  }
}
