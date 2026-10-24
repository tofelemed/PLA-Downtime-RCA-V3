import { useState } from 'react';
import { useRecordStopEnginePolicy, useStopEnginePolicy } from '@/api/v2/queries/reliability-policies';
import type { StopEnginePolicy, StopEngineSettings } from '@/api/v2/types/stop-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackdateOverlapList } from '@/features/policy-backdate/backdate-overlap-list';
import { backdateBodyOf, backdateErrors, EMPTY_BACKDATE } from '@/features/policy-backdate/backdate-model';
import { CommissioningBackdateFields } from '@/features/policy-backdate/commissioning-backdate-fields';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { isSeedNote } from '@/features/ux-kit/format/built-in-default';
import { SaveFailureAlert } from '@/features/ux-kit/save-result';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { PolicySection } from './policy-section';
import { StopEngineSummary } from './stop-engine-summary';
import { usePolicyEditor } from './use-policy-editor';
import type { PolicySaveFeedback } from './use-policy-save-feedback';

const SECONDS = [
  ['debounceSeconds', 'Stop debounce (seconds)'],
  ['restartConfirmSeconds', 'Restart confirmation (seconds)'],
  ['duplicateToleranceSeconds', 'Duplicate merge tolerance (seconds)'],
  ['incidentWindowSeconds', 'Incident grouping window (seconds)'],
] as const;
const recordLabel = (backdated: boolean) => (backdated ? 'Record stop-engine settings (backdated)' : 'Record stop-engine settings (effective from now)');
interface SettingsFormProps {
  policy: StopEnginePolicy;
  unitId: string;
  saving: PolicySaveFeedback;
  /** closes the side panel (the draft is dropped) */
  onCancel: () => void;
}
/** A new version, starting from the settings in force; it opens in the section's side panel. */
function SettingsForm({ policy, unitId, saving, onCancel }: SettingsFormProps) {
  const [values, setValues] = useState<StopEngineSettings>(policy);
  const [notes, setNotes] = useState(isSeedNote(policy.notes) ? '' : policy.notes ?? '');
  const failure = saving.feedback.failure;
  const [backdate, setBackdate] = useState(EMPTY_BACKDATE);
  const [checkBackdate, setCheckBackdate] = useState(false);
  const command = useRecordStopEnginePolicy();
  const valid = SECONDS.every(([key]) => Number.isInteger(values[key]) && values[key] >= 0 && values[key] <= 86400);
  const backdateProblems = checkBackdate ? backdateErrors(backdate) : {};
  const save = async () => {
    saving.feedback.clearFailure();
    setCheckBackdate(true);
    if (Object.keys(backdateErrors(backdate)).length > 0) return;
    // Send only the DTO fields, never the version metadata returned by GET.
    const { deriveFromState, debounceSeconds, restartConfirmSeconds, duplicateToleranceSeconds, autoMergeDuplicates, incidentWindowSeconds } = values;
    const body = { ...(unitId ? { unitId } : {}), deriveFromState, debounceSeconds, restartConfirmSeconds, duplicateToleranceSeconds, autoMergeDuplicates, incidentWindowSeconds, notes, ...backdateBodyOf(backdate) };
    // a refusal stays in the red alert above the fields, with the input kept
    await saving.record(() => command.submit(body)).catch(() => null);
  };
  return <div className="space-y-3">
    <SaveFailureAlert error={failure} />
    <BackdateOverlapList error={failure} />
    <fieldset disabled={command.isPending} className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.deriveFromState} onChange={(e) => setValues({ ...values, deriveFromState: e.target.checked })} />Derive stops from unit state</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.autoMergeDuplicates} onChange={(e) => setValues({ ...values, autoMergeDuplicates: e.target.checked })} />Automatically merge unique cross-source duplicates</label>
      {SECONDS.map(([key, label]) => <label key={key} className="space-y-1 text-sm">{label}<Input type="number" min={0} max={86400} step={1} value={Number.isFinite(values[key]) ? values[key] : ''} onChange={(e) => setValues({ ...values, [key]: e.target.value === '' ? Number.NaN : Number(e.target.value) })} /></label>)}
      <label className="space-y-1 text-sm sm:col-span-2">Change notes<Input maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </fieldset>
    <CommissioningBackdateFields idPrefix="stop-engine" value={backdate} onChange={setBackdate} errors={backdateProblems} takesEffect="record" disabled={command.isPending} />
    {!valid && <p className="text-sm text-destructive">Enter whole seconds between 0 and 86400.</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" className="h-9" onClick={onCancel}>Cancel</Button>
      <Button className="h-9" disabled={!valid || command.isPending} onClick={() => void save()}>{recordLabel(backdate.effectiveFrom !== null)}</Button>
    </div>
  </div>;
}
/** The stop-engine settings in force for the scope; "Record new version" opens the form in a side panel. */
export function StopEngineSection({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const policy = useStopEnginePolicy(unitId);
  const editor = usePolicyEditor('Stop-engine settings', unitId, format);
  const form = canWrite && policy.data ? <SettingsForm key={policy.data.id} policy={policy.data} unitId={unitId} saving={editor.saving} onCancel={() => editor.setOpen(false)} /> : null;
  return (
    <PolicySection title="Stop-engine settings" info="How stops are derived from the unit state. Existing derived events keep their recorded settings." editor={editor} form={form}>
      <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()}>
        {policy.data && <StopEngineSummary policy={policy.data} format={format} />}
      </DataState>
    </PolicySection>
  );
}
