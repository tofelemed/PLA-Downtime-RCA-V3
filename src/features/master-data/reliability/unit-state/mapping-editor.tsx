import { useState } from 'react';
import { useRecordUnitStateMapping, useUnitStateSignals } from '@/api/v2/queries/reliability-unit-state';
import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { TextField } from '../../components/text-field';
import { SELECT_CLASS } from '../shared/use-asset-lookup';
import { bodyOf, draftErrors, draftOf, withoutRule, withRule, withRuleChange, type MappingDraft, type MappingErrors } from './mapping-editor-model';
import { AnalogFields } from './analog-fields';
import { StateRulesEditor } from './state-rules-editor';

interface FieldsProps {
  draft: MappingDraft;
  errors: MappingErrors;
  set: (change: Partial<MappingDraft>) => void;
}

function StalenessFields({ draft, errors, set }: FieldsProps) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3">
      <legend className="mb-1 text-sm font-medium">Staleness</legend>
      <TextField id="map-interval" label="Expected interval (s)" value={draft.expectedIntervalSeconds} onChange={(v) => set({ expectedIntervalSeconds: v })} error={errors.expectedIntervalSeconds} required />
      <TextField id="map-jitter" label="Known jitter (s)" value={draft.jitterSeconds} onChange={(v) => set({ jitterSeconds: v })} error={errors.jitterSeconds} />
      <TextField id="map-stale" label="Stale after (intervals)" value={draft.staleAfterIntervals} onChange={(v) => set({ staleAfterIntervals: v })} error={errors.staleAfterIntervals} hint="Pilot: 3 intervals + jitter" />
      <div className="flex items-center gap-2 sm:col-span-3">
        <input id="map-heartbeat" type="checkbox" className="h-4 w-4" checked={draft.isHeartbeat} onChange={(e) => set({ isHeartbeat: e.target.checked })} />
        <Label htmlFor="map-heartbeat">Heartbeat source (a quiet signal means lost communication). Off for exception-based sources.</Label>
      </div>
    </fieldset>
  );
}

function SignalField({ unitId, draft, errors, set }: FieldsProps & { unitId: string }) {
  const signals = useUnitStateSignals(unitId, draft.analog !== null);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="map-signal">{draft.analog ? 'State or analog signal' : 'State signal'}</Label>
      <select id="map-signal" className={SELECT_CLASS} value={draft.signalId} onChange={(e) => set({ signalId: e.target.value })}>
        <option value="">{signals.isLoading ? 'Loading signals…' : 'Choose a state signal'}</option>
        {signals.items.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sourceKey}) · version {s.version}</option>)}
      </select>
      {errors.signalId && <p className="text-sm text-destructive">{errors.signalId}</p>}
    </div>
  );
}

/** A new version of the unit's mapping, starting from the version in force; the previous one ends at "from". */
export function MappingEditor({ unitId, current, timezone }: { unitId: string; current: UnitStateMappingView | undefined; timezone: string }) {
  const [draft, setDraft] = useState<MappingDraft>(() => draftOf(current));
  const [shown, setShown] = useState<MappingErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const record = useRecordUnitStateMapping();
  const { toast } = useToast();
  const set = (change: Partial<MappingDraft>) => setDraft((d) => ({ ...d, ...change }));
  const save = async () => {
    const errors = draftErrors(draft);
    setShown(errors);
    setFailure(null);
    if (Object.keys(errors).length > 0) return;
    try {
      const saved = await record.submit(bodyOf(unitId, draft));
      toast({ title: `Mapping version ${saved.version} recorded` });
    } catch (error: unknown) {
      setFailure(error);
    }
  };
  const fields = { draft, errors: shown, set };
  return (
    <form className="max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <SignalField unitId={unitId} {...fields} />
      <StateRulesEditor rules={draft.rules} error={shown.rules} onAdd={() => setDraft(withRule)} onRemove={(i) => setDraft((d) => withoutRule(d, i))} onChange={(i, c) => setDraft((d) => withRuleChange(d, i, c))} />
      <AnalogFields analog={draft.analog} errors={shown.analog} onChange={(analog) => set({ analog })} />
      <StalenessFields {...fields} />
      <DateTimeInput label="Effective from (empty = now)" value={draft.effectiveFrom} timeZone={timezone} onChange={(v) => set({ effectiveFrom: v })} />
      <TextField id="map-notes" label="Notes" value={draft.notes} onChange={(v) => set({ notes: v })} multiline maxLength={1000} />
      {failure !== null && <FriendlyErrorAlert error={failure} title="The server refused the mapping" />}
      <Button type="submit" disabled={record.isPending}>Record new version</Button>
    </form>
  );
}
