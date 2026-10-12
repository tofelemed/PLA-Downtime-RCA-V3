import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { describeError, SupportReference } from '@/features/ux-kit/errors';
import { StatusIcon } from '@/lib/icons';
import { financeRefusalKind, overlapConflicts } from '../model/finance-refusal';

/**
 * A refused finance command in plain language: what happened and what to do, the approved versions an
 * approval overlaps, and "Copy support reference". Field errors are shown on their inputs by the forms.
 */
export function FinanceRefusalAlert({ error }: { error: unknown }) {
  const dates = usePlantDates();
  if (!error) return null;
  const friendly = describeError(error);
  const kind = financeRefusalKind(error);
  const conflicts = overlapConflicts(error);
  const Icon = kind === 'role' || kind === 'scope' || kind === 'duties' ? StatusIcon.locked : StatusIcon.warning;
  return (
    <Alert variant="destructive" role="alert" data-testid="refusal" data-kind={kind} data-code={friendly.reference?.code ?? ''}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{friendly.title}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{friendly.message}</p>
        {conflicts.length > 0 && (
          <ul className="list-disc pl-5 text-sm" data-testid="refusal-conflicts">
            {conflicts.map((conflict) => (
              <li key={conflict.key} data-testid="refusal-conflict">
                {conflict.version === null ? 'An approved version' : `Version ${conflict.version}`}: {dates.validity(conflict.from, conflict.to)}
              </li>
            ))}
          </ul>
        )}
        <SupportReference reference={friendly.reference} />
      </AlertDescription>
    </Alert>
  );
}
