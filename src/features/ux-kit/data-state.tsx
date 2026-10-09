import type { ReactNode } from 'react';
import { AlertTriangle, CloudOff, Hourglass, Inbox, Lock, PieChart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { V2ApiError } from '@/api/v2/errors';
import type { DataStateKind } from './data-state-of';

export interface DataStateProps {
  state: DataStateKind;
  /** the failed call, for its correlation id */
  error?: unknown;
  onRetry?: () => void;
  /** what is missing, e.g. "2 of 21 shifts have no actuals" */
  detail?: string;
  /** content; rendered for `ready` and, under a banner, for `incomplete` */
  children?: ReactNode;
}

const MESSAGES: Record<Exclude<DataStateKind, 'ready' | 'loading'>, { title: string; text: string; icon: typeof Inbox }> = {
  empty: { title: 'No data', text: 'Nothing matches the current scope and filters.', icon: Inbox },
  'no-permission': { title: 'No access', text: 'Your role or scope does not include this data.', icon: Lock },
  'source-offline': { title: 'Source offline', text: 'The data source is not reachable; figures may be stale.', icon: CloudOff },
  incomplete: { title: 'Incomplete data', text: 'Some inputs are missing; totals cover only what is available.', icon: PieChart },
  'calculation-pending': { title: 'Calculating', text: 'A recalculation is running; results update when it completes.', icon: Hourglass },
  error: { title: 'Could not load', text: 'The request failed.', icon: AlertTriangle },
};

function correlationOf(error: unknown): string | null {
  return error instanceof V2ApiError ? error.correlationId : null;
}

/**
 * Standard UX03 states (plan 3.1): loading skeleton, empty, no-permission, source-offline, incomplete,
 * calculation-pending and error with the correlation id support needs. Screens never invent data to
 * fill a state.
 */
export function DataState({ state, error, onRetry, detail, children }: DataStateProps) {
  if (state === 'ready') return <>{children}</>;
  if (state === 'loading') {
    return (
      <div role="status" aria-label="Loading" className="space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  const message = MESSAGES[state];
  const Icon = message.icon;
  const correlationId = state === 'error' ? correlationOf(error) : null;
  const banner = (
    <Alert variant={state === 'error' ? 'destructive' : 'default'} data-state={state}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>
        <p>{detail ?? message.text}</p>
        {correlationId && <p className="mt-1 text-xs">Reference: {correlationId}</p>}
        {onRetry && state === 'error' && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
  if (state !== 'incomplete') return banner;
  return (
    <div className="space-y-3">
      {banner}
      {children}
    </div>
  );
}
