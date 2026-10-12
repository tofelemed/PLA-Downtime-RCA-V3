import type { QueryParams } from '@/api/v2/request-url';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { GridWorkflowState, PeriodSummaryView, RevisionSelector } from '@/api/v2/types/period-overview';

export interface PeriodGridQuery {
  unitId: string;
  from: string;
  to: string;
  workflow: GridWorkflowState | '';
  view: RevisionSelector;
}

/**
 * The plan's production periods with the server's plan-ledger figures, 20 per page (keyset). Workflow
 * state and the shown revision filter on the server; the window is the plan version's (stable per plan).
 */
export function usePeriodGrid({ unitId, from, to, workflow, view }: PeriodGridQuery) {
  const filters = { view, ...(workflow ? { workflowState: [workflow] } : {}) };
  return usePagedQuery<PeriodSummaryView>({
    resource: 'period-accounting',
    path: '/period-summaries',
    query: { unitIds: [unitId], from, to, ...filters } as unknown as QueryParams,
    key: { scope: { unitIds: [unitId] }, window: { from, to }, filters: { kind: 'period-summaries', ...filters } },
  });
}
