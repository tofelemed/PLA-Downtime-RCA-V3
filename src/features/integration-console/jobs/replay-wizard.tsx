import { useState } from 'react';
import { useReplayRun, useRequestReplay } from '@/api/v2/queries/ingestion-exceptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { canReplayAfterDryRun } from '../model/exception-flow';
import { ReplayRunStatus } from './replay-run-status';

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Bounded replay of retained raw observations (ING05): window on the observation time (UTC days, end
 * exclusive), a reason, a dry run with counts first, then the real replay of the same window.
 */
export function ReplayWizard({ connectionId }: { connectionId: string }) {
  const [from, setFrom] = useState(() => isoDay(Date.now() - 7 * DAY));
  const [to, setTo] = useState(() => isoDay(Date.now() + DAY));
  const [reason, setReason] = useState('');
  const [dryRunId, setDryRunId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const request = useRequestReplay();
  const dryRun = useReplayRun(dryRunId);
  const start = async (dry: boolean) => {
    const body = { reason: reason.trim() || 'replay from the integration console', from: `${from}T00:00:00Z`, to: `${to}T00:00:00Z`, dryRun: dry };
    const accepted = await request.submit({ connectionId, body }).catch(() => null);
    if (!accepted) return;
    if (dry) {
      setDryRunId(accepted.jobId);
      setRunId(null);
    } else setRunId(accepted.jobId);
  };
  return (
    <section aria-label="Replay" className="space-y-2 rounded-md border p-3" data-testid="replay-wizard">
      <h3 className="font-semibold">Backfill from retained data (replay)</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field id="replay-from" label="From (UTC day)">
          <Input id="replay-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field id="replay-to" label="To (UTC day, exclusive)">
          <Input id="replay-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field id="replay-reason" label="Reason (audited)">
          <Input id="replay-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void start(true)} disabled={request.isPending} data-testid="replay-dry-run">
          Dry run (counts only)
        </Button>
        <Button size="sm" onClick={() => void start(false)} disabled={!canReplayAfterDryRun(dryRun.data) || request.isPending} data-testid="replay-run-now">
          Replay this window
        </Button>
      </div>
      <ConsoleRefusal error={request.error} />
      {dryRunId && <ReplayRunStatus runId={dryRunId} />}
      {runId && <ReplayRunStatus runId={runId} />}
    </section>
  );
}
