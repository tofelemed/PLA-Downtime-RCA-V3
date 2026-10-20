import { useState } from 'react';
import { useCreateJob, useJobCommand } from '@/api/v2/queries/ingestion-jobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { ScopePicker } from '../discovery/scope-picker';
import type { SourceScope } from '../model/discovery';
import { BACKFILL_MAX_DAYS, presetJobBody, UPKEEP_KINDS, type JobKind } from '../model/job-presets';

const PURPOSES: ReadonlyArray<{ value: JobKind; label: string }> = [
  { value: 'limited', label: 'Limited ingestion (check mapping on live data)' },
  { value: 'backfill', label: 'Bounded backfill (days back, stops when caught up)' },
  { value: 'production', label: 'Production cadence (every 60 s)' },
  { value: 'open_frames', label: 'Open frames refresh (every 60 s; frames still running)' },
  { value: 'rescan', label: 'Correction rescan (daily, last 7 days; frames edited in PI)' },
  { value: 'inventory', label: 'Deletion check (daily, last 7 days; frames deleted in PI)' },
];

/** Kinds without an amount to enter (fixed cadence and window). */
const FIXED_KINDS: readonly JobKind[] = ['production', ...UPKEEP_KINDS];

/**
 * New job for the chosen scope (ING02): one of the UX06 kinds or an upkeep job (open frames, correction
 * rescan, deletion check); several jobs per connection are allowed (one per scope). A backfill is started
 * and then drained, so it stops once it has caught up.
 */
export interface JobCreateFormProps {
  connectionId: string;
  scope: SourceScope;
  onScope: (scope: SourceScope) => void;
}

export function JobCreateForm({ connectionId, scope, onScope }: JobCreateFormProps) {
  const [purpose, setPurpose] = useState<JobKind>('limited');
  // opened without a scope: pick it here (stays open while the WebId is typed)
  const [picking] = useState(!scope.scopeId);
  const [amount, setAmount] = useState('120');
  const create = useCreateJob();
  const command = useJobCommand();
  const submit = async () => {
    const value = Number(amount);
    const body = presetJobBody({ purpose, ...scope, lookbackMinutes: value, days: value });
    const job = await create.submit({ connectionId, body }).catch(() => null);
    if (job && purpose === 'backfill') await command.submit({ jobId: job.id, action: 'drain', reason: 'bounded backfill: stop once caught up' }).catch(() => null);
  };
  const choose = (next: string) => {
    setPurpose(next as JobKind);
    setAmount(next === 'backfill' ? '7' : '120');
  };
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="job-create">
      {picking && <ScopePicker connectionId={connectionId} scope={scope} onChange={onScope} />}
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field id="job-purpose" label="Job kind">
          <NativeSelect id="job-purpose" testId="job-purpose" value={purpose} options={PURPOSES} onChange={choose} />
        </Field>
        {!FIXED_KINDS.includes(purpose) ? (
          <Field id="job-amount" label={purpose === 'backfill' ? `Days back (≤ ${BACKFILL_MAX_DAYS})` : 'Minutes back'}>
            <Input id="job-amount" type="number" min={1} max={purpose === 'backfill' ? BACKFILL_MAX_DAYS : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
        ) : (
          <span />
        )}
        <Button size="sm" disabled={(purpose !== 'open_frames' && !scope.scopeId) || create.isPending} onClick={() => void submit()} data-testid="job-create-submit">
          Create and start
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Reads: {scope.scopeId ? `AF ${scope.scopeType} ${scope.scopeId}${scope.templateName ? `, template ${scope.templateName}` : ', all templates'}${picking ? '' : ' (change it under Discovery and mapping)'}` : 'choose the AF database or element to read above'}
      </p>
      <ConsoleRefusal error={create.error ?? command.error} />
    </div>
  );
}
