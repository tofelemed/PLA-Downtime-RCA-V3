import { useJobTransitions } from '@/api/v2/queries/ingestion-jobs';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';

/** Audit trail of a job, oldest first: command, states, who or which runner, reason. */
export function JobTransitions({ jobId, timezone }: { jobId: string; timezone: string }) {
  const transitions = useJobTransitions(jobId);
  const rows = transitions.data ?? [];
  return (
    <DataState state={dataStateOf(transitions, { isEmpty: rows.length === 0 })} error={transitions.error}>
      <ol className="space-y-1 text-xs" data-testid="job-transitions">
        {rows.map((row) => {
          const reason = typeof row.detail?.reason === 'string' ? row.detail.reason : null;
          return (
            <li key={row.id} data-testid="job-transition" data-action={row.action}>
              <PlantTime iso={row.at} tz={timezone} withDate /> · <span className="font-medium">{row.action}</span> {row.fromState ?? '—'} → {row.toState ?? '—'}
              {row.runner ? ` · runner ${row.runner}` : row.actorId ? ` · user ${row.actorId.slice(0, 8)}` : ''}
              {reason ? ` · “${reason}”` : ''}
            </li>
          );
        })}
      </ol>
    </DataState>
  );
}
