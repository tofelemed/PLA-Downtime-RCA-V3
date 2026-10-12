import { useJobTransitions } from '@/api/v2/queries/ingestion-jobs';
import type { JobTransitionView } from '@/api/v2/types/integrations';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ListPager, useClientPager } from '@/features/ux-kit/data-table';
import { humanize, JOB_STATE_LABELS, labelOf, useUserNames } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';

const stateLabel = (state: string | null) => labelOf(JOB_STATE_LABELS, state);

function actorText(row: JobTransitionView, nameOf: (id: string | null) => string): string {
  if (row.runner) return ' · by a background worker';
  return row.actorId ? ` · ${nameOf(row.actorId)}` : '';
}

/** Audit trail of a job, oldest first (20 per page): command, states, who, reason. */
export function JobTransitions({ jobId, timezone }: { jobId: string; timezone: string }) {
  const transitions = useJobTransitions(jobId);
  const users = useUserNames();
  const rows = transitions.data ?? [];
  const paged = useClientPager(rows);
  return (
    <DataState state={dataStateOf(transitions, { isEmpty: rows.length === 0 })} error={transitions.error}>
      <ol className="space-y-1 text-xs" data-testid="job-transitions">
        {paged.rows.map((row) => {
          const reason = typeof row.detail?.reason === 'string' ? row.detail.reason : null;
          return (
            <li key={row.id} data-testid="job-transition" data-action={row.action}>
              {row.at ? <PlantTime iso={row.at} tz={timezone} withDate /> : '—'} · <span className="font-medium">{humanize(row.action)}</span> {stateLabel(row.fromState)} → {stateLabel(row.toState)}
              {actorText(row, users.nameOf)}
              {reason ? ` · “${reason}”` : ''}
            </li>
          );
        })}
      </ol>
      <ListPager pager={paged.pager} label="Audit trail pages" />
    </DataState>
  );
}
