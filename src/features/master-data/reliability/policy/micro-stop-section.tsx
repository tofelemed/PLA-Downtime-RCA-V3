import { policyNoteText } from '@/features/ux-kit/format/built-in-default';
import { useMicroStopPolicy } from '@/api/v2/queries/reliability-policies';
import type { MicroStopPolicyView } from '@/api/v2/types/reliability';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { MicroStopForm } from './micro-stop-form';
import { policyVersionLine } from './policy-version-line';

function CurrentSettings({ view, unitId, format }: { view: MicroStopPolicyView; unitId: string; format: ReliabilityFormat }) {
  const classes = Object.entries(view.microStopSecondsByAssetClass);
  return (
    <dl className="grid grid-cols-[14rem_1fr] gap-x-3 gap-y-1 text-sm" data-testid="micro-stop-current">
      <dt className="text-muted-foreground">In force</dt>
      <dd>{policyVersionLine(view, unitId, format)}</dd>
      <dt className="text-muted-foreground">Threshold</dt>
      <dd>{format.duration(view.microStopSeconds)}</dd>
      <dt className="text-muted-foreground">Per asset class</dt>
      <dd>{classes.length ? classes.map(([c, s]) => `${c}: ${format.duration(s)}`).join(' · ') : 'None (the threshold applies to every asset)'}</dd>
      <dt className="text-muted-foreground">Trip reasons</dt>
      <dd>{view.tripReasonCodes.length ? view.tripReasonCodes.join(', ') : 'None'}</dd>
      {view.notes && <><dt className="text-muted-foreground">Notes</dt><dd>{policyNoteText(view.notes)}</dd></>}
    </dl>
  );
}

/** SME D6: the micro-stop settings in force for the scope, and (manager approvers) a new version. */
export function MicroStopSection({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const policy = useMicroStopPolicy(unitId);
  return (
    <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()}>
      {policy.data && (
        <div className="space-y-4">
          <CurrentSettings view={policy.data} unitId={unitId} format={format} />
          {canWrite && <MicroStopForm key={`${unitId}-${policy.data.id}`} unitId={unitId} current={policy.data} />}
        </div>
      )}
    </DataState>
  );
}
