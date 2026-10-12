import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { describeError, FieldMessageList, SupportReference } from '@/features/ux-kit/errors';
import { StatusIcon } from '@/lib/icons';
import { adminRefusalOf } from '../model/admin-refusal';

export interface AdminRefusalAlertProps {
  error: unknown;
  /** false where the field errors are already shown on their rows (the rule builder) */
  withFields?: boolean;
}

/**
 * A refused code or rule command in plain language: what happened, what to do, what still points at a
 * code (409 CODE_HAS_CHILDREN). The server code and status stay in `data-*` attributes for tests; the
 * correlation id sits behind "Copy support reference".
 */
export function AdminRefusalAlert({ error, withFields = true }: AdminRefusalAlertProps) {
  const refusal = adminRefusalOf(error);
  if (!refusal) return null;
  const friendly = describeError(error);
  const locked = refusal.kind === 'role' || refusal.kind === 'tenant-scope' || refusal.kind === 'duties';
  const Icon = locked ? StatusIcon.locked : StatusIcon.warning;
  const counts = refusal.references;
  return (
    <Alert variant="destructive" role="alert" data-testid="admin-refusal" data-kind={refusal.kind} data-code={refusal.code} data-status={refusal.status ?? ''}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{friendly.title}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{friendly.message}</p>
        {counts && (
          <p className="text-sm" data-testid="refusal-references">
            Still used by {counts.activeChildren} active sub-code(s), {counts.events} event(s) and {counts.mappingRules} default mapping version(s).
          </p>
        )}
        {withFields && <FieldMessageList fieldMessages={friendly.fieldMessages} />}
        <SupportReference reference={friendly.reference} />
      </AlertDescription>
    </Alert>
  );
}
