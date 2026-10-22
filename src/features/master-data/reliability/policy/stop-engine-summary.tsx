import type { StopEnginePolicy } from '@/api/v2/types/stop-policy';
import { EffectiveFrom } from '@/features/ux-kit/effective-from';
import { policyNoteText } from '@/features/ux-kit/format/built-in-default';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { PolicySummary, type PolicySummaryRow } from './policy-summary';

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

function rowsOf(policy: StopEnginePolicy, format: ReliabilityFormat): PolicySummaryRow[] {
  const note = policyNoteText(policy.notes);
  const inForce = (
    <>
      Version {format.number(policy.version)} ({policy.unitId ? 'unit override' : 'plant-wide'}) · <EffectiveFrom iso={policy.effectiveFrom} tz={format.timezone} prefix="since" />
    </>
  );
  return [
    { label: 'In force', value: inForce },
    { label: 'Derive stops from unit state', value: yesNo(policy.deriveFromState) },
    { label: 'Stop debounce', value: format.duration(policy.debounceSeconds) },
    { label: 'Restart confirmation', value: format.duration(policy.restartConfirmSeconds) },
    { label: 'Duplicate merge tolerance', value: format.duration(policy.duplicateToleranceSeconds) },
    { label: 'Merge duplicates automatically', value: yesNo(policy.autoMergeDuplicates) },
    { label: 'Incident grouping window', value: format.duration(policy.incidentWindowSeconds) },
    ...(note ? [{ label: 'Notes', value: note }] : []),
  ];
}

/** The stop-engine settings in force for the scope, read-only. */
export function StopEngineSummary({ policy, format }: { policy: StopEnginePolicy; format: ReliabilityFormat }) {
  return <PolicySummary rows={rowsOf(policy, format)} testId="stop-engine-current" />;
}
