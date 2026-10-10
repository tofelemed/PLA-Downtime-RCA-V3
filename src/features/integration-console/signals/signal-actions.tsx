import { useState } from 'react';
import { useSignalBackfill, useSignalBackfillRun, useSignalPreview } from '@/api/v2/queries/signals';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { ToneBadge } from '../components/tone-badge';
import { formatValue } from '../model/mapping-draft';

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Quantity preview (≤ 31 days, server engine) and bounded backfill (≤ 90 days, 202 + run) of a signal. */
export function SignalActions({ signal }: { signal: SignalView }) {
  const [from, setFrom] = useState(() => isoDay(Date.now() - DAY));
  const [to, setTo] = useState(() => isoDay(Date.now()));
  const [runId, setRunId] = useState<string | null>(null);
  const preview = useSignalPreview();
  const backfill = useSignalBackfill();
  const run = useSignalBackfillRun(signal.id, runId);
  const window = { signalId: signal.id, from: `${from}T00:00:00Z`, to: `${to}T00:00:00Z` };
  const startBackfill = async () => {
    const accepted = await backfill.submit(window).catch(() => null);
    if (accepted) setRunId(accepted.jobId);
  };
  const result = preview.data?.result;
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="signal-actions">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Field id="signal-from" label="From (UTC day)">
          <Input id="signal-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field id="signal-to" label="To (UTC day, exclusive)">
          <Input id="signal-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Button size="sm" variant="outline" onClick={() => void preview.submit(window).catch(() => null)} disabled={preview.isPending}>
          Preview quantity
        </Button>
        <Button size="sm" onClick={() => void startBackfill()} disabled={backfill.isPending}>
          Backfill from source
        </Button>
      </div>
      <ConsoleRefusal error={preview.error ?? backfill.error} />
      {preview.data && (
        <div data-testid="signal-preview">
          <p>
            Engine {preview.data.engine} · {preview.data.samples.length} sample(s)
          </p>
          {typeof result === 'object' && result !== null && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              {Object.entries(result).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="break-all">{formatValue(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      {run.data && (
        <ToneBadge tone={run.data.state === 'failed' ? 'error' : run.data.state === 'completed' ? 'ok' : 'busy'}>Backfill {run.data.state}</ToneBadge>
      )}
    </div>
  );
}
