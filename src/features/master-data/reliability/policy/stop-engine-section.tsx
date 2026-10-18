import { useState } from 'react';
import { useRecordStopEnginePolicy, useStopEnginePolicy } from '@/api/v2/queries/reliability-policies';
import type { StopEnginePolicy, StopEngineSettings } from '@/api/v2/types/stop-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { PlantTime } from '@/features/ux-kit/plant-time';

const SECONDS = [
  ['debounceSeconds', 'Stop debounce (seconds)'],
  ['restartConfirmSeconds', 'Restart confirmation (seconds)'],
  ['duplicateToleranceSeconds', 'Duplicate merge tolerance (seconds)'],
  ['incidentWindowSeconds', 'Incident grouping window (seconds)'],
] as const;
function SettingsForm({ policy, unitId, canWrite }: { policy: StopEnginePolicy; unitId: string; canWrite: boolean }) {
  const [values, setValues] = useState<StopEngineSettings>(policy);
  const [notes, setNotes] = useState(policy.notes ?? '');
  const [failure, setFailure] = useState<unknown>(null);
  const command = useRecordStopEnginePolicy();
  const valid = SECONDS.every(([key]) => Number.isInteger(values[key]) && values[key] >= 0 && values[key] <= 86400);
  const save = async () => {
    setFailure(null);
    // Send only the DTO fields, never the version metadata returned by GET.
    const { deriveFromState, debounceSeconds, restartConfirmSeconds, duplicateToleranceSeconds, autoMergeDuplicates, incidentWindowSeconds } = values;
    try { await command.submit({ ...(unitId ? { unitId } : {}), deriveFromState, debounceSeconds, restartConfirmSeconds, duplicateToleranceSeconds, autoMergeDuplicates, incidentWindowSeconds, notes }); }
    catch (error: unknown) { setFailure(error); }
  };
  return <div className="space-y-3">
    <fieldset disabled={!canWrite || command.isPending} className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.deriveFromState} onChange={(e) => setValues({ ...values, deriveFromState: e.target.checked })} />Derive stops from unit state</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.autoMergeDuplicates} onChange={(e) => setValues({ ...values, autoMergeDuplicates: e.target.checked })} />Automatically merge unique cross-source duplicates</label>
      {SECONDS.map(([key, label]) => <label key={key} className="space-y-1 text-sm">{label}<Input type="number" min={0} max={86400} step={1} value={Number.isFinite(values[key]) ? values[key] : ''} onChange={(e) => setValues({ ...values, [key]: e.target.value === '' ? Number.NaN : Number(e.target.value) })} /></label>)}
      <label className="space-y-1 text-sm sm:col-span-2">Change notes<Input maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </fieldset>
    {!valid && <p className="text-sm text-destructive">Enter whole seconds between 0 and 86400.</p>}
    {failure !== null && <FriendlyErrorAlert error={failure} />}
    {command.data && <p role="status" className="text-sm">Stop-engine version {command.data.version} recorded.</p>}
    {canWrite && <Button disabled={!valid || command.isPending} onClick={() => void save()}>Record stop-engine settings (effective from now)</Button>}
  </div>;
}
export function StopEngineSection({ unitId, canWrite, timezone }: { unitId: string; canWrite: boolean; timezone: string }) {
  const policy = useStopEnginePolicy(unitId);
  return <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()}>{policy.data && <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Version {policy.data.version} ({policy.data.unitId ? 'unit override' : 'plant-wide'}) since <PlantTime iso={policy.data.effectiveFrom} tz={timezone} withDate />. Existing derived events keep their recorded settings.</p>
    <SettingsForm key={`${unitId}-${policy.data.id}`} policy={policy.data} unitId={unitId} canWrite={canWrite} />
  </div>}</DataState>;
}
