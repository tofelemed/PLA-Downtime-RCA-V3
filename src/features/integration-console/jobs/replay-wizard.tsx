import { useState } from 'react';
import { useReplayRun, useRequestReplay } from '@/api/v2/queries/ingestion-exceptions';
import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRangeInput, type InstantRange } from '@/features/ux-kit/date-inputs';
import { Section } from '@/features/ux-kit/page-layout';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { canReplayAfterDryRun } from '../model/exception-flow';
import { ReplayRunStatus } from './replay-run-status';

const lastWeek = (): InstantRange => rollingWindow(7 * DAY_MS);

/**
 * Bounded replay of retained raw observations (ING05): a period on the plant calendar (whole days), a
 * reason, a dry run with counts first, then the real replay of the same period.
 */
export function ReplayWizard({ connectionId, timezone }: { connectionId: string; timezone: string }) {
  const [range, setRange] = useState<InstantRange>(lastWeek);
  const [reason, setReason] = useState('');
  const [dryRunId, setDryRunId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const request = useRequestReplay();
  const dryRun = useReplayRun(dryRunId);
  const start = async (dry: boolean) => {
    if (!range.from || !range.to) return;
    const body = { reason: reason.trim() || 'replay from the integration console', from: range.from, to: range.to, dryRun: dry };
    const accepted = await request.submit({ connectionId, body }).catch(() => null);
    if (!accepted) return;
    if (dry) {
      setDryRunId(accepted.jobId);
      setRunId(null);
    } else setRunId(accepted.jobId);
  };
  const choose = (next: InstantRange) => {
    setRange(next);
    setDryRunId(null);
  };
  return (
    <Section title="Backfill from retained data (replay)" headingLevel={3}>
      <div className="space-y-3" data-testid="replay-wizard">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
          <DateRangeInput label="Period" value={range} timeZone={timezone} onChange={choose} />
          <Field id="replay-reason" label="Reason (audited)">
            <Input id="replay-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void start(true)} disabled={request.isPending || !range.from || !range.to} data-testid="replay-dry-run">
            Dry run (counts only)
          </Button>
          <Button size="sm" onClick={() => void start(false)} disabled={!canReplayAfterDryRun(dryRun.data) || request.isPending} data-testid="replay-run-now">
            Replay this period
          </Button>
        </div>
        <ConsoleRefusal error={request.error} />
        {dryRunId && <ReplayRunStatus runId={dryRunId} />}
        {runId && <ReplayRunStatus runId={runId} />}
      </div>
    </Section>
  );
}
