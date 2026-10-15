import type { LossTreeQuery } from '@/api/v2/queries/pla-analytics';
import { reportBase, type DowntimeFilters } from './downtime-filters';

/** What the lost-production card offers: lost quantity, or its value in the policy's default view (SME V8). */
export const LOST_PRODUCTION_METRICS = ['qty', 'value'] as const;
export type LostProductionMetric = (typeof LOST_PRODUCTION_METRICS)[number];

/**
 * FE-08: the loss-tree read of the page scope restricted to availability losses (what stops cost), per
 * reason, largest 20 — the approved plan ledger where a period is approved, else its shown run.
 */
export function lostProductionQuery(filters: DowntimeFilters, metric: LostProductionMetric): LossTreeQuery {
  return { ...reportBase(filters), groupBy: 'reason', metric, ledger: 'plan', kinds: ['availability'], limit: 20 };
}
