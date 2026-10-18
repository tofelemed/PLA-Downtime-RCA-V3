import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { describeError } from './describe-error';

export interface InlineErrorProps {
  error: unknown;
  /** what failed, e.g. "Could not load units" (default: the plain title of the error) */
  title?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * One-line failure for small spaces (a popover, a tree node, a table cell): the plain title and a Retry
 * link button, so a failed load never looks like "nothing there". Larger areas use `DataState` or
 * `FriendlyErrorAlert`.
 */
export function InlineError({ error, title, onRetry, className }: InlineErrorProps) {
  const friendly = describeError(error);
  return (
    <span role="alert" className={cn('inline-flex flex-wrap items-center gap-x-2 text-xs text-destructive', className)} data-code={friendly.reference?.code ?? undefined}>
      <span>{title ?? friendly.title}</span>
      {onRetry && (
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
          Retry
        </Button>
      )}
    </span>
  );
}
