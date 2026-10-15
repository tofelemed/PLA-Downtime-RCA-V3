import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { StatusIcon } from '@/lib/icons';
import { describeError } from './describe-error';
import type { ErrorMessage } from './error-message';
import { FieldMessageList } from './field-message-list';
import { SupportReference } from './support-reference';

export interface FriendlyErrorAlertProps {
  error: unknown;
  onRetry?: () => void;
  /** replaces the derived title, e.g. "Could not save the plan" */
  title?: string;
  /** a `messages-context.ts` map: codes worded for this kind of screen */
  context?: Readonly<Record<string, ErrorMessage>>;
  className?: string;
}

/**
 * A failed request in plain language: title, what to do, field messages, "Copy support reference" and
 * Retry. The server code sits in `data-code` for tests and telemetry only; it is never visible.
 */
export function FriendlyErrorAlert({ error, onRetry, title, context, className }: FriendlyErrorAlertProps) {
  const friendly = describeError(error, context);
  const Icon = StatusIcon.error;
  return (
    <Alert variant="destructive" className={className} data-code={friendly.reference?.code ?? undefined}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{title ?? friendly.title}</AlertTitle>
      <AlertDescription>
        <p>{friendly.message}</p>
        <FieldMessageList fieldMessages={friendly.fieldMessages} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          <SupportReference reference={friendly.reference} />
        </div>
      </AlertDescription>
    </Alert>
  );
}
