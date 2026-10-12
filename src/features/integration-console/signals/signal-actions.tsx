import { useState } from 'react';
import { useSignalBackfill, useSignalBackfillRun, useSignalPreview } from '@/api/v2/queries/signals';
import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DateRangeInput, type InstantRange } from '@/features/ux-kit/date-inputs';
import { humanize, labelOf, REPLAY_STATE_LABELS, SIGNAL_ENGINE_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ConsoleRefusal } from '../components/console-refusal';
import { ToneBadge } from '../components/tone-badge';
import { formatValue } from '../model/mapping-draft';

const lastDay = (): InstantRange => rollingWindow(DAY_MS);

function PreviewResult({ engine, samples, result }: { engine: string; samples: number; result: unknown }) {
  return (
    <div data-testid="signal-preview" className="space-y-1">
      <p>
        {labelOf(SIGNAL_ENGINE_LABELS, engine)} · {samples} sample(s)
      </p>
      {typeof result === 'object' && result !== null && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          {Object.entries(result).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{humanize(key)}</dt>
              <dd className="break-all">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Quantity preview (≤ 31 days, server engine) and bounded backfill (≤ 90 days, 202 + run) of a signal. */
export function SignalActions({ signal, timezone }: { signal: SignalView; timezone: string }) {
  const { canWriteIntegration } = useCapabilities();
  const [range, setRange] = useState<InstantRange>(lastDay);
  const [runId, setRunId] = useState<string | null>(null);
  const preview = useSignalPreview();
  const backfill = useSignalBackfill();
  const run = useSignalBackfillRun(signal.id, runId);
  const window = range.from && range.to ? { signalId: signal.id, from: range.from, to: range.to } : null;
  const startBackfill = async () => {
    if (!window) return;
    const accepted = await backfill.submit(window).catch(() => null);
    if (accepted) setRunId(accepted.jobId);
  };
  return (
    <Section title={`${signal.name}: quantity and backfill`} headingLevel={3}>
      <div className="space-y-3 text-sm" data-testid="signal-actions">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeInput label="Period" value={range} timeZone={timezone} onChange={setRange} />
          <Button size="sm" variant="outline" onClick={() => window && void preview.submit(window).catch(() => null)} disabled={!window || preview.isPending}>
            Preview quantity
          </Button>
          {canWriteIntegration && (
            <Button size="sm" onClick={() => void startBackfill()} disabled={!window || backfill.isPending} data-testid="signal-backfill">
              Backfill from source
            </Button>
          )}
        </div>
        <ConsoleRefusal error={preview.error ?? backfill.error} />
        {preview.data && <PreviewResult engine={preview.data.engine} samples={preview.data.samples.length} result={preview.data.result} />}
        {run.data && (
          <ToneBadge tone={run.data.state === 'failed' ? 'error' : run.data.state === 'completed' ? 'ok' : 'busy'}>Backfill: {labelOf(REPLAY_STATE_LABELS, run.data.state).toLowerCase()}</ToneBadge>
        )}
      </div>
    </Section>
  );
}
