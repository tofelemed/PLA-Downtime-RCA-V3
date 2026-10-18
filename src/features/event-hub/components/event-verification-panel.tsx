import { useMemo } from 'react';
import { useValidateFailure, useVerifyStops } from '@/api/v2/queries/stop-verification';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { VerificationOutcomeView } from '@/api/v2/types/stop-coding';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { actorText } from '@/features/ux-kit/labels/actor-labels';
import { useUserNames } from '@/features/ux-kit/labels/use-user-names';
import { usePlantFormat } from '../hooks/use-plant-format';

/** Why the server skipped the stop, in words (the codes of `POST …/verification` / `…/validate-failure`). */
const SKIP_TEXT: Readonly<Record<string, string>> = {
  NOT_CODED: 'it has neither a reason nor “investigation pending”',
  OWN_CODING: 'you entered its current coding — another supervisor verifies it',
  NOT_AUTHORIZED: 'you do not hold the role for this unit',
  NOT_VERIFIED: 'the supervisor has not verified the coding yet',
  NO_FAILURE_DETAIL: 'it has no failure detail',
  ALREADY_VERIFIED: 'it is already verified',
  ALREADY_VALIDATED: 'it is already validated',
};

const hasFailureDetail = (event: ProductionEventView) => Boolean(event.failure && Object.values(event.failure).some((value) => value !== null));

function Skipped({ outcome }: { outcome: VerificationOutcomeView | undefined }) {
  const reason = outcome?.skipped[0]?.reason;
  if (!reason) return null;
  return <p data-testid="verification-skipped">Not recorded: {SKIP_TEXT[reason] ?? reason}.</p>;
}

/**
 * SME D13 staged verification of one stop: who verified the coding and validated the failure detail (and
 * when, in plant time), with the supervisor's and maintenance's commands. The server decides who may; a
 * later change of the coding clears the label. Recording is never blocked.
 */
export function EventVerificationPanel({ event }: { event: ProductionEventView }) {
  const { canVerifyStops, canValidateFailures } = useCapabilities();
  const { dateTime } = usePlantFormat();
  const verification = event.verification;
  const ids = useMemo(() => [verification?.verifiedBy, verification?.validatedBy], [verification]);
  const users = useUserNames(ids);
  const verify = useVerifyStops();
  const validate = useValidateFailure();
  if (event.classification.physicalType !== 'downtime' || !verification) return null;
  const coded = Boolean(event.reasonCodeId) || event.investigationPending === true;
  return (
    <div className="space-y-2 text-sm" data-testid="event-verification">
      {event.investigationPending && <p data-testid="investigation-pending">Investigation pending — no specific reason yet.</p>}
      <p>
        Coding:{' '}
        {verification.verifiedAt ? `verified by ${actorText({ id: verification.verifiedBy }, users.nameOf)}, ${dateTime(verification.verifiedAt)}` : coded ? 'not verified yet' : 'not coded yet'}
      </p>
      {hasFailureDetail(event) && (
        <p>
          Failure detail:{' '}
          {verification.validatedAt ? `validated by ${actorText({ id: verification.validatedBy }, users.nameOf)}, ${dateTime(verification.validatedAt)}` : 'not validated by maintenance yet'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canVerifyStops && coded && !verification.verifiedAt && (
          <Button size="sm" variant="outline" data-testid="verify-stop" disabled={verify.isPending} onClick={() => void verify.submit({ eventIds: [event.id] }).catch(() => undefined)}>
            Verify coding
          </Button>
        )}
        {canValidateFailures && hasFailureDetail(event) && verification.verifiedAt && !verification.validatedAt && (
          <Button size="sm" variant="outline" data-testid="validate-failure" disabled={validate.isPending} onClick={() => void validate.submit({ eventId: event.id }).catch(() => undefined)}>
            Validate failure detail
          </Button>
        )}
      </div>
      <Skipped outcome={verify.data ?? validate.data} />
      {verify.error || validate.error ? <FriendlyErrorAlert error={verify.error ?? validate.error} /> : null}
    </div>
  );
}
