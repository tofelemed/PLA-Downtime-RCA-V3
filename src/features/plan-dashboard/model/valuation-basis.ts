import type { ReconciliationView } from '@/api/v2/types/reconciliation';

/** Stored valuation view → `metric` of `GET /reports/loss-value` (backend `LOSS_VALUE_METRICS`). */
const METRIC_OF_VIEW: Readonly<Record<string, string>> = {
  contribution_margin: 'margin',
  standard_cost: 'standard_cost',
  cost_per_hour: 'operational_cost',
  independent_components: 'independent_components',
  economic_impact: 'economic_impact',
};

export type ValuationShown = 'approved' | 'current';

export interface ValuationChoice {
  /** the metric to ask for; undefined = the current policy default view (draft / in review) */
  metric: string | undefined;
  /** which view the tiles show: the one frozen at approval, or the current policy's */
  shown: ValuationShown;
}

/**
 * Owner, 18 Oct 2026: an approved revision shows the valuation view frozen at its approval; the current
 * policy view only when the person asks for it (`wantCurrent`, a secondary toggle while they differ).
 * Draft and in-review revisions show the current policy view. Never substituted silently.
 */
export function valuationChoiceOf(period: ReconciliationView, wantCurrent: boolean): ValuationChoice {
  const approved = period.approvedValuation ?? null;
  if (!approved) return { metric: undefined, shown: 'current' };
  const view = wantCurrent && approved.differs ? approved.current.view : approved.view;
  return {
    metric: METRIC_OF_VIEW[view],
    shown: view === approved.view ? 'approved' : 'current',
  };
}

/** "valuation policy v3", or "the current valuation policy" when no version is approved. */
export function policyVersionText(version: number | null): string {
  return version === null ? 'the current valuation policy' : `valuation policy v${version}`;
}
