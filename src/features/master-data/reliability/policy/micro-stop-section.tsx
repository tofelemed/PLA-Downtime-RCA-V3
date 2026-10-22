import { policyNoteText } from '@/features/ux-kit/format/built-in-default';
import { useMicroStopPolicy } from '@/api/v2/queries/reliability-policies';
import type { MicroStopPolicyView } from '@/api/v2/types/reliability';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { MicroStopForm } from './micro-stop-form';
import { PolicySection } from './policy-section';
import { PolicySummary, type PolicySummaryRow } from './policy-summary';
import { policyVersionLine } from './policy-version-line';
import { usePolicyEditor } from './use-policy-editor';

function rowsOf(view: MicroStopPolicyView, unitId: string, format: ReliabilityFormat): PolicySummaryRow[] {
  const classes = Object.entries(view.microStopSecondsByAssetClass);
  const note = policyNoteText(view.notes);
  return [
    { label: 'In force', value: policyVersionLine(view, unitId, format) },
    { label: 'Threshold', value: format.duration(view.microStopSeconds) },
    { label: 'Per asset class', value: classes.length ? classes.map(([c, s]) => `${c}: ${format.duration(s)}`).join(' · ') : 'None (the threshold applies to every asset)' },
    { label: 'Trip reasons', value: view.tripReasonCodes.length ? view.tripReasonCodes.join(', ') : 'None' },
    ...(note ? [{ label: 'Notes', value: note }] : []),
  ];
}

/** SME D6: the micro-stop settings in force for the scope; "Record new version" (manager approvers) opens the form in a side panel. */
export function MicroStopSection({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const policy = useMicroStopPolicy(unitId);
  const editor = usePolicyEditor('Micro-stop settings', unitId, format);
  const form = canWrite && policy.data ? <MicroStopForm key={`${unitId}-${policy.data.id}`} unitId={unitId} current={policy.data} saving={editor.saving} /> : null;
  return (
    <PolicySection title="Micro-stops and trips" editor={editor} form={form}>
      <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()}>
        {policy.data && <PolicySummary rows={rowsOf(policy.data, unitId, format)} testId="micro-stop-current" />}
      </DataState>
    </PolicySection>
  );
}
