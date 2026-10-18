import { V2ApiError } from '@/api/v2/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { describeError, FriendlyErrorAlert, isHumanMessage, refusalTitle, SupportReference } from '@/features/ux-kit/errors';
import { StatusIcon } from '@/lib/icons';

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Titles of RCA refusals in plain words (the server's reason follows): codes shared with other screens
 * would otherwise read in their accounting wording.
 */
const RCA_TITLES: Readonly<Record<string, string>> = {
  SEPARATION_OF_DUTIES: 'Someone independent of this work must do it',
  FORBIDDEN_ROLE: 'Only a manager approver can decide this',
  EVIDENCE_REQUIRED: 'Add the evidence that the action was done',
  INVALID_TRANSITION: 'This move is not possible from the current status',
  INVALID_STATUS: 'An investigation opens as Draft or In Progress',
  BASELINE_NOT_COMPUTED: 'Plan the verification first',
  NO_PENDING_CORRECTION: 'No correction is waiting for a decision',
  INVALID_POLICY: 'These settings do not fit together',
  ACTION_TASK_EXISTS: 'This action already has an open task',
  CAUSES_LOCKED: 'Causes are locked once closure is requested',
  CAUSE_CODE_RETIRED: 'This cause code is retired',
};

const titleOf = (error: V2ApiError) => RCA_TITLES[error.code] ?? refusalTitle(error.code, error.status);

/**
 * The server's own words of an RCA refusal (gate blockers, separation of duties, missing evidence), as a
 * list when it names several points. Anything else (network, 5xx, raw text) falls back to the friendly alert.
 */
function serverReasons(error: unknown): string[] | null {
  if (!(error instanceof V2ApiError) || error.status >= 500 || [401, 412, 429].includes(error.status)) return null;
  const fields = describeError(error).fieldMessages;
  const fieldTexts = error.fieldErrors.flatMap((entry, index) => {
    if (fields[index]?.unexpected) return [`${fields[index].label}: ${fields[index].message}`];
    return isHumanMessage(entry.message, error.code) ? [entry.message] : [];
  });
  if (fieldTexts.length > 0) return fieldTexts.map(sentence);
  return isHumanMessage(error.message, error.code) ? [sentence(error.message)] : null;
}

/** A refused RCA command in the server's words, with the support reference. */
export function RcaErrorAlert({ error }: { error: unknown }) {
  const reasons = serverReasons(error);
  if (!reasons || !(error instanceof V2ApiError)) return <FriendlyErrorAlert error={error} />;
  const Icon = StatusIcon.error;
  return (
    <Alert variant="destructive" data-code={error.code} data-testid="rca-refusal">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{titleOf(error)}</AlertTitle>
      <AlertDescription>
        {reasons.length === 1 ? (
          <p>{reasons[0]}</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <SupportReference reference={describeError(error).reference} />
        </div>
      </AlertDescription>
    </Alert>
  );
}
