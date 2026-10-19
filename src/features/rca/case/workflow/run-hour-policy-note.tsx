import { useRcaActions } from '@/api/v2/queries/rca-cases';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { useCurrentRcaPolicy } from '@/features/event-hub/rca-policy/rca-policy-api';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { runHourPolicyNote } from '../../model/policy-drift';

/** QA M7: under the residual risk, when the current RCA policy's run-hour minimum differs from the frozen one. */
export function RunHourPolicyNote({ rca }: { rca: RcaCaseView }) {
  const actions = useRcaActions(rca.id);
  const current = useCurrentRcaPolicy(rca.unitId);
  const { number } = useNumberFormat();
  const note = runHourPolicyNote(actions.data ?? [], current.data, number);
  if (!note) return null;
  return (
    <span className="mt-1 block text-xs text-muted-foreground" data-testid="run-hour-policy-note">
      {note}
    </span>
  );
}
