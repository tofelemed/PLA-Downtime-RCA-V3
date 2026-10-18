import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { describeError, FieldMessageList, SupportReference, type FieldVocabulary } from '@/features/ux-kit/errors';
import { StatusIcon } from '@/lib/icons';
import { financeRefusalKind, overlapConflicts } from '../model/finance-refusal';

/**
 * A refused finance command in plain language: what happened and what to do, the approved versions an
 * approval overlaps, the refused fields by name (also shown on their inputs by the forms; a field the form
 * does not render, such as an unexpected property, is only here) and "Copy support reference". `fields` is
 * the form's vocabulary, so a refused field reads with the form's own label and choice names.
 */
export function FinanceRefusalAlert({ error, fields }: { error: unknown; fields?: FieldVocabulary }) {
  const dates = usePlantDates();
  if (!error) return null;
  const friendly = describeError(error, undefined, fields);
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
        <FieldMessageList fieldMessages={friendly.fieldMessages} />
        <SupportReference reference={friendly.reference} />
      </AlertDescription>
    </Alert>
  );
}
