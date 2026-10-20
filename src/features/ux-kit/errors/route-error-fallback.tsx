import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { isChunkLoadError } from './chunk-load-error';
import { describeError } from './describe-error';
import { ErrorDevDetails } from './error-dev-details';
import { SupportReference } from './support-reference';

export interface RouteErrorFallbackProps {
  error: unknown;
  /** full page reload (default `window.location.reload()`) */
  onReload?: () => void;
  /** a full-screen page (the app-level boundary) instead of a block inside the app shell */
  fullPage?: boolean;
  /**
   * `router` (default): "Go to dashboard" is a router link. `document`: a plain link, for the outermost
   * boundary that sits above the router (a crash there may have taken the router down with it).
   */
  navigation?: 'router' | 'document';
}

const DASHBOARD = '/dashboard';
const reloadPage = () => window.location.reload();

const TEXT = {
  chunk: {
    title: 'This page needs to refresh',
    text: 'The app was updated or the connection dropped while the page was loading. Refresh to continue.',
  },
  crash: {
    title: 'Something went wrong',
    text: 'This page could not be displayed. Refresh it, or go to the dashboard. If it keeps happening, contact support.',
  },
} as const;

function DashboardLink({ navigation }: { navigation: 'router' | 'document' }) {
  return (
    <Button asChild type="button" variant="outline" size="sm">
      {navigation === 'router' ? <Link to={DASHBOARD}>Go to dashboard</Link> : <a href={DASHBOARD}>Go to dashboard</a>}
    </Button>
  );
}

/**
 * What a crash shows: a plain explanation, "Refresh" and "Go to dashboard", and "Copy support reference"
 * when the failure came from a request — never the technical message (that appears in development builds
 * only). Inside the app shell the header and menu stay usable; `fullPage` covers the whole screen. A
 * chunk-load failure (new deployment, dropped connection) asks for a refresh instead.
 */
export function RouteErrorFallback({ error, onReload = reloadPage, fullPage = false, navigation = 'router' }: RouteErrorFallbackProps) {
  const text = isChunkLoadError(error) ? TEXT.chunk : TEXT.crash;
  const reference = describeError(error).reference;
  const Icon = StatusIcon.error;
  const RefreshIcon = ActionIcon.refresh;
  return (
    <div
      className={cn(fullPage ? 'flex min-h-screen items-center justify-center bg-background p-4' : 'mx-auto max-w-2xl py-8')}
      data-testid="route-error"
    >
      <Alert variant="destructive" role="alert" className={cn(fullPage && 'max-w-xl')}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{text.title}</AlertTitle>
        <AlertDescription>
          <p>{text.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onReload}>
              <RefreshIcon aria-hidden="true" />
              Refresh
            </Button>
            <DashboardLink navigation={navigation} />
            <SupportReference reference={reference} />
          </div>
          <ErrorDevDetails error={error} />
        </AlertDescription>
      </Alert>
    </div>
  );
}
