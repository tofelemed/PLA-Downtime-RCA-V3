import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { V2ApiError } from '@/api/v2/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusIcon, type AppIcon } from '@/lib/icons';
import type { DataStateKind } from './data-state-of';
import { EmptyMessage } from './data-table/data-table-states';
import { REPORT_EMPTY, useReportLook } from './report-look/use-report-look';
import { describeError, type FriendlyError } from './errors/describe-error';
import { FieldMessageList } from './errors/field-message-list';
import { SupportReference } from './errors/support-reference';

export interface DataStateProps {
  state: DataStateKind;
  /** the failed call: described in plain language, its code and correlation id behind "Copy support reference" */
  error?: unknown;
  onRetry?: () => void;
  /** what is missing, e.g. "2 of 21 shifts have no actuals" */
  detail?: string;
  /** content; rendered for `ready` and, under a banner, for `incomplete` */
  children?: ReactNode;
  /** the list the record belongs to: a 404 offers "Back to <label>" instead of Retry (QA_SHELL) */
  back?: { to: string; label: string };
}

const isNotFound = (error: unknown) => error instanceof V2ApiError && error.status === 404;

function ErrorActions({ onRetry, back, notFound }: { onRetry?: () => void; back?: DataStateProps['back']; notFound: boolean }) {
  if (notFound && back) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to={back.to}>Back to {back.label}</Link>
      </Button>
    );
  }
  if (!onRetry) return null;
  return (
    <Button variant="outline" size="sm" onClick={onRetry}>
      Retry
    </Button>
  );
}

const MESSAGES: Record<Exclude<DataStateKind, 'ready' | 'loading'>, { title: string; text: string; icon: AppIcon }> = {
  empty: { title: 'No data', text: 'Nothing matches the current scope and filters.', icon: StatusIcon.empty },
  'no-permission': { title: 'No access', text: 'Your role or scope does not include this data.', icon: StatusIcon.locked },
  'source-offline': { title: 'Source offline', text: 'The data source is not reachable; figures may be stale.', icon: StatusIcon.offline },
  incomplete: { title: 'Incomplete data', text: 'Some inputs are missing; totals cover only what is available.', icon: StatusIcon.warning },
  'calculation-pending': { title: 'Calculating', text: 'A recalculation is running; results update when it completes.', icon: StatusIcon.pending },
  error: { title: 'Could not load', text: 'The request failed.', icon: StatusIcon.error },
};

/** The plain description of a failed call; null when nothing is known about it (generic text then). */
function friendlyOf(state: DataStateKind, error: unknown): FriendlyError | null {
  if (state !== 'error' || error === undefined || error === null) return null;
  const friendly = describeError(error);
  return friendly.reference || error instanceof TypeError ? friendly : null;
}

function LoadingState() {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function ReportEmpty() {
  return (
    <div className="py-10">
      <EmptyMessage empty={REPORT_EMPTY} />
    </div>
  );
}

/**
 * Standard UX03 states (plan 3.1): loading skeleton, empty, no-permission, source-offline, incomplete,
 * calculation-pending and error. An error reads in plain language (`describeError`); its code stays in
 * `data-code` and, with the correlation id, behind "Copy support reference". Screens never invent data. On the
 * Reports page (`ReportLookContext`) "empty" is the centred "No data for these dates" whatever the detail.
 */
export function DataState(props: DataStateProps) {
  const report = useReportLook() !== null;
  // the Reports page: one centred empty state for every report card (redesign 24 Oct 2026)
  if (props.state === 'empty' && report) return <ReportEmpty />;
  return <StandardDataState {...props} />;
}

function StandardDataState({ state, error, onRetry, detail, children, back }: DataStateProps) {
  if (state === 'ready') return <>{children}</>;
  if (state === 'loading') return <LoadingState />;
  const message = MESSAGES[state];
  const Icon = message.icon;
  const friendly = friendlyOf(state, error);
  const notFound = Boolean(back) && isNotFound(error);
  const banner = (
    <Alert variant={state === 'error' ? 'destructive' : 'default'} data-state={state} data-code={friendly?.reference?.code ?? undefined}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{friendly?.title ?? message.title}</AlertTitle>
      <AlertDescription>
        <p>{notFound ? 'It may have been deleted or moved.' : friendly?.message ?? detail ?? message.text}</p>
        {friendly && <FieldMessageList fieldMessages={friendly.fieldMessages} />}
        {state === 'error' && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ErrorActions onRetry={onRetry} back={back} notFound={notFound} />
            <SupportReference reference={friendly?.reference} />
          </div>
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
