import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@/lib/logger';
import { RouteErrorFallback } from './route-error-fallback';

const log = createLogger('route-error-boundary');

export interface RouteErrorBoundaryProps {
  children: ReactNode;
  /** a change (the route's pathname) clears a shown error, so navigating away recovers */
  resetKey: string;
  onReload?: () => void;
}

interface State {
  error: unknown;
  hasError: boolean;
}

/**
 * Route-level error boundary, mounted by the app shell around the routed page: a page that throws while
 * rendering (or whose chunk fails to load) shows `RouteErrorFallback` in place of the page while the
 * header and menu keep working. Navigating to another route resets it.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    log.error('A page failed to render', { error, componentStack: info.componentStack });
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps): void {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null, hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) return <RouteErrorFallback error={this.state.error} onReload={this.props.onReload} />;
    return this.props.children;
  }
}
