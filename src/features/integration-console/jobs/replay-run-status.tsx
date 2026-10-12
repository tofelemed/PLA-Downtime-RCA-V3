import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useReplayRun } from '@/api/v2/queries/ingestion-exceptions';
import { invalidateForChange } from '@/api/v2/queries/invalidation';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { INTAKE_OUTCOME_LABELS, labelOf, REPLAY_STATE_LABELS } from '@/features/ux-kit/labels';
import { ConsoleRefusal } from '../components/console-refusal';
import { ToneBadge } from '../components/tone-badge';
import { replayCounts } from '../model/exception-flow';

/**
 * Progress of a replay run (polled until final): state, dry-run flag and the server's counts. When a
 * real replay finishes, the quarantine and event results it may have changed are refreshed.
 */
export function ReplayRunStatus({ runId }: { runId: string }) {
  const run = useReplayRun(runId);
  const data = run.data;
  const queryClient = useQueryClient();
  const tenantId = useV2TenantId();
  const finishedReplay = data !== undefined && !data.dryRun && (data.state === 'completed' || data.state === 'failed');
  useEffect(() => {
    if (finishedReplay && tenantId) void invalidateForChange(queryClient, { tenantId, entityType: 'replay_run' });
  }, [finishedReplay, tenantId, queryClient]);
  if (run.error) return <ConsoleRefusal error={run.error} />;
  if (!data) return <p className="text-sm text-muted-foreground">Waiting for the run…</p>;
  const tone = data.state === 'failed' ? 'error' : data.state === 'completed' ? 'ok' : 'busy';
  return (
    <div className="space-y-1 text-sm" data-testid="replay-run" data-state={data.state} data-dry-run={data.dryRun} data-objects={data.counts?.objects ?? 0}>
      <ToneBadge tone={tone}>
        {data.dryRun ? 'Dry run' : 'Replay'}: {labelOf(REPLAY_STATE_LABELS, data.state).toLowerCase()}
      </ToneBadge>
      <ul className="flex flex-wrap gap-3 text-xs" data-testid="replay-counts">
        {replayCounts(data).map(([key, value]) => (
          <li key={key} data-count={key} data-value={value}>
            {labelOf(INTAKE_OUTCOME_LABELS, key)}: {value}
          </li>
        ))}
      </ul>
      {data.lastError && (
        <details className="text-xs text-destructive">
          <summary className="cursor-pointer">The run failed — details</summary>
          <p className="break-all">{data.lastError}</p>
        </details>
      )}
    </div>
  );
}
