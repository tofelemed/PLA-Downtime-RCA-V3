import { useState } from 'react';
import { useCreateJob, useJobCommand } from '@/api/v2/queries/ingestion-jobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import type { SourceScope } from '../model/discovery';
import { BACKFILL_MAX_DAYS, presetJobBody, type JobPurpose } from '../model/job-presets';

const PURPOSES: ReadonlyArray<{ value: JobPurpose; label: string }> = [
  { value: 'limited', label: 'Limited ingestion (check mapping on live data)' },
  { value: 'backfill', label: 'Bounded backfill (days back, stops when caught up)' },
  { value: 'production', label: 'Production cadence (every 60 s)' },
];

/**
 * New job for the chosen scope (ING02): one of the UX06 kinds; several jobs per connection are allowed
 * (one per scope). A backfill is started and then drained, so it stops once it has caught up.
 */
export function JobCreateForm({ connectionId, scope }: { connectionId: string; scope: SourceScope }) {
  const [purpose, setPurpose] = useState<JobPurpose>('limited');
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
    setPurpose(next as JobPurpose);
    setAmount(next === 'backfill' ? '7' : '120');
  };
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="job-create">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field id="job-purpose" label="Job kind">
          <NativeSelect id="job-purpose" testId="job-purpose" value={purpose} options={PURPOSES} onChange={choose} />
        </Field>
        {purpose !== 'production' ? (
          <Field id="job-amount" label={purpose === 'backfill' ? `Days back (≤ ${BACKFILL_MAX_DAYS})` : 'Minutes back'}>
            <Input id="job-amount" type="number" min={1} max={purpose === 'backfill' ? BACKFILL_MAX_DAYS : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
        ) : (
          <span />
        )}
        <Button size="sm" disabled={!scope.scopeId || create.isPending} onClick={() => void submit()} data-testid="job-create-submit">
          Create and start
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Scope: {scope.scopeId ? `${scope.scopeType} ${scope.scopeId}${scope.templateName ? `, template ${scope.templateName}` : ', all templates'}` : 'choose a database under Discovery first'}
      </p>
      <ConsoleRefusal error={create.error ?? command.error} />
    </div>
  );
}
