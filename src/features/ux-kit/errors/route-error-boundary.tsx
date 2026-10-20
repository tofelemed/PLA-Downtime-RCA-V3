import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@/lib/logger';
import { isAuthFailure } from './auth-failure';
import { RouteErrorFallback } from './route-error-fallback';

const log = createLogger('route-error-boundary');

export interface RouteErrorBoundaryProps {
  children: ReactNode;
  /** a change (the route's pathname) clears a shown error, so navigating away recovers */
  resetKey: string;
  onReload?: () => void;
  /** a 401 while rendering: end the session (the login screen follows) instead of the error page */
  onAuthFailure?: () => void;
  /** full-screen fallback (app-level boundary) instead of a block inside the shell */
  fullPage?: boolean;
  /** how "Go to dashboard" navigates: router link (default) or a plain link above the router */
  navigation?: 'router' | 'document';
}

interface State {
  error: unknown;
  hasError: boolean;
}

/**
 * Error boundary for rendered pages. The app shell mounts it around the routed page (header and menu keep
 * working); the app mounts full-page ones around the routes and around the providers, so nothing renders a
 * blank screen. A page that throws while rendering (or whose chunk fails to load) shows
 * `RouteErrorFallback`; an authentication failure (401) ends the session instead. Navigating to another
 * route resets it.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (isAuthFailure(error) && this.props.onAuthFailure) {
      log.warn('The session ended while a page was rendering; signing out');
      this.props.onAuthFailure();
      return;
    }
    log.error('A page failed to render', { error, componentStack: info.componentStack });
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps): void {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null, hasError: false });
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (isAuthFailure(this.state.error) && this.props.onAuthFailure) return null;
    const { onReload, fullPage, navigation } = this.props;
    return <RouteErrorFallback error={this.state.error} onReload={onReload} fullPage={fullPage} navigation={navigation} />;
  }
}
