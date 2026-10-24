import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_RECOMMENDATION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RCA_RECOMMENDATION_STATUS_TONES } from '@/features/ux-kit/labels/status-tones';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { CreateTaskButton } from './create-task-button';
import { RecommendationActions } from './recommendation-actions';

export interface RecommendationColumnContext {
  owner: (id: string | null) => string;
  day: (v: string | null) => string;
  readOnly: boolean;
  basePath: string;
  /** the estimated cost is money: left out without the money capability (QA re-test) */
  money: boolean;
}

const statusCell = (row: RcaRecommendationItem) => (
  <StatusBadge tone={toneOf(RCA_RECOMMENDATION_STATUS_TONES, row.status ?? 'Open')} className="whitespace-nowrap">
    {labelOf(RCA_RECOMMENDATION_STATUS_LABELS, row.status, 'Open')}
  </StatusBadge>
);

/** Columns of the recommendations table; a writer also gets the Task column ("Create task from recommendation"). */
export function recommendationColumns({ owner, day, readOnly, basePath, money }: RecommendationColumnContext): DataTableColumn<RcaRecommendationItem>[] {
  const base: DataTableColumn<RcaRecommendationItem>[] = [
    { id: 'title', header: 'Recommendation', cell: (row) => <span className="font-medium">{row.title}</span> },
    { id: 'status', header: 'Status', cell: statusCell, nowrap: true },
    { id: 'priority', header: 'Priority', cell: (row) => row.priority ?? '—', nowrap: true },
    { id: 'owner', header: 'Owner', cell: (row) => owner(row.ownerId) },
    { id: 'due', header: 'Due', cell: (row) => day(row.dueDate), nowrap: true },
    ...(money ? [{ id: 'cost', header: 'Est. cost', cell: (row: RcaRecommendationItem) => row.estimatedCost ?? '—', align: 'right' as const, nowrap: true }] : []),
    { id: 'actions', header: 'Actions', cell: (row) => <RecommendationActions recommendation={row} basePath={basePath} readOnly={readOnly} /> },
  ];
  return readOnly ? base : [...base, { id: 'task', header: 'Task', headerLabel: 'Task', cell: (row) => <CreateTaskButton recommendation={row} />, nowrap: true }];
}
