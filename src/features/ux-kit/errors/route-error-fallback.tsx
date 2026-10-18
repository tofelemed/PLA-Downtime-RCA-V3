import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { isChunkLoadError } from './chunk-load-error';
import { describeError } from './describe-error';
import { SupportReference } from './support-reference';

export interface RouteErrorFallbackProps {
  error: unknown;
  /** full page reload (default `window.location.reload()`) */
  onReload?: () => void;
}

const reloadPage = () => window.location.reload();

const TEXT = {
  chunk: {
    title: 'This page needs to reload',
    text: 'The app was updated or the connection dropped while the page was loading. Reload to continue.',
  },
  crash: {
    title: 'This page could not be displayed',
    text: 'Something went wrong on this page. Reload it, or go to the dashboard. If it keeps happening, contact support.',
  },
} as const;

/**
 * What a crashed page shows inside the app shell (header and menu stay usable): a plain explanation,
 * "Reload" and "Go to dashboard", and "Copy support reference" when the failure came from a request.
 * A chunk-load failure (new deployment, dropped connection) asks for a reload instead.
 */
export function RouteErrorFallback({ error, onReload = reloadPage }: RouteErrorFallbackProps) {
  const text = isChunkLoadError(error) ? TEXT.chunk : TEXT.crash;
  const reference = describeError(error).reference;
  const Icon = StatusIcon.error;
  const ReloadIcon = ActionIcon.refresh;
  return (
    <div className="mx-auto max-w-2xl py-8" data-testid="route-error">
      <Alert variant="destructive" role="alert">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{text.title}</AlertTitle>
        <AlertDescription>
          <p>{text.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onReload}>
              <ReloadIcon aria-hidden="true" />
              Reload
            </Button>
            <Button asChild type="button" variant="outline" size="sm">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
            <SupportReference reference={reference} />
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
