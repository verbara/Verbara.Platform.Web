import { Component, createRef, type ReactNode, type RefObject } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  private readonly alertRef: RefObject<HTMLDivElement | null> = createRef();

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
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
          className="flex min-h-screen flex-col items-center justify-center bg-slate-50 outline-none dark:bg-slate-900"
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-slate-500">{this.state.error?.message}</p>
          <button
            type="button"
            className="mt-4 rounded-md bg-brand px-4 py-2 text-brand-foreground hover:bg-brand-dark"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.href = '/';
            }}
          >
            Go home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
