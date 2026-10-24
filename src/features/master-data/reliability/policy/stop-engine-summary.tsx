import type { StopEnginePolicy } from '@/api/v2/types/stop-policy';
import { policyNoteText, sinceText } from '@/features/ux-kit/format/built-in-default';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { PolicySummary, type PolicySummaryRow } from './policy-summary';

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

function rowsOf(policy: StopEnginePolicy, format: ReliabilityFormat): PolicySummaryRow[] {
  const note = policyNoteText(policy.notes);
  // the plant clock without a zone suffix: the app header shows the plant timezone
  const inForce = `Version ${format.number(policy.version)} (${policy.unitId ? 'unit override' : 'plant-wide'}) · ${sinceText(policy.effectiveFrom, format.dateTime)}`;
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
